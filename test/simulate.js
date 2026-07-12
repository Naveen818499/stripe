// Simulation test to exercise idempotency by calling the processing function twice
const { processChargeRefunded } = require('../lib/webhookHandler');

async function run() {
  // A sample event shape similar to Stripe's charge.refunded
  const event = {
    type: 'charge.refunded',
    data: {
      object: {
        id: 'ch_test_123',
        amount: 2000,
        amount_refunded: 500,
        metadata: { order_id: 'order_123' },
        refunds: {
          data: [
            { id: 're_test_1', amount: 500 }
          ]
        }
      }
    }
  };

  console.log('--- First processing (should process) ---');
  await processChargeRefunded(event);

  console.log('--- Second processing (should skip duplicate) ---');
  await processChargeRefunded(event);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
