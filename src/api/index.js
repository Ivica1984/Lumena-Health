import express from 'express';
import checkoutRouter from './routes/checkout.js';
import filesRouter from './routes/files.js';
import aiRouter from './routes/ai.js';

const router = express.Router();

// KEIN Webhook-Mount hier!
router.use(express.json({ limit: '2mb' }));

router.use('/checkout', checkoutRouter);
router.use('/files', filesRouter);
router.use('/ai', aiRouter);

export default router;
