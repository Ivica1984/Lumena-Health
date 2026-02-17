// src/api/routes/stripe-webhook.js (ESM)

import { Router } from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Stripe & Supabase Clients
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

// WICHTIG: Diese Route wird in server.js mit express.raw({ type:'application/json' }) gemountet!
router.post('/', async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return res.status(500).send('missing_webhook_secret');

    let event;
    try {
      // req.body ist hier ein Buffer (wegen express.raw)
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      console.error('webhook signature error:', err?.message);
      return res.status(400).send('signature_error');
    }

    // ---------- A) checkout.session.completed ----------
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object; // Stripe Checkout Session

      const email = s.customer_details?.email || s.customer_email || null;
      const city  = s.metadata?.city || null;
      const slot  = s.metadata?.slot || null;

      // Best-effort: Quittungs-URL evtl. schon hier verfügbar (nicht immer!)
      let receipt_url = null;
      try {
        if (s.payment_intent) {
          const pi = await stripe.paymentIntents.retrieve(
            s.payment_intent,
            { expand: ['charges'] }
          );
          receipt_url = pi?.charges?.data?.[0]?.receipt_url || null;
        }
      } catch (_) { /* ok */ }

      // ✅ NEU: payment_intent_id direkt speichern (Key für charge.succeeded Update)
      const payment_intent_id = s.payment_intent || null;

      // Idempotent speichern (Upsert via unique index auf session_id)
      const { error } = await supabase
        .from('orders')
        .upsert([{
          session_id: s.id,
          status: s.payment_status,      // z. B. 'paid'
          amount_total: s.amount_total,  // Cent
          currency: s.currency,
          email, city, slot,
          receipt_url,

          // ✅ NEU:
          payment_intent_id,
          charge_id: null
        }], { onConflict: 'session_id' });

      if (error) {
        console.error('supabase upsert error:', error);
        return res.status(500).send('supabase_error');
      }

      console.log('payment_success', { session_id: s.id, email, payment_intent_id });
      return res.status(200).send('ok');
    }

    // ---------- B) charge.succeeded (Quittungslink zuverlässig nachreichen) ----------
    if (event.type === 'charge.succeeded') {
      const ch = event.data.object;              // Stripe Charge
      const receipt_url = ch.receipt_url || null;
      const payment_intent_id = ch.payment_intent || null;

      try {
        // ✅ Robust: Update per payment_intent_id (ohne Stripe sessions.list!)
        if (payment_intent_id && receipt_url) {
          const { data, error } = await supabase
            .from('orders')
            .update({
              receipt_url,
              status: 'paid',
              charge_id: ch.id,
              payment_intent_id
            })
            .eq('payment_intent_id', payment_intent_id)
            .select('session_id');

          if (error) throw error;

          if (!data || data.length === 0) {
            // Fall: charge kam vor checkout.session.completed
            console.log('receipt_url_pending_no_order_yet', {
              payment_intent_id,
              charge_id: ch.id
            });
          } else {
            console.log('receipt_url_updated', {
              session_id: data[0].session_id,
              payment_intent_id,
              charge_id: ch.id
            });
          }
        } else {
          console.log('charge_succeeded_missing_data', {
            charge_id: ch.id,
            has_receipt_url: !!receipt_url,
            has_payment_intent: !!payment_intent_id
          });
        }
      } catch (e) {
        console.error('charge.succeeded handler error', e);
      }

      return res.status(200).send('ok');
    }

    // Andere Events ignorieren, aber 200 senden
    return res.status(200).send('ignored');
  } catch (e) {
    console.error('webhook error', e);
    return res.status(500).send('server_error');
  }
});

export default router;
