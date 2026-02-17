// src/api/routes/ai.js
import { Router } from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false } }
);

function checksum(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

// OpenAI Call (ohne Diagnose, ohne PII)
async function callOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return '';

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Du bist eine gesundheitsbezogene Assistenz. Keine Diagnose, keine Therapieanweisungen. ' +
            'Gib kurze, laienverständliche Einordnung + 2–3 nächste Schritte. Keine PII nennen.'
        },
        { role: 'user', content: prompt }
      ]
    })
  }).then(r => r.json()).catch(() => ({}));

  return resp?.choices?.[0]?.message?.content || '';
}

// POST /api/ai/summarize
router.post('/summarize', async (req, res) => {
  try {
    const body = req.body || {};
    const reportId = String(body.reportId || 'r1');
    const modules = Array.isArray(body.modules) ? body.modules : [];
    const labs = body.labs || {};
    const pre = body.pre || {};

    if (!modules.length) {
      return res.status(400).json({ error: 'missing_modules' });
    }

    const insights = [];

    for (const m of modules) {
      // MVP: Regel-Tags (später pro Modul echte Regeln)
      const tags = { status: 'ok', reasons: [], nextSteps: [] };

      const prompt = `Modul: ${m}
Werte: ${JSON.stringify(labs[m] || labs)}
Präanalytik: ${JSON.stringify(pre)}
Liefere: 1) kurze laienverständliche Einordnung (3–5 Sätze, keine Diagnose),
2) 2–3 nächste Schritte (neutral), 3) Hinweis: bei Beschwerden ärztlich abklären.`;

      const text = await callOpenAI(prompt);

      insights.push({
        report_id: reportId,
        module: m,
        tags,
        text: text || 'Keine KI-Antwort erhalten.',
        provider: 'openai',
        checksum: checksum({ reportId, m, labs: labs[m] || labs, pre })
      });
    }

    // optional speichern (nur wenn ai_insights Tabelle existiert)
    try {
      await supabase.from('ai_insights').upsert(insights, { onConflict: 'report_id,module' });
    } catch (_) {
      // falls Tabelle noch nicht existiert, ignorieren
    }

    return res.json({ insights });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

export default router;
