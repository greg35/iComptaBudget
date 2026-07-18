const test = require('node:test');
const assert = require('node:assert/strict');
const initSqlJs = require('sql.js');
const { assertReadOnlyQuery, describeSchema, normalizeAssistantResponse, rowsFromResult } = require('./assistantData');

test('accepts SELECT and CTE queries while rejecting mutations and multiple statements', () => {
  assert.equal(assertReadOnlyQuery('SELECT * FROM ICTransaction;'), 'SELECT * FROM ICTransaction');
  assert.equal(assertReadOnlyQuery('WITH totals AS (SELECT 1) SELECT * FROM totals'), 'WITH totals AS (SELECT 1) SELECT * FROM totals');
  assert.throws(() => assertReadOnlyQuery('DELETE FROM ICTransaction'));
  assert.throws(() => assertReadOnlyQuery('SELECT 1; DROP TABLE ICTransaction'));
});

test('converts sql.js results and exposes the live schema', async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run('CREATE TABLE sample (id TEXT, amount REAL)');
  db.run("INSERT INTO sample VALUES ('one', 12.5)");

  assert.deepEqual(rowsFromResult(db.exec('SELECT * FROM sample')), [{ id: 'one', amount: 12.5 }]);
  assert.match(describeSchema(db, ['sample']), /Table sample: id TEXT, amount REAL/);
  db.close();
});

test('normalizes inconsistent chart responses from the model', () => {
  const monthlyRows = [
    { mois: '2026-01', net: 1200 },
    { mois: '2026-02', net: -300 },
  ];

  assert.deepEqual(
    normalizeAssistantResponse({
      text: 'Le graphique ci-dessous montre le solde mensuel.',
      type: 'text',
    }, monthlyRows),
    {
      text: 'Le graphique ci-dessous montre le solde mensuel.',
      type: 'chart',
      chartType: 'line',
      data: monthlyRows,
    },
  );

  const suppliedData = [{ name: 'Revenus', value: 42 }];
  assert.equal(
    normalizeAssistantResponse({ text: 'Résultat', type: 'text', chartType: 'pie', data: suppliedData }).type,
    'chart',
  );
});
