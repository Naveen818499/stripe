const dbHelper = require('../db/sqlite');
const { open } = dbHelper;

function nowISO() {
  return new Date().toISOString();
}

function getOrder(db, orderId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM orders WHERE order_id = ?', [orderId], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function insertOrderStub(db, orderId, chargeId, amount) {
  return new Promise((resolve, reject) => {
    const now = nowISO();
    db.run(
      'INSERT OR REPLACE INTO orders(order_id, charge_id, amount, status, refunded_amount, last_refunded_at) VALUES(?,?,?,?,?,?)',
      [orderId, chargeId, amount || 0, 'MISSING_ORDER_STUB', 0, now],
      function (err) {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

function recordRefund(db, refundId, chargeId, orderId, amount) {
  return new Promise((resolve, reject) => {
    const now = nowISO();
    db.run(
      'INSERT INTO refunds(refund_id, charge_id, order_id, amount, processed_at) VALUES(?,?,?,?,?)',
      [refundId, chargeId, orderId, amount, now],
      function (err) {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

function refundExists(db, refundId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT 1 FROM refunds WHERE refund_id = ?', [refundId], (err, row) => {
      if (err) return reject(err);
      resolve(!!row);
    });
  });
}

function updateOrderAfterRefund(db, orderId, chargeId, refundedAmount, isFull) {
  return new Promise((resolve, reject) => {
    const status = isFull ? 'refunded' : 'partially_refunded';
    const now = nowISO();
    db.run(
      'UPDATE orders SET charge_id = ?, refunded_amount = ?, status = ?, last_refunded_at = ? WHERE order_id = ?',
      [chargeId, refundedAmount, status, now, orderId],
      function (err) {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

async function processChargeRefunded(event) {
  const db = open();
  const charge = event.data.object;
  const chargeId = charge.id;
  const chargeAmount = charge.amount; // in cents
  const amountRefundedTotal = charge.amount_refunded;
  const refunds = (charge.refunds && charge.refunds.data) || [];

  // Determine order id from metadata
  const orderId = (charge.metadata && charge.metadata.order_id) || null;

  if (!orderId) {
    console.warn('No order_id found in charge.metadata; recording refund as orphan');
  }

  for (const r of refunds) {
    const refundId = r.id;
    const refundAmount = r.amount;

    const exists = await refundExists(db, refundId);
    if (exists) {
      console.log(`Skipping already-processed refund ${refundId}`);
      continue;
    }

    // If orderId provided but not in DB, create stub.
    if (orderId) {
      const existingOrder = await getOrder(db, orderId);
      if (!existingOrder) {
        console.warn(`Order ${orderId} not found; creating stub.`);
        await insertOrderStub(db, orderId, chargeId, chargeAmount);
      }
    }

    // Decide full vs partial: if amount_refunded (total on charge) >= charge.amount then treat as full
    const isFull = amountRefundedTotal >= chargeAmount;

    // Record refund
    await recordRefund(db, refundId, chargeId, orderId || 'UNKNOWN_ORDER', refundAmount);

    // Update order if we have one
    if (orderId) {
      const refundedAmount = amountRefundedTotal;
      await updateOrderAfterRefund(db, orderId, chargeId, refundedAmount, isFull);
      console.log(`Processed refund ${refundId} for order ${orderId}: ${refundAmount} (isFull=${isFull})`);
    } else {
      // No order id: keep record in refunds table and log
      console.log(`Recorded orphan refund ${refundId}: ${refundAmount}`);
    }
  }

  db.close();
}

module.exports = { processChargeRefunded };
