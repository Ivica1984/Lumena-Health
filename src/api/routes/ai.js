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

// OpenAI Call (Debug-Logs inklusive)
async function callOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    console.error('OPENAI_API_KEY missing in Render ENV');
    return '';
  }

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
            'Schreibe kurz und laienverständlich. Gib am Ende 3 nächste Schritte. Keine PII nennen.'
        },
        { role: 'user', content: prompt }
      ]
    })
  });

  const raw = await resp.text();

  // >>> Debug Logs (damit wir exakt sehen, warum es leer ist)
  console.log('OPENAI_STATUS', resp.status);
  if (!resp.ok) console.log('OPENAI_ERROR_BODY', raw.slice(0, 800));

  if (!resp.ok) return '';

  let json = {};
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.log('OPENAI_PARSE_ERROR', String(e?.message || e));
    return '';
  }

  const out = json?.choices?.[0]?.message?.content || '';
  console.log('OPENAI_TEXT_LEN', out.length);

  return out;
}

// POST /api/ai/summarize
router.post('/summarize', async (req, res) => {
  try {
    const body = req.body || {};

    const reportId = String(body.reportId || 'r1');
    const modules = Array.isArray(body.modules) ? body.modules : [];
    const labs = body.labs || {};
    const pre = body.pre || {};
    const order = body.order || {};

    if (!modules.length) {
      return res.status(400).json({ error: 'missing_modules' });
    }

    // Gesamt-Prompt: Präanalytik + Werte pro Modul + (optional) Bestell-Kontext
    const prompt =
`Aufgabe: Erstelle eine KI-Zusammenfassung (ohne Diagnose) basierend auf Präanalytik + Screening-Werten.
Kontext:
- Präanalytik: ${JSON.stringify(pre)}
- Bestellung/Logistik (optional): ${JSON.stringify(order)}

Werte nach Modulen:
${JSON.stringify(labs, null, 2)}

Format:
1) Kurze Gesamteinordnung (3–5 Sätze).
2) Modul-Sektionen (je Modul 2–3 Bulletpoints: was auffällig, was ok, Kontext durch Präanalytik).
3) 3 nächste Schritte (konkret, neutral).
4) Sicherheitshinweis: bei Beschwerden ärztlich abklären.`;

    const summary = await callOpenAI(prompt);

    // Optional in Supabase speichern (wenn Tabelle existiert)
    const record = {
      report_id: reportId,
      module: 'summary',
      tags: { modules, pre, order },
      text: summary || 'Keine KI-Antwort erhalten.',
      provider: 'openai',
      checksum: checksum({ reportId, modules, labs, pre, order })
    };

    try {
      await supabase.from('ai_insights').upsert([record], { onConflict: 'report_id,module' });
    } catch (_) {
      // Tabelle fehlt? dann ignorieren
    }

    // Antwort an Frontend
    return res.json({
      provider: 'openai',
      reportId,
      summary: record.text
    });

  } catch (e) {
    console.error('AI summarize error:', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

export default router;
