// utils/faq.js
// 不依賴任何外部套件的 FAQ 工具：內建 Dice bigram 模糊比對 + 品牌脈絡萃取
import fs from "fs";
import path from "path";

const faqPath = path.join(process.cwd(), "storage", "faq.json");

// 讀取 FAQ
let FAQ_LIST = [];
try {
  const raw = fs.readFileSync(faqPath, "utf8");
  FAQ_LIST = JSON.parse(raw);
} catch {
  FAQ_LIST = [];
}

// ---------- 文本工具 ----------
function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toBigrams(str) {
  const s = normalize(str);
  if (s.length < 2) return s ? [s] : [];
  const arr = [];
  for (let i = 0; i < s.length - 1; i++) {
    arr.push(s.slice(i, i + 2));
  }
  return arr;
}

// Dice coefficient on bigrams
function diceSimilarity(a, b) {
  const A = toBigrams(a);
  const B = toBigrams(b);
  if (A.length === 0 && B.length === 0) return 1;
  if (A.length === 0 || B.length === 0) return 0;

  const map = new Map();
  for (const token of A) map.set(token, (map.get(token) || 0) + 1);

  let inter = 0;
  for (const token of B) {
    const v = map.get(token);
    if (v > 0) {
      inter += 1;
      map.set(token, v - 1);
    }
  }
  return (2 * inter) / (A.length + B.length);
}

// 取得最佳匹配（回 { index, score }）
function bestMatchIndex(input, candidates) {
  let best = { index: -1, score: 0 };
  for (let i = 0; i < candidates.length; i++) {
    const s = diceSimilarity(input, candidates[i]);
    if (s > best.score) best = { index: i, score: s };
  }
  return best;
}

// ---------- 對外 API ----------

/**
 * 以相似度匹配 FAQ，回傳答案字串
 * @param {string} input 使用者輸入
 * @param {object} options
 * @param {number} options.minScore 相似度門檻（0~1）
 */
export function matchFAQ(input, { minScore = 0.45 } = {}) {
  if (!Array.isArray(FAQ_LIST) || FAQ_LIST.length === 0) return null;
  const questions = FAQ_LIST.map((q) => q.question || q.q).filter(Boolean);
  if (questions.length === 0) return null;

  const { index, score } = bestMatchIndex(input, questions);
  if (index < 0 || score < minScore) return null;

  const item = FAQ_LIST[index];
  return item?.answer || item?.a || null;
}

/**
 * 在 FAQ 全文中以包含關鍵字的方式搜尋「相關內容」，回傳合併字串
 * 供品牌延伸（GPT）使用
 */
export function findRelatedFAQContent(keyword) {
  if (!Array.isArray(FAQ_LIST) || FAQ_LIST.length === 0) return null;
  if (!keyword) return null;

  const lower = normalize(keyword);
  const related = FAQ_LIST
    .filter((item) => {
      const q = normalize(item?.question || item?.q || "");
      const a = normalize(item?.answer || item?.a || "");
      return (q + " " + a).includes(lower);
    })
    .map((item) => {
      const title = item?.question || item?.q || "";
      const ans = item?.answer || item?.a || "";
      return `【${title}】\n${ans}`;
    })
    .join("\n\n");

  return related || null;
}

/** 從某段文字中盡力萃取：地址 / 電話 / 網址清單 */
function extractMetaFromText(text) {
  const meta = { address: null, phone: null, urls: [] };
  if (!text) return meta;

  // 地址（支援「地址：」「📍」）
  let addrMatch = text.match(/(?:地址[:：]\s*|📍\s*)([^\n\r]+)/);
  if (!addrMatch) {
    // fallback：抓一段看起來像台灣地址的行
    const addrLine = (text.split(/\r?\n/).find((l) =>
      /(台|臺)(北|中|南)市|新北市|桃園市|基隆市|新竹市|嘉義市|高雄市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|宜蘭縣|花蓮縣|臺東縣|金門縣|連江縣|澎湖縣/.test(l)
    ));
    if (addrLine) addrMatch = [addrLine, addrLine];
  }
  if (addrMatch) meta.address = addrMatch[1];

  // 電話
  const phoneMatch = text.match(/(?:電話[:：]\s*|\(?0\d{1,2}\)?[-\s]?)\d{3,4}[-\s]?\d{3,4}/);
  if (phoneMatch) meta.phone = phoneMatch[0].replace(/^電話[:：]\s*/, "");

  // 網址（全部撈出）
  const urlRegex = /(https?:\/\/[^\s)]+)(?![^]*\1)/g;
  const urls = new Set();
  let m;
  while ((m = urlRegex.exec(text)) !== null) {
    urls.add(m[1]);
  }
  meta.urls = Array.from(urls);

  return meta;
}

/**
 * 從 FAQ 內找出與品牌關鍵字相關的內容，並萃取地址/電話/網址
 * @returns { context, address, phone, urls[] }
 */
export function extractVendorMeta(vendorKeyword) {
  const ctx = findRelatedFAQContent(vendorKeyword) || "";
  const meta = extractMetaFromText(ctx);
  return {
    context: ctx || null,
    address: meta.address || null,
    phone: meta.phone || null,
    urls: meta.urls || [],
  };
}
