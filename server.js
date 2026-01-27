// server.js  (ESM)

import express from 'express';
import path from 'path';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import apiRouter from './src/api/index.js';
import webhookRouter from './src/api/routes/stripe-webhook.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();

// Logging
app.use(morgan('dev'));

// 1) WEBHOOK VOR dem JSON-Parser und mit express.raw() (für Stripe-Signatur!)
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), webhookRouter);

// 2) JSON-Parser für alle anderen API-Routen
app.use(express.json({ limit: '2mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API-Router (ohne Webhook)
app.use('/api', apiRouter);

// Healthcheck
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Swiss Health Flow running on http://localhost:${PORT}`);
});

export default app;
