const fs = require('fs');
const crypto = require('crypto');
const initSqlJs = require('sql.js');
const config = require('../config');

const MAX_CONVERSATIONS = 10;
let writeQueue = Promise.resolve();

function withWriteLock(operation) {
  const next = writeQueue.then(operation, operation);
  writeQueue = next.catch(() => {});
  return next;
}

async function openDataDb() {
  const SQL = await initSqlJs();
  return new SQL.Database(fs.readFileSync(config.DATA_DB_PATH));
}

function queryRows(db, sql, params = []) {
  const statement = db.prepare(sql);
  try {
    statement.bind(params);
    const rows = [];
    while (statement.step()) rows.push(statement.getAsObject());
    return rows;
  } finally {
    statement.free();
  }
}

function persistAndClose(db) {
  fs.writeFileSync(config.DATA_DB_PATH, Buffer.from(db.export()));
  db.close();
}

function parseMessage(row) {
  let data;
  if (row.data_json) {
    try { data = JSON.parse(row.data_json); } catch { data = undefined; }
  }
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    type: row.type || undefined,
    chartType: row.chart_type || undefined,
    data,
    timestamp: row.created_at,
  };
}

async function listConversations(userId) {
  const db = await openDataDb();
  try {
    const conversations = queryRows(db,
      `SELECT id, title, created_at AS createdAt, updated_at AS updatedAt
       FROM assistant_conversations WHERE user_id = ? ORDER BY created_at ASC`,
      [userId],
    );
    const messages = queryRows(db,
      `SELECT m.* FROM assistant_messages m
       JOIN assistant_conversations c ON c.id = m.conversation_id
       WHERE c.user_id = ? ORDER BY m.created_at ASC`,
      [userId],
    );
    const byConversation = new Map(conversations.map(item => [item.id, []]));
    messages.forEach(row => byConversation.get(row.conversation_id)?.push(parseMessage(row)));
    return conversations.map(item => ({ ...item, messages: byConversation.get(item.id) || [] }));
  } finally {
    db.close();
  }
}

async function createConversation(userId, title = 'Nouvelle discussion') {
  return withWriteLock(async () => {
    const db = await openDataDb();
    try {
      const countRows = queryRows(db,
        'SELECT COUNT(*) AS count FROM assistant_conversations WHERE user_id = ?',
        [userId],
      );
      if (Number(countRows[0]?.count || 0) >= MAX_CONVERSATIONS) {
        const error = new Error('Vous pouvez ouvrir au maximum 10 discussions.');
        error.status = 409;
        throw error;
      }
      const now = new Date().toISOString();
      const conversation = { id: crypto.randomUUID(), title: title.trim().slice(0, 80) || 'Nouvelle discussion', createdAt: now, updatedAt: now, messages: [] };
      db.run(
        'INSERT INTO assistant_conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [conversation.id, userId, conversation.title, now, now],
      );
      persistAndClose(db);
      return conversation;
    } catch (error) {
      db.close();
      throw error;
    }
  });
}

async function renameConversation(userId, conversationId, title) {
  return withWriteLock(async () => {
    const db = await openDataDb();
    try {
      const normalizedTitle = String(title || '').trim().slice(0, 80);
      if (!normalizedTitle) {
        const error = new Error('Le nom de la discussion est obligatoire.');
        error.status = 400;
        throw error;
      }
      const now = new Date().toISOString();
      db.run(
        'UPDATE assistant_conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?',
        [normalizedTitle, now, conversationId, userId],
      );
      if (db.getRowsModified() === 0) {
        const error = new Error('Discussion introuvable.');
        error.status = 404;
        throw error;
      }
      persistAndClose(db);
      return { id: conversationId, title: normalizedTitle, updatedAt: now };
    } catch (error) {
      db.close();
      throw error;
    }
  });
}

async function deleteConversation(userId, conversationId) {
  return withWriteLock(async () => {
    const db = await openDataDb();
    try {
      const owned = queryRows(db,
        'SELECT id FROM assistant_conversations WHERE id = ? AND user_id = ?',
        [conversationId, userId],
      );
      if (owned.length === 0) {
        const error = new Error('Discussion introuvable.');
        error.status = 404;
        throw error;
      }
      db.run('DELETE FROM assistant_messages WHERE conversation_id = ?', [conversationId]);
      db.run('DELETE FROM assistant_conversations WHERE id = ? AND user_id = ?', [conversationId, userId]);
      persistAndClose(db);
    } catch (error) {
      db.close();
      throw error;
    }
  });
}

async function getConversationMessages(userId, conversationId) {
  const db = await openDataDb();
  try {
    const owned = queryRows(db,
      'SELECT id FROM assistant_conversations WHERE id = ? AND user_id = ?',
      [conversationId, userId],
    );
    if (owned.length === 0) {
      const error = new Error('Discussion introuvable.');
      error.status = 404;
      throw error;
    }
    return queryRows(db,
      'SELECT * FROM assistant_messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversationId],
    ).map(parseMessage);
  } finally {
    db.close();
  }
}

async function addMessage(userId, conversationId, message) {
  return withWriteLock(async () => {
    const db = await openDataDb();
    try {
      const owned = queryRows(db,
        'SELECT id FROM assistant_conversations WHERE id = ? AND user_id = ?',
        [conversationId, userId],
      );
      if (owned.length === 0) {
        const error = new Error('Discussion introuvable.');
        error.status = 404;
        throw error;
      }
      const stored = {
        id: crypto.randomUUID(),
        role: message.role,
        content: message.content,
        type: message.type || null,
        chartType: message.chartType || null,
        data: Array.isArray(message.data) ? message.data : undefined,
        timestamp: new Date().toISOString(),
      };
      db.run(
        `INSERT INTO assistant_messages
         (id, conversation_id, role, content, type, chart_type, data_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [stored.id, conversationId, stored.role, stored.content, stored.type, stored.chartType, stored.data ? JSON.stringify(stored.data) : null, stored.timestamp],
      );
      db.run('UPDATE assistant_conversations SET updated_at = ? WHERE id = ?', [stored.timestamp, conversationId]);
      persistAndClose(db);
      return stored;
    } catch (error) {
      db.close();
      throw error;
    }
  });
}

module.exports = {
  MAX_CONVERSATIONS,
  listConversations,
  createConversation,
  renameConversation,
  deleteConversation,
  getConversationMessages,
  addMessage,
};
