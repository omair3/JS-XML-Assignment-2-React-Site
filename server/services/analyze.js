// server/services/analyze.js
require('dotenv').config();
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const marked = require('marked');

const LOGDIR = path.join(__dirname, '..', 'logs');
const LOGFILE = path.join(LOGDIR, 'app.log');
try { if (!fs.existsSync(LOGDIR)) fs.mkdirSync(LOGDIR, { recursive: true }); } catch {}
function log(msg) {
  const t = new Date().toISOString();
  const line = `[${t}] ${msg}\n`;
  console.log(line.trim());
  try { fs.appendFileSync(LOGFILE, line); } catch {}
}


function normalizeIngredientsText(s) {
  return String(s || '')
    
    .replace(/^\s*ingredients?\b[:\s-]*/i, '')
    .replace(/\bcontains\s+\d+%[^:]*:\s*/i, '')
    .replace(/[·•]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function listForDisplay(text) {
  const t = normalizeIngredientsText(text);
  return t
    .split(/[,;\n]+/)
    .map(s => s.trim().replace(/^and\s+/i, '').replace(/\.$/, ''))
    .filter(Boolean);
}


async function fetchJsonWithRetry(url, { method='GET', body=null, headers={}, timeout=15000, retries=2 } = {}) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { method, body, headers, timeout });
      const txt = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.slice(0,200)}`);
      return JSON.parse(txt);
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}


async function doOCR(filePath, originalFilename) {
  log(`OCR: ${originalFilename}`);
  const form = new FormData();
  form.append('apikey', process.env.OCR_API_KEY || '');
  form.append('language', 'eng');
  const ext = path.extname(originalFilename).toLowerCase().replace('.', '');
  form.append('filetype', ext === 'jpg' ? 'jpeg' : (ext || 'png'));
  form.append('file', fs.createReadStream(filePath));

  const res = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
    timeout: 25000
  });
  const raw = await res.text();
  if (!res.ok) {
    log(`OCR ERROR ${res.status}: ${raw.slice(0,300)}`);
    throw new Error(`OCR failed ${res.status}`);
  }
  let json;
  try { json = JSON.parse(raw); } catch {
    log(`OCR bad JSON: ${raw.slice(0,300)}`);
    throw new Error('OCR invalid JSON');
  }
  const text = json?.ParsedResults?.[0]?.ParsedText || '';
  if (!text) throw new Error('No text found by OCR');
  log(`OCR OK (len=${text.length})`);
  return text;
}


async function checkWithOFF(ingredientsText) {
  const phrases = listForDisplay(ingredientsText);
  const flags = new Set();

  await Promise.all(phrases.map(async (phrase) => {
    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(phrase)}&search_simple=1&action=process&json=1`;
      const j = await fetchJsonWithRetry(url, { timeout: 12000, retries: 1 });
      const p = j.products?.[0];
      if (!p) return;

      const additives = Array.isArray(p.additives_tags) ? p.additives_tags : [];
      const analysis = Array.isArray(p.ingredients_analysis_tags) ? p.ingredients_analysis_tags : [];

      if (additives.length > 0 || analysis.length > 0) flags.add(phrase);
    } catch { /* best effort */ }
  }));

  return Array.from(flags);
}


async function classifyWithAI(ingredientsText) {
  const raw = normalizeIngredientsText(ingredientsText);

  const prompt = `
You are a nutrition safety checker.

Task A — Parse:
- Extract a clean, de-duplicated list of ingredient PHRASES from the text.
- Keep multi-word phrases (e.g., "palm oil", "high fructose corn syrup", "sodium stearoyl lactylate").
- Normalize abbreviations (e.g., "msg" → "monosodium glutamate (msg)").
- Lowercase all phrases.

Task B — Classify each phrase:
- Return "harmful": true/false for a general audience, and a short neutral reason (≤ 20 words).
- SAFETY-FIRST RULE: If a phrase clearly indicates toxicity or a non-food substance (e.g., "poison", "bleach", "antifreeze", "cyanide", "arsenic", "mercury", "lead", "lye"), mark harmful=true.
- Consider widely-discussed concern categories (not exhaustive): added sugars/syrups, partially/fully hydrogenated fats, artificial colors/dyes, artificial flavors, preservatives, emulsifiers/stabilizers, nitrites/nitrates, high-sodium leaveners, ultra-processed additives.
- If genuinely unsure, set harmful=false. Do not speculate.

Return ONLY strict JSON:
{
  "parsedIngredients": ["phrase1","phrase2",...],
  "items": [
    { "term":"phrase1", "harmful": true|false, "reason":"short reason" }
  ]
}

Ingredient text:
"""${raw}"""
`.trim();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
  const headers = { 'Content-Type': 'application/json' };
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.0
    }
  });
  const qs = `?key=${process.env.GEMINI_API_KEY || ''}`;

  try {
    const res = await fetch(url + qs, { method: 'POST', headers, body, timeout: 25000 });
    const text = await res.text();
    if (!res.ok) throw new Error(`AI ${res.status}: ${text.slice(0,200)}`);

    let data;
    try { data = JSON.parse(text); }
    catch {
      const m = text.match(/\{[\s\S]*\}/);
      data = m ? JSON.parse(m[0]) : { parsedIngredients: [], items: [] };
    }

    const parsedIngredients = Array.isArray(data.parsedIngredients) ? data.parsedIngredients : [];
    const items = Array.isArray(data.items) ? data.items : [];
    const flags = items.filter(x => x.harmful).map(x => x.term);

    return { parsedIngredients, items, flags, source: 'ai' };
  } catch (e) {
    log(`AI classify error (timeout/network). Falling back. Reason: ${String(e.message).replace(/key=[^&]+/i,'key=***')}`);

    
    const parsedIngredients = listForDisplay(raw);
    let flags = [];
    try { flags = await checkWithOFF(raw); } catch {}
    return { parsedIngredients, items: [], flags, source: flags.length ? 'off' : 'fallback' };
  }
}


async function checkIngredients(ingredientsText) {
  const { flags } = await classifyWithAI(ingredientsText);
  return flags;
}


async function getExplanation(flaggedTerms) {
  const prompt = flaggedTerms?.length
    ? `Explain briefly for a general audience why these may be concerning: ${flaggedTerms.join(', ')}.
Use short bullets, neutral tone, no medical claims. Markdown only. <= 120 words.`
    : `No harmful ingredients were flagged. Provide a short, friendly note (<= 60 words) about balanced eating and reading labels. Markdown only.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
  const headers = { 'Content-Type':'application/json' };
  const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
  const qs = `?key=${process.env.GEMINI_API_KEY || ''}`;

  try {
    const r = await fetch(url + qs, { method: 'POST', headers, body, timeout: 25000 });
    const raw = await r.text();
    if (!r.ok) {
      log(`AI explain error ${r.status}. Using fallback note.`);
      return marked.parse('Unable to generate explanation right now.');
    }
    let j;
    try { j = JSON.parse(raw); } catch { j = null; }
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || raw;
    return marked.parse(text);
  } catch (e) {
    log(`AI explain timeout/network. Using fallback note. ${e.message}`);
    return marked.parse('Unable to generate explanation right now.');
  }
}

module.exports = {
  log,
  doOCR,
  normalizeIngredientsText,
  listForDisplay,
  checkWithOFF,
  classifyWithAI,
  checkIngredients,
  getExplanation
};
