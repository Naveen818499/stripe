# Stripe webhook refund handler

This small service provides a single endpoint to receive Stripe `charge.refunded` webhooks, verify the signature, and persist refund and order state into a local SQLite database.

Quick start:

1. Install dependencies:

```bash
npm install
```

2. Set environment variables in a `.env` file:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PORT=3000
```

3. Run the server:

```bash
node index.js
```

4. Use the Stripe CLI to forward events:

```bash
stripe login
stripe listen --forward-to localhost:3000/webhook
```

Behavior for missing orders: if a webhook references an `order_id` (via `charge.metadata.order_id`) that doesn't exist locally, the service creates a stub order with status `MISSING_ORDER_STUB`, records the refund in the `refunds` table, and updates the stub's refunded amount — this avoids repeated Stripe retries while retaining evidence to investigate the missing order.

Testing idempotency locally (no Stripe CLI needed):

```bash
node test/simulate.js
```

This will call the internal processing twice; the second call will detect the refund record and skip re-processing.
