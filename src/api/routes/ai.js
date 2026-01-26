import { Router } from 'express';
const router = Router();
router.post('/comment', (_req, res) => {
  res.json({ text: '(Demo) KI-Kommentar – Konfiguration folgt.' });
});
export default router;
