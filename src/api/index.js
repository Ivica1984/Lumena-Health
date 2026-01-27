import express from 'express';
import checkoutRouter from './routes/checkout.js';
import webhookRouter from './routes/stripe-webhook.js';
import filesRouter from './routes/files.js';
import aiRouter from './routes/ai.js';

const router = express.Router();

// 1) Webhook VOR dem JSON-Parser und mit express.raw() (Stripe-Signatur!)
router.use('/webhooks/stripe', express.raw({ type: 'application/json' }), webhookRouter);

// 2) Für alle anderen API-Routen: JSON-Parser
router.use(express.json({ limit: '2mb' }));

router.use('/checkout', checkoutRouter);
router.use('/files', filesRouter);
router.use('/ai', aiRouter);

export default router;
