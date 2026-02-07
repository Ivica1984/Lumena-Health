import { Router } from 'express';
import Stripe from 'stripe';

const router = Router();

// Stripe-Client nur, wenn Secret gesetzt
const stripeKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = (stripeKey && /^sk_/.test(stripeKey)) ? new Stripe(stripeKey) : null; // kein apiVersion erzwingen

// CHF → Rappen (Stripe braucht integer; min 50 Rappen)
function toAmountChf(n) {
  const v = Math.round(Number(n) * 100);
  return Number.isFinite(v) && v >= 50 ? v : 50;
}

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];

    // Ohne Stripe-Key: Payment Link (falls gesetzt) oder Demo
    if (!stripe) {
      const link = process.env.STRIPE_PAYMENT_LINK || '';
      return res.json({ url: link || '/success.html' });
    }

    // Warenkorb in Stripe Line Items umwandeln
    const line_items = items.map(i => ({
      quantity: 1,
      price_data: {
        currency: 'chf',
        product_data: { name: String(i?.name || 'Position') },
        unit_amount: toAmountChf(i?.price)
      }
    }));

    if (!line_items.length) {
      return res.status(400).json({ error: 'cart_empty' });
    }

    // success/cancel URLs
    const base = process.env.PUBLIC_BASE_URL || `https://${req.headers.host || 'localhost:3000'}`;

    // Checkout Session erstellen
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: `${base}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/`,
      metadata: {
        city: String(body.city || ''),
        slot: String(body.slot || '')
      }
    });

    return res.json({ id: session.id, url: session.url });
  } catch (err) {
    // Ausführliches Logging ins Render-Log
    console.error('checkout error:', err?.message, err?.type, err?.raw?.message);
    return res.status(500).json({ error: 'checkout_failed', detail: err?.raw?.message || err?.message });
  }
});

export default router;
