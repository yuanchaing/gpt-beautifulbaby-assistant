// richmenus/createRichMenus.js (ESM)
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as line from '@line/bot-sdk';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const RM_DIR = path.join(ROOT, 'richmenus');

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
});

function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

function loadJSONWithLiffReplace(file) {
  const p = path.join(RM_DIR, file);
  let raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw.replace(/LIFF_ID_REPLACE/g, process.env.LIFF_ID || ''));
}

async function createMenu(jsonName, imageName, aliasId, setDefault = false) {
  const data = loadJSONWithLiffReplace(jsonName);
  const richMenuId = await client.createRichMenu(data);
  console.log(`[create] ${jsonName} -> ${richMenuId}`);

  if (imageName) {
    const imgPath = path.join(RM_DIR, imageName);
    const buf = fs.readFileSync(imgPath);
    await client.setRichMenuImage(richMenuId, buf, 'image/png');
    console.log(`[image] ${imageName} uploaded`);
  }

  // clear same alias if any, then create alias
  if (aliasId) {
    try { await client.deleteRichMenuAlias(aliasId); } catch {}
    await client.createRichMenuAlias(richMenuId, aliasId);
    console.log(`[alias] ${aliasId} -> ${richMenuId}`);
  }

  if (setDefault) {
    await client.setDefaultRichMenu(richMenuId);
    console.log(`[default] set ${richMenuId}`);
  }
  return richMenuId;
}

async function run() {
  console.log('=== Create Rich Menus (auto-detect) ===');

  // main
  const mainId = await createMenu('main.json', 'main.png', 'main-menu', true);

  // optional ar submenu
  const arJson = path.join(RM_DIR, 'ar.json');
  const arImg = path.join(RM_DIR, 'ar.png');
  if (exists(arJson) && exists(arImg)) {
    await createMenu('ar.json', 'ar.png', 'submenu-ar', false);
  } else {
    console.log('[skip] ar submenu not found (richmenus/ar.json or ar.png missing).');
  }

  console.log('All done. Default ->', mainId);
}

run().catch((e) => {
  console.error('Create failed:', e?.originalError?.response?.data || e);
  process.exit(1);
});
