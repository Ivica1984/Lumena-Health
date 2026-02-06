// src/api/routes/orders.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

router.get('/list', async (req, res) => {
  const email = (req.query.email || '').toString().trim();
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);

  if (!email || email.indexOf('@') === -1 || email.indexOf('.') === -1) {
    return res.status(400).json({ error: 'invalid_email' });
  }

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json({ orders: data || [] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;

