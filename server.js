'use strict';
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { renderPage, LANGS } = require('./src/render');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('fsa:' + ADMIN_PASSWORD).digest('hex');
const IS_PROD = process.env.NODE_ENV === 'production';
const SESSION_HOURS = 12;

if (!ADMIN_PASSWORD) console.warn('[fsa] ADMIN_PASSWORD is not set — the admin panel is disabled until you set it.');

// ---------- storage (JSON files on a persistent disk) ----------
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const TRIALS_FILE = path.join(DATA_DIR, 'trials.json');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(CONTENT_FILE)) fs.copyFileSync(path.join(__dirname, 'seed', 'content.json'), CONTENT_FILE);
if (!fs.existsSync(TRIALS_FILE)) fs.writeFileSync(TRIALS_FILE, '[]');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, data) {
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file); // atomic replace
}
function backupContent() {
  const dir = path.join(DATA_DIR, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(CONTENT_FILE, path.join(dir, `content-${new Date().toISOString().replace(/[:.]/g, '-')}.json`));
  const files = fs.readdirSync(dir).sort();
  while (files.length > 30) fs.unlinkSync(path.join(dir, files.shift()));
}

// Migrate content saved by the first (English-only) version to the bilingual format.
(function migrate() {
  const c = readJson(CONTENT_FILE);
  if (c.en && c.es) return;
  fs.mkdirSync(path.join(DATA_DIR, 'backups'), { recursive: true });
  fs.copyFileSync(CONTENT_FILE, path.join(DATA_DIR, 'backups', 'content-pre-bilingual.json'));
  writeJson(CONTENT_FILE, readJson(path.join(__dirname, 'seed', 'content.json')));
  console.log('[fsa] content migrated to bilingual format (old version kept in backups/)');
})();

let pageCache = {};
function getPage(lang) {
  if (!pageCache[lang]) pageCache[lang] = renderPage(readJson(CONTENT_FILE), lang);
  return pageCache[lang];
}

// ---------- auth ----------
function sign(value) { return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex'); }
function makeSession() {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  return `${exp}.${sign(String(exp))}`;
}
function validSession(token) {
  if (!token || !ADMIN_PASSWORD) return false;
  const [exp, mac] = token.split('.');
  if (!exp || !mac || Number(exp) < Date.now()) return false;
  const expected = sign(exp);
  return mac.length === expected.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
}
function getCookie(req, name) {
  const m = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
function requireAdmin(req, res, next) {
  if (validSession(getCookie(req, 'fsa_admin'))) return next();
  res.status(401).json({ error: 'Not logged in' });
}

// simple in-memory rate limiter
const hits = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length <= max;
}

// ---------- app ----------
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.type('html').send(getPage('en'));
});
app.get(['/es', '/es/'], (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.type('html').send(getPage('es'));
});

app.get('/robots.txt', (req, res) => {
  const c = readJson(CONTENT_FILE);
  res.type('text').send(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: ${c.settings.siteUrl.replace(/\/$/, '')}/sitemap.xml\n`);
});
app.get('/sitemap.xml', (req, res) => {
  const c = readJson(CONTENT_FILE);
  const b = c.settings.siteUrl.replace(/\/$/, '');
  const alt = `<xhtml:link rel="alternate" hreflang="en" href="${b}/"/><xhtml:link rel="alternate" hreflang="es" href="${b}/es"/>`;
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"><url><loc>${b}/</loc>${alt}</url><url><loc>${b}/es</loc>${alt}</url></urlset>\n`);
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d', index: false }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d' }));

// ---------- public API: trial request ----------
const clean = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

app.post('/api/trial', (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot: bots fill hidden field
  if (!rateLimit('trial:' + req.ip, 6, 15 * 60 * 1000)) return res.status(429).json({ error: 'Too many requests. Please try again later or message us on WhatsApp.' });

  const entry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'new',
    parentName: clean(b.parentName, 100),
    phone: clean(b.phone, 40),
    email: clean(b.email, 120),
    childName: clean(b.childName, 100),
    childAge: clean(b.childAge, 3),
    program: clean(b.program, 80),
    classChoice: clean(b.classChoice, 120),
    notes: clean(b.notes, 1000),
    language: b.lang === 'es' ? 'es' : 'en',
    adminNotes: ''
  };
  const errors = [];
  if (!entry.parentName) errors.push('parent name');
  if (!entry.phone || entry.phone.replace(/\D/g, '').length < 7) errors.push('a valid phone');
  if (!entry.childAge || !/^\d{1,2}$/.test(entry.childAge)) errors.push("child's age");
  if (!entry.program) errors.push('a program');
  if (errors.length) return res.status(400).json({ error: entry.language === 'es' ? 'Por favor revisa: nombre, teléfono válido, edad y programa.' : 'Please add ' + errors.join(', ') + '.' });

  const trials = readJson(TRIALS_FILE);
  trials.unshift(entry);
  writeJson(TRIALS_FILE, trials);
  notify(entry);
  res.json({ ok: true });
});

