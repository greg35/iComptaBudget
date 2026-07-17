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

module.exports = {
  assertReadOnlyQuery,
  describeSchema,
  rowsFromResult,
};
