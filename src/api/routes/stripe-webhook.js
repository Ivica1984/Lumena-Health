import { Router } from 'express';
import Stripe from 'stripe';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

router.post('/', (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];

    // req.body ist hier ein Buffer (weil express.raw in index.js)
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );

    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      console.log('payment_success', {
        session: s.id,
        amount_total: s.amount_total,
        currency: s.currency,
        customer_email: s.customer_details?.email,
        metadata: s.metadata
      });
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('webhook_error', err?.message);
    return res.status(400).send(`Webhook Error: ${err?.message}`);
  }
});

export default router;
