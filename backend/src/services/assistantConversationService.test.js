const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const initSqlJs = require('sql.js');
const config = require('../config');
const { createAssistantConversationTables } = require('../migrations/006-create-assistant-conversations');
const service = require('./assistantConversationService');

test('persists, isolates and limits assistant conversations', async (t) => {
  const originalPath = config.DATA_DB_PATH;
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'icompta-assistant-'));
  config.DATA_DB_PATH = path.join(tempDirectory, 'data.sqlite');

  t.after(() => {
    config.DATA_DB_PATH = originalPath;
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  const SQL = await initSqlJs();
  const emptyDb = new SQL.Database();
  fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(emptyDb.export()));
  emptyDb.close();
  await createAssistantConversationTables();

  const first = await service.createConversation(1, 'Budget été');
  await service.addMessage(1, first.id, { role: 'user', content: 'Quel est mon budget ?' });
  await service.addMessage(1, first.id, {
    role: 'assistant',
    content: 'Voici le résultat.',
    type: 'chart',
    chartType: 'bar',
    data: [{ name: 'Budget', value: 100 }],
  });

  const restored = await service.listConversations(1);
  assert.equal(restored.length, 1);
  assert.equal(restored[0].title, 'Budget été');
  assert.equal(restored[0].messages.length, 2);
  assert.deepEqual(restored[0].messages[1].data, [{ name: 'Budget', value: 100 }]);
  assert.deepEqual(await service.listConversations(2), []);

  await service.renameConversation(1, first.id, 'Vacances');
  assert.equal((await service.listConversations(1))[0].title, 'Vacances');

  await Promise.all(Array.from({ length: 9 }, (_, index) => service.createConversation(1, `Discussion ${index + 2}`)));
  await assert.rejects(() => service.createConversation(1, 'Discussion 11'), /maximum 10/);

  await service.deleteConversation(1, first.id);
  assert.equal((await service.listConversations(1)).length, 9);
});
