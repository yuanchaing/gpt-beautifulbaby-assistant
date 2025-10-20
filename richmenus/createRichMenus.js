// ESM 版：兩層 Rich Menu 重建（主選單 + 子選單）
import 'dotenv/config';
import * as line from '@line/bot-sdk';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RM_DIR = path.join(__dirname);
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const MENUS = [
  { json: 'main.json', img: 'main.png', alias: 'main-menu' },
  { json: 'ar.json',   img: 'ar.png',   alias: 'submenu-ar' },
];

async function patchLiffHtml() {
  const htmlPath = path.join(PUBLIC_DIR, 'liff-relay.html');
  try {
    let s = await fsp.readFile(htmlPath, 'utf8');
    s = s.replace(/LIFF_ID_REPLACE/g, process.env.LIFF_ID || '');
    await fsp.writeFile(htmlPath, s, 'utf8');
    console.log('✅ Patched public/liff-relay.html (LIFF_ID)');
  } catch (e) {
    console.log('ℹ️ 略過 liff-relay.html：', e.message);
  }
}

function readMenuJson(filename) {
  const p = path.join(RM_DIR, filename);
  let raw = fs.readFileSync(p, 'utf8');
  raw = raw.replace(/LIFF_ID_REPLACE/g, process.env.LIFF_ID || '');
  return JSON.parse(raw);
}

async function createOne({ json, img, alias }) {
  const data = readMenuJson(json);
  const richMenuId = await client.createRichMenu(data);
  console.log(`✅ 建立 ${json} → ${richMenuId}`);

  const imgPath = path.join(RM_DIR, img);
  const buf = fs.readFileSync(imgPath);
  await client.setRichMenuImage(richMenuId, buf, 'image/png');
  console.log(`✅ 上傳圖片：${img}`);

  await client.createRichMenuAlias(richMenuId, alias);
  console.log(`✅ 綁定 alias：${alias}`);

  return { alias, richMenuId };
}

async function main() {
  if (!process.env.LIFF_ID) {
    console.warn('⚠️ 未設定 LIFF_ID，LIFF Relay 將無法運作');
  }

  await patchLiffHtml();

  let mainId = null;
  for (const m of MENUS) {
    try {
      const res = await createOne(m);
      if (res.alias === 'main-menu') mainId = res.richMenuId;
    } catch (e) {
      console.error(`❌ 建立 ${m.json} 失敗：`, e.originalError?.response?.data || e.message);
    }
  }

  if (mainId) {
    try {
      await client.setDefaultRichMenu(mainId);
      console.log('🎉 已將 main-menu 設為預設 Rich Menu');
    } catch (e) {
      console.error('❌ 設定預設失敗：', e.originalError?.response?.data || e.message);
    }
  } else {
    console.warn('⚠️ 沒拿到 main-menu id，請檢查建立流程');
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
