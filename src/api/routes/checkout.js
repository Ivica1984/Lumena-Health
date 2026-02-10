// src/api/routes/checkout.js
import { Router } from 'express';
import Stripe from 'stripe';

const router = Router();

// Stripe-Client nur, wenn Secret gesetzt
const stripeKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = (stripeKey && /^sk_/.test(stripeKey)) ? new Stripe(stripeKey) : null; // keine apiVersion erzwingen

// CHF → Rappen (Stripe braucht integer; mind. 50 Rappen)
function toAmountChf(n) {
  const v = Math.round(Number(n) * 100);
  return Number.isFinite(v) && v >= 50 ? v : 50;
}

// POST /api/checkout  -> erstellt eine Stripe Checkout-Session
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];

    // Ohne Stripe-Key: Payment Link (falls gesetzt) oder Demo-Redirect
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
    const params = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      // sehr wichtig für success.html (Auto-Fill via session_id)
      success_url: `${base}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/cancel.html`,
      // sorgt dafür, dass Stripe die im Checkout eingegebene E-Mail nutzt
      customer_creation: 'always',
      // eigene Metadaten mitgeben (werden im Webhook & bei /session zurückgelesen)
      metadata: {
        city: String(body.city || ''),
        slot: String(body.slot || '')
      }
    };

    // Falls du im Frontend schon eine E-Mail sammelst (z. B. im Formular):
    if (typeof body.email === 'string' && body.email.trim()) {
      params.customer_email = body.email.trim();
    }

    const session = await stripe.checkout.sessions.create(params);

    return res.json({ id: session.id, url: session.url });
  } catch (err) {
    // Ausführliches Logging ins Render-Log
    console.error('checkout error:', err?.message, err?.type, err?.raw?.message);
    return res.status(500).json({ error: 'checkout_failed', detail: err?.raw?.message || err?.message });
  }
});

// GET /api/checkout/session?session_id=cs_xxx  -> E-Mail & Meta nach erfolgreichem Checkout auslesen
router.get('/session', async (req, res) => {
  try {
    if (!stripe) return res.status(400).json({ error: 'stripe_not_configured' });

    const sid = (req.query.session_id || '').toString();
    if (!sid) return res.status(400).json({ error: 'missing_session_id' });

    const session = await stripe.checkout.sessions.retrieve(sid);
    const email = session.customer_details?.email || session.customer_email || null;
    const city  = session.metadata?.city || null;
    const slot  = session.metadata?.slot || null;

    res.json({ email, city, slot });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
