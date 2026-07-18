const READ_ONLY_QUERY = /^\s*(SELECT|WITH)\b/i;
const FORBIDDEN_SQL = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX)\b/i;

function assertReadOnlyQuery(sql) {
  if (typeof sql !== 'string' || !READ_ONLY_QUERY.test(sql) || FORBIDDEN_SQL.test(sql)) {
    throw new Error('Only read-only SELECT queries are allowed');
  }

  const withoutTrailingSemicolon = sql.trim().replace(/;$/, '');
  if (withoutTrailingSemicolon.includes(';')) {
    throw new Error('Multiple SQL statements are not allowed');
  }

  return withoutTrailingSemicolon;
}

function rowsFromResult(result) {
  if (!result || !result[0]) return [];
  const { columns, values } = result[0];
  return values.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
}

function describeSchema(db, tableNames) {
  return tableNames.map((tableName) => {
    const escapedTableName = String(tableName).replace(/"/g, '""');
    const result = db.exec(`PRAGMA table_info("${escapedTableName}")`);
    const columns = rowsFromResult(result).map((column) => `${column.name} ${column.type || ''}`.trim());
    return `Table ${tableName}: ${columns.join(', ')}`;
  }).join('\n');
}

const RESPONSE_TYPES = new Set(['text', 'table', 'chart']);
const CHART_TYPES = new Set(['bar', 'line', 'pie']);
const CHART_MENTION = /\b(graphique|courbe|diagramme|chart)\b/i;
const TEMPORAL_KEY = /(date|mois|month|jour|day|ann[ée]e|year|p[ée]riode)/i;

function normalizeAssistantResponse(response, queryResults = []) {
  const normalized = response && typeof response === 'object' ? { ...response } : {};
  normalized.text = typeof normalized.text === 'string'
    ? normalized.text.trim()
    : 'Je n\'ai pas pu formuler une réponse lisible.';
  normalized.type = RESPONSE_TYPES.has(normalized.type) ? normalized.type : 'text';

  const responseData = Array.isArray(normalized.data) ? normalized.data : [];
  const fallbackData = Array.isArray(queryResults) ? queryResults : [];
  const validChartType = CHART_TYPES.has(normalized.chartType);
  const promisesAChart = CHART_MENTION.test(normalized.text);

  // Some models describe a chart but inconsistently label the payload as text.
  // Keep the UI contract deterministic whenever usable series data is available.
  if ((normalized.type === 'chart' || validChartType || promisesAChart)
      && (responseData.length > 0 || fallbackData.length > 1)) {
    normalized.type = 'chart';
    normalized.data = responseData.length > 0 ? responseData : fallbackData;

    if (!validChartType) {
      const firstRow = normalized.data[0] || {};
      normalized.chartType = Object.keys(firstRow).some((key) => TEMPORAL_KEY.test(key)) ? 'line' : 'bar';
    }
  } else if (normalized.type === 'chart') {
    // Never promise an empty chart to the client.
    normalized.type = 'text';
    delete normalized.chartType;
    normalized.data = [];
  } else if (normalized.type === 'table' && responseData.length === 0) {
    normalized.data = fallbackData;
  }

  return normalized;
}

module.exports = {
  assertReadOnlyQuery,
  describeSchema,
  normalizeAssistantResponse,
  rowsFromResult,
};
