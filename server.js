import express from 'express';
import path from 'path';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import apiRouter from './src/api/index.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRouter);
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Swiss Health Flow running on http://localhost:${PORT}`);
});