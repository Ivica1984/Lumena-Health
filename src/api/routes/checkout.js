import { Router } from 'express';
import Stripe from 'stripe';

const router = Router();

// 1) Stripe-Client nur, wenn Secret gesetzt
const stripeKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2024-11-20' }) : null;

// 2) Hilfsfunktion: CHF-Betrag (Rappen)
function toAmountChf(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  return v * 100; // CHF → Rappen
}

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];

    // Fallbacks, wenn Stripe nicht konfiguriert ist
    if (!stripe) {
      const link = process.env.STRIPE_PAYMENT_LINK || '';
      if (link) return res.json({ url: link });   // Payment Link
      return res.json({ url: '/success.html' });  // Demo-Fallback
    }

    // 3) Line Items aus deinem Warenkorb
    const line_items = items.map(i => ({
      quantity: 1,
      price_data: {
        currency: 'chf',
        product_data: { name: String(i.name || 'Position') },
        unit_amount: toAmountChf(i.price)
      }
    }));

    if (line_items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const publicUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

    // 4) Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      // optional: locale: 'de',
      success_url: `${publicUrl}/success.html`,
      cancel_url: `${publicUrl}/`,
      metadata: {
        city: String(body.city || ''),
        slot: String(body.slot || '')
      }
    });

    return res.json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('checkout error', err);
    return res.status(500).json({ error: 'checkout_failed' });
  }
});

export default router;
