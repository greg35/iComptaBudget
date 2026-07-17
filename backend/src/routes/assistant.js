const express = require('express');
const OpenAI = require('openai');
const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');
const { openDb } = require('../utils/database');
const { assertReadOnlyQuery, describeSchema, rowsFromResult } = require('../utils/assistantData');

const router = express.Router();

const MAX_CONTEXT_ROWS = 200;

function formatContextRows(rows) {
  const selectedRows = rows.slice(0, MAX_CONTEXT_ROWS);
  return `${JSON.stringify(selectedRows)}${rows.length > MAX_CONTEXT_ROWS ? ` (truncated: ${rows.length} rows total)` : ''}`;
}

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Step 0: Get LLM settings from DB
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.status(500).json({ error: 'Database not found' });
    }

    const settingsDb = await openDb(config.DATA_DB_PATH);
    let llmProvider = 'openai';
    let apiKey = null;
    let openRouterModel = 'openai/gpt-4o';
    try {
      const result = settingsDb.exec("SELECT key, value FROM settings WHERE key IN ('llm_provider', 'openai_api_key', 'openrouter_model')");
      if (result && result[0] && result[0].values.length > 0) {
        for (const [key, value] of result[0].values) {
          if (key === 'llm_provider') llmProvider = value || 'openai';
          if (key === 'openai_api_key') apiKey = value;
          if (key === 'openrouter_model') openRouterModel = value || 'openai/gpt-4o';
        }
      }
    } catch (e) {
      console.error('Error fetching LLM settings:', e);
    } finally {
      settingsDb.close();
    }

    if (!apiKey) {
      return res.status(500).json({ error: 'LLM API key not configured in settings' });
    }

    const isOpenRouter = llmProvider === 'openrouter';
    const llmClient = new OpenAI({
      apiKey: apiKey,
      ...(isOpenRouter ? { baseURL: 'https://openrouter.ai/api/v1' } : {}),
    });
    const llmModel = isOpenRouter ? openRouterModel : 'gpt-4o';

    // Step 0.5: Read the live schema and a compact financial overview. This
    // keeps SQL generation reliable across iCompta versions and LLM providers.
    let categories = [];
    let accounts = [];
    let liveSchema = '';
    let financialOverview = {};
    try {
      if (fs.existsSync(config.DB_PATH)) {
        const mainDb = await openDb(config.DB_PATH);
        try {
          liveSchema = describeSchema(mainDb, ['ICTransaction', 'ICTransactionSplit', 'ICCategory', 'ICAccount']);
          categories = rowsFromResult(mainDb.exec("SELECT ID, name FROM ICCategory ORDER BY name"));
          accounts = rowsFromResult(mainDb.exec("SELECT ID, name FROM ICAccount ORDER BY name"));

          const coverage = rowsFromResult(mainDb.exec(`
            SELECT COUNT(DISTINCT t.ID) AS transactionCount,
                   COUNT(s.ID) AS splitCount,
                   MIN(COALESCE(t.date, t.valueDate)) AS firstDate,
                   MAX(COALESCE(t.date, t.valueDate)) AS lastDate
            FROM ICTransaction t
            LEFT JOIN ICTransactionSplit s ON s."transaction" = t.ID
            WHERE t.status IS NULL OR t.status <> 'ICTransactionStatus.PlannedStatus'
          `))[0] || {};

          const recentMonths = rowsFromResult(mainDb.exec(`
            SELECT strftime('%Y-%m', COALESCE(t.date, t.valueDate)) AS month,
                   ROUND(SUM(CASE WHEN CAST(s.amount AS REAL) > 0 THEN CAST(s.amount AS REAL) ELSE 0 END), 2) AS income,
                   ROUND(ABS(SUM(CASE WHEN CAST(s.amount AS REAL) < 0 THEN CAST(s.amount AS REAL) ELSE 0 END)), 2) AS expenses,
                   ROUND(SUM(CAST(s.amount AS REAL)), 2) AS net
            FROM ICTransactionSplit s
            JOIN ICTransaction t ON s."transaction" = t.ID
            LEFT JOIN ICCategory c ON s.category = c.ID
            WHERE (t.status IS NULL OR t.status <> 'ICTransactionStatus.PlannedStatus')
              AND date(COALESCE(t.date, t.valueDate)) >= date('now', '-12 months', 'start of month')
              AND (c.name IS NULL OR lower(c.name) NOT LIKE '%provision%')
            GROUP BY month
            ORDER BY month
          `));
          financialOverview = { coverage, recentMonths };
        } finally {
          mainDb.close();
        }
      }
    } catch (e) {
      console.error('Error building assistant financial context:', e);
    }

    // Manual transactions live in the application database, not in Comptes.cdb.
    try {
      const manualDb = await openDb(config.DATA_DB_PATH);
      try {
        const manualTransactions = rowsFromResult(manualDb.exec(`
          SELECT date, description, amount, type, category, comment, projectId
          FROM transactions
          ORDER BY date DESC
          LIMIT 200
        `));
        financialOverview.manualTransactions = manualTransactions;
      } catch (e) {
        // Older installations may not have the manual transactions table.
        financialOverview.manualTransactions = [];
      } finally {
        manualDb.close();
      }
    } catch (e) {
      console.error('Error fetching manual transactions for assistant:', e);
    }

    // Step 1: Generate SQL query or Clarification from natural language
    const systemPrompt = `
    You are a helpful data assistant for a personal finance application.
    Your goal is to answer user questions by generating a SQLite query based on the provided schema.
    
    Current date: ${new Date().toISOString().slice(0, 10)}

    Live SQLite schema:
    ${liveSchema}

    Available Categories:
    ${JSON.stringify(categories)}

    Available Accounts:
    ${JSON.stringify(accounts)}

    Verified financial overview (use it to understand data coverage; query the database for the exact answer):
    ${JSON.stringify(financialOverview)}

    Rules:
    1. You must output a JSON object.
    2. The JSON object must have an "action" field which can be "query" or "clarify".
    3. If the user's request is ambiguous (e.g., "electricity" could match "Electricité" or "Electronic"), set "action" to "clarify" and provide a "question" field to ask the user for clarification.
    4. If the user's request is clear, set "action" to "query" and provide a "sql" field with the raw SQL query.
    5. The query must be READ-ONLY (SELECT only).
    6. Monetary amounts are stored in ICTransactionSplit.amount, NOT in ICTransaction. Always join splits to transactions.
    7. Use "ICTransaction" joined with "ICTransactionSplit", "ICCategory" and optionally "ICAccount" to get full details.
    8. Dates are stored as strings. Use SQLite date functions if needed (e.g., strftime).
    9. If the user asks for "expenses", filter for amount < 0.
    10. If the user asks for "income", filter for amount > 0.
    11. Limit transaction detail lists to 200. Do not add a limit to aggregate queries.
    12. Always select meaningful columns to answer the question (e.g., date, name, category name, amount).
    13. CRITICAL: The column name "transaction" in ICTransactionSplit is a reserved word. YOU MUST QUOTE IT as "transaction" in your queries (e.g., ics."transaction" = ict.ID).
    14. When filtering by category, use its ID or exact name from Available Categories. Use LIKE only if needed.
    15. Exclude planned transactions unless the user explicitly asks for them: t.status IS NULL OR t.status <> 'ICTransactionStatus.PlannedStatus'.
    16. For relative periods, use date(COALESCE(t.date, t.valueDate)) and SQLite date functions. "The last 6 months" means from date('now', '-6 months') through today.
    17. For profit/cash-flow questions, return income, expenses and net (SUM of split amounts), so the answer is auditable.
    18. The manual transactions included in the verified overview are also part of the user's finances. Incorporate them in the answer when relevant; they cannot be queried from the main schema.
    `;

    const completion = await llmClient.chat.completions.create({
      model: llmModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
    });

    const llmResponse = JSON.parse(completion.choices[0].message.content);

    if (llmResponse.action === 'clarify') {
      return res.json({
        text: llmResponse.question,
        type: 'text'
      });
    }

    let sqlQuery = assertReadOnlyQuery(llmResponse.sql);
    console.log('Generated SQL:', sqlQuery);

    // Step 2: Execute the query
    // We use the main DB path as it has the most complete data
    // Check if DB exists
    if (!fs.existsSync(config.DB_PATH)) {
      return res.status(500).json({ error: 'Database not found' });
    }

    const db = await openDb(config.DB_PATH);
    let queryResults = [];

    try {
      queryResults = rowsFromResult(db.exec(sqlQuery));
    } catch (dbError) {
      console.error('SQL Execution Error:', dbError);
      // Give the selected model one opportunity to repair its query using the
      // actual database error and schema instead of failing the whole chat.
      const repair = await llmClient.chat.completions.create({
        model: llmModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
          { role: 'assistant', content: JSON.stringify({ action: 'query', sql: sqlQuery }) },
          { role: 'user', content: `This query failed with: ${dbError.message}. Return corrected JSON using the live schema.` },
        ],
        response_format: { type: 'json_object' },
      });
      const repairedResponse = JSON.parse(repair.choices[0].message.content);
      sqlQuery = assertReadOnlyQuery(repairedResponse.sql);
      console.log('Repaired SQL:', sqlQuery);
      queryResults = rowsFromResult(db.exec(sqlQuery));
    } finally {
      db.close();
    }

    // Step 3: Interpret results and generate natural language response
    const interpretationPrompt = `
    You are a helpful data assistant.
    The user asked: "${message}"
    
    You generated this SQL: "${sqlQuery}"
    
    And got these complete query results (JSON, capped only for very large detail lists):
    ${formatContextRows(queryResults)}

    Additional verified financial context, including manual transactions:
    ${JSON.stringify(financialOverview)}
    
    Please provide a response to the user.
    If the results are a list of transactions, summarize them or present them clearly.
    If the results are aggregated data (e.g. sum by category), explain the findings and show the exact figures.
    Never claim that no transactions exist when the financial overview shows data. If the SQL result is empty despite known coverage, explain that the requested filter returned no match.
    
    Also, determine the best way to visualize this data.
    Return a JSON object with this structure:
    {
      "text": "Your natural language response here...",
      "type": "text" | "table" | "chart",
      "chartType": "bar" | "line" | "pie" (optional, if type is chart),
      "data": [ ... the data to display ... ]
    }
    
    For "data", use the provided query results directly if they are suitable, or transform them if needed for the chart.
    For charts, ensure the data has clear keys (e.g. "name", "value").
    `;

    const interpretation = await llmClient.chat.completions.create({
      model: llmModel,
      messages: [
        { role: "system", content: "You are a helpful assistant that outputs JSON." },
        { role: "user", content: interpretationPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const finalResponse = JSON.parse(interpretation.choices[0].message.content);

    // If the LLM didn't include the full data in the response (it might truncate), 
    // we can inject the original query results if the type is table and data is missing or small.
    // But usually, we trust the LLM to format the data for the specific view.
    // However, for large tables, we might want to just pass the raw results.
    if (finalResponse.type === 'table' && (!finalResponse.data || finalResponse.data.length === 0)) {
      finalResponse.data = queryResults;
    }

    res.json(finalResponse);

  } catch (error) {
    console.error('Assistant Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;
