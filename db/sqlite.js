const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'db', 'webhooks.sqlite');

function open() {
  const db = new sqlite3.Database(DB_PATH);
  return db;
}

function init() {
  const db = open();
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      charge_id TEXT UNIQUE,
      amount INTEGER,
      status TEXT,
      refunded_amount INTEGER DEFAULT 0,
      last_refunded_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS refunds (
      refund_id TEXT PRIMARY KEY,
      charge_id TEXT,
      order_id TEXT,
      amount INTEGER,
      processed_at TEXT
    )`);
  });
  return db;
}

module.exports = { open, init, DB_PATH };
