import { Router } from 'express';
const router = Router();
router.post('/signed-upload', (_req, res) => {
  res.status(501).json({ error: 'Supabase nicht konfiguriert' });
});
export default router;
