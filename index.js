require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');
const dbHelper = require('./db/sqlite');
const { processChargeRefunded } = require('./lib/webhookHandler');

const app = express();

// initialize sqlite DB and tables
dbHelper.init();

const PORT = process.env.PORT || 3000;

// We need raw body for Stripe signature verification
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    console.warn('Missing stripe-signature header');
    return res.status(400).send('Missing stripe-signature header');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'charge.refunded') {
    try {
      await processChargeRefunded(event);
      return res.status(200).send('OK');
    } catch (err) {
      console.error('Processing error:', err);
      return res.status(500).send('Internal processing error');
    }
  }

  // Unhandled events
  res.status(200).send('Event ignored');
});

app.get('/inspect', async (req, res) => {
  const db = dbHelper.open();
  db.serialize(() => {
    db.all('SELECT * FROM orders', [], (err, orders) => {
      if (err) return res.status(500).json({ error: err.message });
      db.all('SELECT * FROM refunds', [], (err2, refunds) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ orders, refunds });
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Webhook listener running on port http://localhost:${PORT}`);
});
