import express from 'express';
import checkoutRouter from './routes/checkout.js';
import webhookRouter from './routes/stripe-webhook.js';
import filesRouter from './routes/files.js';
import aiRouter from './routes/ai.js';

const router = express.Router();
router.use(express.json({ limit: '2mb' }));
router.use('/checkout', checkoutRouter);
router.use('/webhooks/stripe', webhookRouter);
router.use('/files', filesRouter);
router.use('/ai', aiRouter);
export default router;
