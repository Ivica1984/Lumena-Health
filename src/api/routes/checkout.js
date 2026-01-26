import { Router } from 'express';
const router = Router();
router.post('/', (_req, res) => {
  const url = process.env.STRIPE_PAYMENT_LINK || '/success.html';
  res.json({ url });
});
export default router;
