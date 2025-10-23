// utils/products.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let _cache = null;
let _cacheMtime = 0;

function projectRootDir() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // utils/ → 專案根的上一層可能就是 ../
  // 這裡直接以相對於 utils 的 ../storage/products.json
  return path.resolve(__dirname, '..');
}

function productsPath() {
  // 預設路徑：<projectRoot>/storage/products.json
  return path.join(projectRootDir(), 'storage', 'products.json');
}

function loadJSONSafe(filepath) {
  try {
    const stat = fs.statSync(filepath);
    const mtime = stat.mtimeMs;
    if (_cache && _cacheMtime === mtime) return _cache;

    const raw = fs.readFileSync(filepath, 'utf-8');
    const data = JSON.parse(raw);
    _cache = Array.isArray(data) ? data : [];
    _cacheMtime = mtime;
    return _cache;
  } catch (e) {
    return [];
  }
}

// ---- 欄位對應（容錯）----
const FIELD_MAP = {
  name: ['商品名稱', '商品', '品名', '名稱', '品項', '商品名'],
  spec: ['規格', '包裝', '容量', '重量', '口味', '大小', '尺寸'],
  price: ['售價', '單價', '價格', '原價', '定價'],
  discount: ['優惠價', '特價', '折扣價', '活動價'],
  plan: ['方案', '組合', '促銷', '活動方案'],
  note: ['備註', '說明', '備考', '備注'],
  sku: ['SKU', '貨號', '編號', '產品代碼'],
};

function pickField(obj, aliases) {
  for (const key of Object.keys(obj)) {
    for (const alias of aliases) {
      if (String(key).toLowerCase() === String(alias).toLowerCase()) {
        return obj[key];
      }
    }
  }
  // 寬鬆比對（包含）
  for (const key of Object.keys(obj)) {
    const k = String(key).toLowerCase();
    if (aliases.some(a => k.includes(String(a).toLowerCase()))) {
      return obj[key];
    }
  }
  return undefined;
}

function normalizeText(s = '') {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

function tokenSet(str = '') {
  // 以中文字/數字/英文字元拆分為 token；對中文，這裡就以單字元集合近似
  const norm = normalizeText(str);
  // 英文以簡單切字；中文直接每個字元
  const tokens = norm.split('');
  return new Set(tokens.filter(Boolean));
}

function similarity(a = '', b = '') {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const score = inter / Math.max(A.size, B.size);
  // 若 b 完全包含 a（或相反），額外加分
  const an = normalizeText(a);
  const bn = normalizeText(b);
  if (an && bn && (bn.includes(an) || an.includes(bn))) {
    return Math.min(1, score + 0.25);
  }
  return score;
}

function extractFields(row) {
  const name = pickField(row, FIELD_MAP.name);
  const spec = pickField(row, FIELD_MAP.spec);
  const price = pickField(row, FIELD_MAP.price);
  const discount = pickField(row, FIELD_MAP.discount);
  const plan = pickField(row, FIELD_MAP.plan);
  const note = pickField(row, FIELD_MAP.note);
  const sku = pickField(row, FIELD_MAP.sku);
  return { name, spec, price, discount, plan, note, sku, raw: row };
}

/**
 * 依使用者輸入比對可能商品
 * @param {string} query
 * @param {{limit?:number, minScore?:number}} options
 * @returns {Array<{score:number, data:ReturnType<typeof extractFields>}>}
 */
export function matchProducts(query, { limit = 5, minScore = 0.35 } = {}) {
  const items = loadJSONSafe(productsPath());
  if (!items.length || !query) return [];
  const q = String(query || '');

  const scored = [];
  for (const row of items) {
    const f = extractFields(row);
    if (!f.name) continue;

    const sName = similarity(q, String(f.name));
    const sSpec = similarity(q, String(f.spec || ''));
    const sSku  = similarity(q, String(f.sku || ''));

    // 加權：名稱 0.7，規格 0.2，SKU 0.1
    const score = sName * 0.7 + sSpec * 0.2 + sSku * 0.1;

    if (score >= minScore) {
      scored.push({ score, data: f });
    } else {
      // 若查詢裡出現「價格/多少錢/多少$」，且名稱包含關鍵字，放寬門檻
      const priceIntent = /價|多少錢|多少\?|多少|price|\$|元/.test(q);
      if (priceIntent && normalizeText(f.name).includes(normalizeText(q).slice(0, 4))) {
        scored.push({ score: minScore, data: f });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * 把比對結果格式化成客服可讀訊息
 * @param {Array<{score:number, data: ReturnType<typeof extractFields>}>} matches
 * @param {string} originalQuery
 */
export function formatProductAnswer(matches, originalQuery = '') {
  if (!matches || !matches.length) return '目前查無相關商品，您可以提供更明確的商品名稱或規格關鍵字唷～';

  // 單筆命中 → 輸出完整資訊；多筆 → 列表摘要
  if (matches.length === 1) {
    const { name, spec, price, discount, plan, note, sku } = matches[0].data;
    const lines = [];
    lines.push(`您問的商品是：${name}`);
    if (spec) lines.push(`規格：${spec}`);
    if (discount != null && discount !== '') {
      lines.push(`優惠價：${discount} 元${price ? `（原價 ${price} 元）` : ''}`);
    } else if (price != null && price !== '') {
      lines.push(`售價：${price} 元`);
    }
    if (plan) lines.push(`方案：${plan}`);
    if (sku) lines.push(`產品編號：${sku}`);
    if (note) lines.push(`備註：${note}`);
    lines.push('\n若您需要下單或想比較其他口味/規格，告訴我關鍵字就可以囉！');
    return lines.join('\n');
  }

  const head = '為您找到以下相關商品：';
  const body = matches.map(({ data }, idx) => {
    const { name, spec, price, discount } = data;
    const priceStr = (discount != null && discount !== '')
      ? `優惠 ${discount} 元${price ? `（原價 ${price} 元）` : ''}`
      : (price != null && price !== '' ? `售價 ${price} 元` : '價格請洽門市');
    return `${idx + 1}. ${name}${spec ? `｜${spec}` : ''}｜${priceStr}`;
  }).join('\n');
  const tail = '\n若需要更精準結果，您可以多提供口味/口感/包裝數量等關鍵字～';
  return [head, body, tail].join('\n');
}
