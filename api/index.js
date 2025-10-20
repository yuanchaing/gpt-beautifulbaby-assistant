// api/index.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as line from '@line/bot-sdk';

import { handleEvents, printPrompts } from '../app/index.js';
import config from '../config/index.js';
import { validateLineSignature } from '../middleware/index.js';
import { fetchVersion, getVersion } from '../utils/index.js';
import { isMediaGenerationRequest } from '../utils/policy.js';
import { matchFAQ, reloadFAQ } from '../utils/faq.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// -------- raw body for LINE signature (POST /webhook 需要) --------
app.use((req, res, next) => {
  let data = [];
  req.on('data', (c) => data.push(c));
  req.on('end', () => {
    req.rawBody = Buffer.concat(data);
    next();
  });
});

// -------- JSON parser（除 /webhook 外）--------
app.use((req, res, next) => {
  if (req.path === (config.APP_WEBHOOK_PATH || '/webhook')) return next();
  if (req.headers['content-type']?.includes('application/json')) {
    try { req.body = JSON.parse(req.rawBody?.toString() || '{}'); }
    catch { req.body = {}; }
  }
  next();
});

// -------- 基本資訊（注意：外部要打 /api，內部路徑不要帶 /api）--------
app.get('/', async (req, res) => {
  try { await fetchVersion(); } catch {}
  res.status(200).json({ name: 'gpt-ai-assistant', version: getVersion(), env: process.env.VERCEL_ENV || 'local' });
});

// 健康檢查 & 診斷（對外：/api/healthz、/api/_diag）
app.get('/healthz', (req, res) => res.status(200).send('ok'));
app.get('/_diag', (req, res) => {
  const faqPath = path.join(__dirname, '..', 'storage', 'faq.json');
  const exists = fs.existsSync(faqPath);
  const stat = exists ? fs.statSync(faqPath) : null;
  res.status(200).json({ status: 'ok', faq: { exists, size: stat?.size || 0, mtime: stat?.mtime || null }});
});

// LIFF relay 取設定（對外：/api/liff）
app.get('/liff', (req, res) => {
  res.status(200).json({ liffId: process.env.LIFF_ID || '' });
});

// FAQ reload（對外：/api/faq/reload）
app.get('/faq/reload', (req, res) => {
  try { res.status(200).json({ reloaded: reloadFAQ() }); }
  catch (e) { res.status(500).json({ error: e?.message || String(e) }); }
});

// -------- GET /webhook 提供 LINE Verify （對外：/api/webhook）--------
app.get(config.APP_WEBHOOK_PATH || '/webhook', (req, res) => {
  res.status(200).send('ok');
});

// -------- 正式 Webhook（POST）（對外：/api/webhook）--------
app.post(config.APP_WEBHOOK_PATH || '/webhook', validateLineSignature, async (req, res) => {
  if (!req.rawBody?.length) return res.sendStatus(200);
  let payload = {};
  try { payload = JSON.parse(req.rawBody.toString('utf-8')); }
  catch { return res.sendStatus(400); }

  const events = Array.isArray(payload.events) ? payload.events : [];
  const patchedPayload = {
    ...payload,
    events: events.map((ev) => {
      const text = ev?.message?.text || '';
      const isMedia = isMediaGenerationRequest({ text, event: ev });
      if (isMedia) return ev;
      if (ev?.type === 'message' && ev?.message?.type === 'text') {
        const ans = matchFAQ(text, { minScore: 0.45 });
        if (ans) return { ...ev, __faqHit: true, message: { ...ev.message, type: 'text', text: ans } };
      }
      return ev;
    }),
  };

  try {
    await handleEvents(patchedPayload);
    if (config.APP_DEBUG) printPrompts();
    return res.sendStatus(200);
  } catch {
    return res.sendStatus(500);
  }
});

// ---------------- Admin RichMenu APIs (X-Admin-Token 保護) ----------------
function assertAdmin(req, res) {
  const t = req.headers['x-admin-token'] || '';
  if (!process.env.ADMIN_TOKEN || t !== process.env.ADMIN_TOKEN) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}
function lineClient() {
  return new line.Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
  });
}
const RM_DIR = path.join(__dirname, '..', 'richmenus');
function readMenuJson(filename) {
  const p = path.join(RM_DIR, filename);
  let raw = fs.readFileSync(p, 'utf8');
  raw = raw.replace(/LIFF_ID_REPLACE/g, process.env.LIFF_ID || '');
  return JSON.parse(raw);
}

// 檢查（對外：/api/admin/richmenus）
app.get('/admin/richmenus', async (req, res) => {
  if (!assertAdmin(req, res)) return;
  const client = lineClient();
  try {
    const menus = await client.getRichMenuList();
    const aliases = await client.getRichMenuAliasList();
    res.status(200).json({ menus, aliases });
  } catch (e) {
    res.status(500).json({ error: e.originalError?.response?.data || e.message });
  }
});

// 全刪（對外：/api/admin/richmenus）
app.delete('/admin/richmenus', async (req, res) => {
  if (!assertAdmin(req, res)) return;
  const client = lineClient();
  const result = { defaultCleared: false, aliasesDeleted: [], menusDeleted: [] };
  try { await client.deleteDefaultRichMenu(); result.defaultCleared = true; } catch {}
  try {
    const aliasList = await client.getRichMenuAliasList();
    for (const a of aliasList.aliases || []) {
      try { await client.deleteRichMenuAlias(a.richMenuAliasId); result.aliasesDeleted.push(a.richMenuAliasId); } catch {}
    }
  } catch {}
  try {
    const menus = await client.getRichMenuList();
    for (const m of menus || []) {
      try { await client.deleteRichMenu(m.richMenuId); result.menusDeleted.push(m.richMenuId); } catch {}
    }
  } catch {}
  res.status(200).json(result);
});

// 重建（對外：/api/admin/richmenus）
app.post('/admin/richmenus', async (req, res) => {
  if (!assertAdmin(req, res)) return;
  const client = lineClient();
  const MENUS = [
    { json: 'main.json', img: 'main.png', alias: 'main-menu' },
    { json: 'ar.json',   img: 'ar.png',   alias: 'submenu-ar' },
  ];
  const created = [];
  let mainId = null;
  try {
    for (const m of MENUS) {
      const data = readMenuJson(m.json);
      const id = await client.createRichMenu(data);
      const imgPath = path.join(RM_DIR, m.img);
      const buf = fs.readFileSync(imgPath);
      await client.setRichMenuImage(id, buf, 'image/png');
      await client.createRichMenuAlias(id, m.alias);
      if (m.alias === 'main-menu') mainId = id;
      created.push({ alias: m.alias, id });
    }
    if (mainId) await client.setDefaultRichMenu(mainId);
    res.status(200).json({ created, defaultSet: !!mainId });
  } catch (e) {
    res.status(500).json({ error: e.originalError?.response?.data || e.message });
  }
});

if (config.APP_PORT) {
  app.listen(config.APP_PORT, () => console.log(`[api] listening :${config.APP_PORT}`));
}
export default app;
