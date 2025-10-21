// ESM 版：建立主選單 + 子選單，傳圖、設 alias、設主選單為預設
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as line from '@line/bot-sdk';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..'); // 專案根目錄
const RM_DIR = path.join(ROOT, 'richmenus');

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

function readJsonWithLiffReplace(filename) {
  const p = path.join(RM_DIR, filename);
  let raw = fs.readFileSync(p, 'utf8');
  raw = raw.replace(/LIFF_ID_REPLACE/g, process.env.LIFF_ID || '');
  return JSON.parse(raw);
}

async function createOne({ json, img, alias, setDefault = false }) {
  const data = readJsonWithLiffReplace(json);
  const id = await client.createRichMenu(data);
  console.log(`Created: ${alias} -> ${id}`);

  const imgPath = path.join(RM_DIR, img);
  const buf = fs.readFileSync(imgPath);
  await client.setRichMenuImage(id, buf, 'image/png');
  console.log(`Image uploaded: ${img}`);

  // 先刪掉同名 alias（避免重複建立失敗）
  try { await client.deleteRichMenuAlias(alias); } catch {}
  await client.createRichMenuAlias(id, alias);
  console.log(`Alias set: ${alias}`);

  if (setDefault) {
    await client.setDefaultRichMenu(id);
    console.log('Set as DEFAULT rich menu.');
  }
  return id;
}

async function run() {
  console.log('=== Create Rich Menus (main + ar) ===');

  const mainId = await createOne({
    json: 'main.json',
    img: 'main.png',
    alias: 'main-menu',
    setDefault: true,
  });

  await createOne({
    json: 'ar.json',
    img: 'ar.png',
    alias: 'submenu-ar',
  });

  console.log('All created. Default ->', mainId);
}

run().catch((e) => {
  console.error('Create failed:', e?.originalError?.response?.data || e);
  process.exit(1);
});
