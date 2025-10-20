import * as line from '@line/bot-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RM_DIR = path.join(__dirname, '..', 'richmenus');

function assertAdmin(req, res) {
  const t = req.headers['x-admin-token'] || '';
  if (!process.env.ADMIN_TOKEN || t !== process.env.ADMIN_TOKEN) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

function client() {
  return new line.Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
  });
}

function readMenuJson(filename) {
  const p = path.join(RM_DIR, filename);
  let raw = fs.readFileSync(p, 'utf8');
  raw = raw.replace(/LIFF_ID_REPLACE/g, process.env.LIFF_ID || '');
  return JSON.parse(raw);
}

export default async function handler(req, res) {
  if (!assertAdmin(req, res)) return;

  const cli = client();

  if (req.method === 'GET') {
    try {
      const menus = await cli.getRichMenuList();
      const aliases = await cli.getRichMenuAliasList();
      return res.status(200).json({ menus, aliases });
    } catch (e) {
      return res.status(500).json({ error: e.originalError?.response?.data || e.message });
    }
  }

  if (req.method === 'DELETE') {
    const result = { defaultCleared: false, aliasesDeleted: [], menusDeleted: [] };
    try { await cli.deleteDefaultRichMenu(); result.defaultCleared = true; } catch {}
    try {
      const aliasList = await cli.getRichMenuAliasList();
      for (const a of aliasList.aliases || []) {
        try { await cli.deleteRichMenuAlias(a.richMenuAliasId); result.aliasesDeleted.push(a.richMenuAliasId); } catch {}
      }
    } catch {}
    try {
      const menus = await cli.getRichMenuList();
      for (const m of menus || []) {
        try { await cli.deleteRichMenu(m.richMenuId); result.menusDeleted.push(m.richMenuId); } catch {}
      }
    } catch {}
    return res.status(200).json(result);
  }

  if (req.method === 'POST') {
    const MENUS = [
      { json: 'main.json', img: 'main.png', alias: 'main-menu' },
      { json: 'ar.json',   img: 'ar.png',   alias: 'submenu-ar' },
    ];
    const created = [];
    let mainId = null;
    try {
      for (const m of MENUS) {
        const data = readMenuJson(m.json);
        const id = await cli.createRichMenu(data);
        const imgPath = path.join(RM_DIR, m.img);
        const buf = fs.readFileSync(imgPath);
        await cli.setRichMenuImage(id, buf, 'image/png');
        await cli.createRichMenuAlias(id, m.alias);
        if (m.alias === 'main-menu') mainId = id;
        created.push({ alias: m.alias, id });
      }
      if (mainId) await cli.setDefaultRichMenu(mainId);
      return res.status(200).json({ created, defaultSet: !!mainId });
    } catch (e) {
      return res.status(500).json({ error: e.originalError?.response?.data || e.message });
    }
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
