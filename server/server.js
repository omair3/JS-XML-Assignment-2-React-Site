// Load env
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const marked = require('marked');

const app = express();

// runtime folders
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const LOGS_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

const LOGFILE = path.join(LOGS_DIR, 'app.log');

// uploads
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ok = ['image/png','image/jpeg','image/jpg','image/bmp'].includes(file.mimetype);
    cb(ok ? null : new Error('Invalid file type. Only PNG, JPG, or BMP allowed.'), ok);
  }
});

// logger
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(line.trim());
  try { fs.appendFileSync(LOGFILE, line); } catch {}
}

// middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ origin: (process.env.ALLOWED_ORIGIN || '*').split(',') }));


app.get('/', (_req, res) => res.render('landing'));
app.get('/analyze', (_req, res) => res.render('index', { result: null, error: null, errorDetails: null }));


async function doOCR(filePath, originalFilename) {
  log(`OCR: ${originalFilename}`);
  const form = new FormData();
  form.append('apikey', process.env.OCR_API_KEY || '');
  form.append('language', 'eng');
  const ext = path.extname(originalFilename).toLowerCase().replace('.', '');
  form.append('filetype', (ext === 'jpg' ? 'jpeg' : ext) || 'png');
  form.append('file', fs.createReadStream(filePath));

  const res = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST', body: form, headers: form.getHeaders(), timeout: 15000
  });
  const text = await res.text();
  if (!res.ok) { log(`OCR ERROR ${res.status}: ${text.slice(0,400)}`); throw new Error(`OCR failed ${res.status}`); }
  let json; try { json = JSON.parse(text); } catch { throw new Error('OCR invalid JSON'); }
  const out = json?.ParsedResults?.[0]?.ParsedText || '';
  if (!out) throw new Error('OCR returned no text');
  return out;
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url, { timeout: 10000 });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(rs => setTimeout(rs, 1000 * (i + 1)));
    }
  }
}


function toExtractedList(text) {
  return String(text)
    .replace(/\(.*?\)/g, '')
    .split(/[,;\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
}


async function checkIngredients(ingredients) {
  const terms = toExtractedList(ingredients);

  
  const harmfulPatterns = /poison|palm oil|aspartame|E621|monosodium glutamate|high fructose corn syrup|sodium benzoate|artificial flavor/i;

  const results = await Promise.all(terms.map(async (term) => {
    if (harmfulPatterns.test(term)) return { term, flagged: true };
    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1`;
      const j = await fetchWithRetry(url);
      const p = j.products?.[0];
      const flagged = !!p?.additives_tags?.length || harmfulPatterns.test(p?.ingredients_text || '');
      return { term, flagged };
    } catch {
      return { term, flagged: false };
    }
  }));

  return results.filter(r => r.flagged).map(r => r.term);
}

function riskFromFlags(flags) {
  if (!flags || !flags.length) return 'low';
  return flags.length >= 4 ? 'high' : 'medium';
}

async function getExplanation(flags) {
  const prompt = flags.length
    ? `Explain simply the health concerns of: ${flags.join(', ')}. Keep it short and friendly. Use markdown bullets.`
    : 'No harmful ingredients flagged based on our checks. Share a short friendly note about balanced eating.';
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY || ''}`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      timeout: 15000
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`AI ${res.status}: ${raw.slice(0,200)}`);
    let j; try { j = JSON.parse(raw); } catch { return marked.parse('Explanation unavailable right now.'); }
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return marked.parse(text || 'Explanation unavailable right now.');
  } catch {
    return marked.parse('Explanation unavailable right now.');
  }
}


app.post('/analyze', upload.single('image'), async (req, res) => {
  try {
    let ingredientText = req.body.ingredients?.trim() || '';
    if (req.file) {
      ingredientText = await doOCR(req.file.path, req.file.originalname);
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    if (!ingredientText) throw new Error('Please provide ingredients or a clear label image.');

    const flags = await checkIngredients(ingredientText);
    const note = await getExplanation(flags);

    res.render('index', { result: { text: ingredientText, flags, note }, error: null, errorDetails: null });
  } catch (err) {
    const dev = process.env.NODE_ENV === 'development';
    res.render('index', {
      result: null,
      error: 'Something went wrong. Check your input or try again.',
      errorDetails: dev ? { message: err.message } : null
    });
  }
});

// --- simple dev logs ---
app.get('/debug/logs', (req, res) => {
  if (process.env.NODE_ENV !== 'development') return res.status(404).send('Not available');
  try {
    const logs = fs.readFileSync(LOGFILE, 'utf8').slice(-20000);
    res.type('text').send(logs);
  } catch (e) {
    res.status(500).send('No logs: ' + e.message);
  }
});


const SCANS = []; 


app.post('/api/analyze/text', async (req, res) => {
  try {
    const ingredientsText = String(req.body?.ingredientsText || '').trim();
    if (!ingredientsText) return res.status(400).json({ error: 'ingredientsText is required' });

    const flags = await checkIngredients(ingredientsText);
    const riskLevel = riskFromFlags(flags);
    const geminiSummaryHtml = await getExplanation(flags);
    const out = {
      id: Date.now().toString(36),
      inputType: 'text',
      extractedIngredients: toExtractedList(ingredientsText),
      flags,
      riskLevel,
      geminiSummaryHtml,
      createdAt: new Date().toISOString()
    };
    SCANS.unshift(out); if (SCANS.length > 50) SCANS.pop();
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: 'Failed to analyze text' });
  }
});

// IMAGE analysis (OCR + same checks)
app.post('/api/analyze/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'image file is required' });

    // OCR
    const ocrText = await doOCR(req.file.path, req.file.originalname);
    try { fs.unlinkSync(req.file.path); } catch {}

    // Analyze
    const flags = await checkIngredients(ocrText);
    const riskLevel = riskFromFlags(flags);
    const geminiSummaryHtml = await getExplanation(flags);

    const out = {
      id: Date.now().toString(36),
      inputType: 'image',
      extractedIngredients: toExtractedList(ocrText),
      flags,
      riskLevel,
      geminiSummaryHtml,
      createdAt: new Date().toISOString()
    };

    SCANS.unshift(out); if (SCANS.length > 50) SCANS.pop();
    res.json(out);
  } catch (e) {
    console.error('API /api/analyze/image ERROR:', e.message);
    res.status(500).json({ error: 'Failed to analyze image' });
  }
});

// history
app.get('/api/scans', (_req, res) => res.json(SCANS));

// start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => log(`Server started at http://localhost:${PORT}`));
