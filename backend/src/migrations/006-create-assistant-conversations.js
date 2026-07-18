const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('../config');

async function createAssistantConversationTables() {
  if (!fs.existsSync(config.DATA_DB_PATH)) return;

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(config.DATA_DB_PATH));

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS assistant_conversations (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user
        ON assistant_conversations(user_id, updated_at);

      CREATE TABLE IF NOT EXISTS assistant_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        type TEXT,
        chart_type TEXT,
        data_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(conversation_id) REFERENCES assistant_conversations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation
        ON assistant_messages(conversation_id, created_at);
    `);

    fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(db.export()));
    console.log('Migration completed: assistant conversation tables created');
  } finally {
    db.close();
  }
}

module.exports = { createAssistantConversationTables };