// Optional: forward new requests to a webhook (Zapier, Make, Slack, etc.)
function notify(entry) {
  const url = process.env.NOTIFY_WEBHOOK_URL;
  if (!url) return;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: `New trial request: ${entry.childName || 'child'} (${entry.childAge}) · ${entry.program} · ${entry.classChoice || 'any time'} · ${entry.parentName} ${entry.phone}`, ...entry })
  }).catch(err => console.error('[fsa] webhook failed:', err.message));
}

// ---------- admin ----------
app.get('/admin', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});
app.use('/admin/assets', express.static(path.join(__dirname, 'admin', 'assets'), { maxAge: 0 }));

app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: 'Admin is disabled: set ADMIN_PASSWORD on the server.' });
  if (!rateLimit('login:' + req.ip, 8, 15 * 60 * 1000)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const given = crypto.createHash('sha256').update(String(req.body?.password || '')).digest();
  const actual = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  if (!crypto.timingSafeEqual(given, actual)) return res.status(401).json({ error: 'Wrong password' });
  res.set('Set-Cookie', `fsa_admin=${makeSession()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}${IS_PROD ? '; Secure' : ''}`);
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => {
  res.set('Set-Cookie', 'fsa_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  res.json({ ok: true });
});
app.get('/api/admin/me', requireAdmin, (req, res) => res.json({ ok: true }));

app.get('/api/admin/content', requireAdmin, (req, res) => res.json(readJson(CONTENT_FILE)));
app.put('/api/admin/content', requireAdmin, (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || !body.settings || !body.en || !body.es) return res.status(400).json({ error: 'Invalid content' });
  try { LANGS.forEach(l => renderPage(body, l)); } catch (e) { return res.status(400).json({ error: 'Content could not be rendered: ' + e.message }); }
  backupContent();
  writeJson(CONTENT_FILE, body);
  pageCache = {};
  res.json({ ok: true });
});

const ALLOWED = /\.(jpe?g|png|webp|gif|mp4|webm|mov)$/i;
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const base = path.basename(file.originalname, ext).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'file';
      cb(null, `${base}-${Date.now().toString(36)}${ext}`);
    }
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED.test(file.originalname))
});
app.post('/api/admin/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Only images (jpg, png, webp, gif) or videos (mp4, webm, mov) up to 200 MB.' });
  res.json({ url: '/uploads/' + req.file.filename });
});

app.get('/api/admin/trials', requireAdmin, (req, res) => res.json(readJson(TRIALS_FILE)));
app.patch('/api/admin/trials/:id', requireAdmin, (req, res) => {
  const trials = readJson(TRIALS_FILE);
  const t = trials.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  if (['new', 'contacted', 'scheduled', 'enrolled', 'not-interested'].includes(req.body?.status)) t.status = req.body.status;
  if (typeof req.body?.adminNotes === 'string') t.adminNotes = clean(req.body.adminNotes, 2000);
  writeJson(TRIALS_FILE, trials);
  res.json(t);
});
app.delete('/api/admin/trials/:id', requireAdmin, (req, res) => {
  const trials = readJson(TRIALS_FILE).filter(x => x.id !== req.params.id);
  writeJson(TRIALS_FILE, trials);
  res.json({ ok: true });
});
app.get('/api/admin/trials.csv', requireAdmin, (req, res) => {
  const cols = ['createdAt', 'status', 'language', 'parentName', 'phone', 'email', 'childName', 'childAge', 'program', 'classChoice', 'notes', 'adminNotes'];
  const esc = v => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = "'" + s; // block spreadsheet formula injection
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const rows = readJson(TRIALS_FILE).map(t => cols.map(c => esc(t[c])).join(','));
  res.set('Content-Disposition', 'attachment; filename="trial-requests.csv"');
  res.type('text/csv').send('﻿' + [cols.join(','), ...rows].join('\n'));
});

app.use((req, res) => res.status(404).type('text').send('Not found'));

app.listen(PORT, () => console.log(`[fsa] running on http://localhost:${PORT}  (data: ${DATA_DIR})`));
