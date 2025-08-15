// server/routes/api.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');

const Scan = require('../models/Scan');
const {
  log,
  doOCR,
  listForDisplay,
  classifyWithAI,
  getExplanation,
} = require('../services/analyze');

const router = express.Router();


const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ok = ['image/png', 'image/jpeg', 'image/jpg', 'image/bmp'].includes(file.mimetype);
    cb(ok ? null : new Error('Invalid file type (PNG/JPG/BMP only).'), ok);
  },
});

function pickRiskLevel(flags) {
  if (!flags || !flags.length) return 'low';
  if (flags.length >= 4) return 'high';
  return 'medium';
}


router.post('/analyze/text', async (req, res) => {
  try {
    const raw = String(req.body?.ingredientsText || '').trim();
    if (!raw) return res.status(400).json({ error: 'ingredientsText is required' });

    
    const { parsedIngredients, flags } = await classifyWithAI(raw);
    const extracted = parsedIngredients?.length ? parsedIngredients : listForDisplay(raw);
    const geminiSummaryHtml = await getExplanation(flags);
    const riskLevel = pickRiskLevel(flags);

    const scan = await Scan.create({
      inputType: 'text',
      rawInput: raw,
      extractedIngredients: extracted,
      flags,
      riskLevel,
      geminiSummaryHtml,
    });

    res.json({
      id: scan._id,
      inputType: scan.inputType,
      extractedIngredients: scan.extractedIngredients,
      flags: scan.flags,
      riskLevel: scan.riskLevel,
      geminiSummaryHtml: scan.geminiSummaryHtml,
      createdAt: scan.createdAt,
    });
  } catch (e) {
    log('API /analyze/text error: ' + e.message);
    res.status(500).json({ error: 'Failed to analyze text' });
  }
});


router.post('/analyze/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'image file is required' });

    const ocrText = await doOCR(req.file.path, req.file.originalname);
    try { fs.unlinkSync(req.file.path); } catch {}

    const { parsedIngredients, flags } = await classifyWithAI(ocrText);
    const extracted = parsedIngredients?.length ? parsedIngredients : listForDisplay(ocrText);
    const geminiSummaryHtml = await getExplanation(flags);
    const riskLevel = pickRiskLevel(flags);

    const scan = await Scan.create({
      inputType: 'image',
      rawInput: req.file.originalname,
      extractedIngredients: extracted,
      flags,
      riskLevel,
      geminiSummaryHtml,
    });

    res.json({
      id: scan._id,
      inputType: scan.inputType,
      extractedIngredients: scan.extractedIngredients,
      flags: scan.flags,
      riskLevel: scan.riskLevel,
      geminiSummaryHtml: scan.geminiSummaryHtml,
      createdAt: scan.createdAt,
    });
  } catch (e) {
    log('API /analyze/image error: ' + e.message);
    res.status(500).json({ error: 'Failed to analyze image' });
  }
});


router.get('/scans', async (_req, res) => {
  const scans = await Scan.find().sort({ createdAt: -1 }).limit(50).lean();
  res.json(scans.map(s => ({
    id: s._id,
    inputType: s.inputType,
    flags: s.flags,
    riskLevel: s.riskLevel,
    createdAt: s.createdAt,
    extractedIngredientsCount: s.extractedIngredients?.length || 0,
  })));
});


router.get('/scans/:id', async (req, res) => {
  const s = await Scan.findById(req.params.id).lean();
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json({
    id: s._id,
    inputType: s.inputType,
    rawInput: s.rawInput,
    extractedIngredients: s.extractedIngredients,
    flags: s.flags,
    riskLevel: s.riskLevel,
    geminiSummaryHtml: s.geminiSummaryHtml,
    createdAt: s.createdAt,
  });
});

module.exports = router;
