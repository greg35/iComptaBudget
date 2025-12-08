const express = require('express');
const OpenAI = require('openai');
const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');
const { openDb } = require('../utils/database');

const router = express.Router();

// Schema definition for the LLM
const DB_SCHEMA = `
Table: ICTransaction
- ID (text): Unique identifier
- name (text): Transaction description/payee
- date (text): Date of transaction (YYYY-MM-DD HH:MM:SS)
- amount (real): Amount (negative for expense, positive for income)
- account (text): Account ID
- status (integer): 0=Pending, 1=Cleared, 2=Reconciled

Table: ICTransactionSplit
- ID (text): Unique identifier
- "transaction" (text): Foreign key to ICTransaction.ID
- amount (real): Amount of this split
- category (text): Foreign key to ICCategory.ID
- project (text): Project name (optional)
- comment (text): Comment/memo

Table: ICCategory
- ID (text): Unique identifier
- name (text): Category name
- parent (text): Parent category ID (if any)
`;

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Step 0: Get API Key from DB
    if (!fs.existsSync(config.DATA_DB_PATH)) {
      return res.status(500).json({ error: 'Database not found' });
    }

    const settingsDb = await openDb(config.DATA_DB_PATH);
    let apiKey = null;
    try {
      const result = settingsDb.exec("SELECT value FROM settings WHERE key = 'openai_api_key'");
      if (result && result[0] && result[0].values.length > 0) {
        apiKey = result[0].values[0][0];
      }
    } catch (e) {
      console.error('Error fetching API key:', e);
    } finally {
      settingsDb.close();
    }

    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured in settings' });
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Step 0.5: Fetch all categories to help the LLM
    let categories = [];
    try {
      // We use the main DB for categories as it has the data
      if (fs.existsSync(config.DB_PATH)) {
        const mainDb = await openDb(config.DB_PATH);
        const catResult = mainDb.exec("SELECT name FROM ICCategory");
        if (catResult && catResult[0]) {
          categories = catResult[0].values.map(row => row[0]);
        }
        mainDb.close();
      }
    } catch (e) {
      console.error('Error fetching categories:', e);
    }

    // Step 1: Generate SQL query or Clarification from natural language
    const systemPrompt = `
    You are a helpful data assistant for a personal finance application.
    Your goal is to answer user questions by generating a SQLite query based on the provided schema.
    
    Schema:
    ${DB_SCHEMA}

    Available Categories:
    ${categories.join(', ')}

    Rules:
    1. You must output a JSON object.
    2. The JSON object must have an "action" field which can be "query" or "clarify".
    3. If the user's request is ambiguous (e.g., "electricity" could match "Electricité" or "Electronic"), set "action" to "clarify" and provide a "question" field to ask the user for clarification.
    4. If the user's request is clear, set "action" to "query" and provide a "sql" field with the raw SQL query.
    5. The query must be READ-ONLY (SELECT only).
    6. Use "ICTransaction" joined with "ICTransactionSplit" and "ICCategory" to get full details.
    7. "ICTransactionSplit" contains the category and project info.
    8. Dates are stored as strings. Use SQLite date functions if needed (e.g., strftime).
    9. If the user asks for "expenses", filter for amount < 0.
    10. If the user asks for "income", filter for amount > 0.
    11. Limit results to 50 unless specified otherwise.
    12. Always select meaningful columns to answer the question (e.g., date, name, category name, amount).
    13. CRITICAL: The column name "transaction" in ICTransactionSplit is a reserved word. YOU MUST QUOTE IT as "transaction" in your queries (e.g., ics."transaction" = ict.ID).
    14. When filtering by category, use the EXACT name from the "Available Categories" list. Use LIKE if you are unsure but prefer exact matches.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
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

    let sqlQuery = llmResponse.sql;
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
      const result = db.exec(sqlQuery);
      if (result && result[0]) {
        const columns = result[0].columns;
        queryResults = result[0].values.map(row => {
          const obj = {};
          columns.forEach((col, index) => {
            obj[col] = row[index];
          });
          return obj;
        });
      }
    } catch (dbError) {
      console.error('SQL Execution Error:', dbError);
      return res.status(400).json({
        error: 'Failed to execute generated query',
        details: dbError.message,
        query: sqlQuery
      });
    } finally {
      db.close();
    }

    // Step 3: Interpret results and generate natural language response
    const interpretationPrompt = `
    You are a helpful data assistant.
    The user asked: "${message}"
    
    You generated this SQL: "${sqlQuery}"
    
    And got these results (JSON):
    ${JSON.stringify(queryResults.slice(0, 20))} ${queryResults.length > 20 ? '...(truncated)' : ''}
    
    Please provide a response to the user.
    If the results are a list of transactions, summarize them or present them clearly.
    If the results are aggregated data (e.g. sum by category), explain the findings.
    
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

    const interpretation = await openai.chat.completions.create({
      model: "gpt-4o",
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
