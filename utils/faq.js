// utils/faq.js
import fs from "fs";
import path from "path";

const faqPath = path.join(process.cwd(), "storage", "faq.json");

// ===== FAQ 資料讀取 =====
let FAQ_LIST = [];
try {
  const raw = fs.readFileSync(faqPath, "utf8");
  FAQ_LIST = JSON.parse(raw);
} catch {
  FAQ_LIST = [];
}

// ====== 工具：文字處理 ======
function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

// 中文簡易分詞（以常見連接詞、標點符號分隔）
function tokenize(str) {
  return normalize(str)
    .replace(/[，。！？；、：]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ====== 工具：模糊比對 (Dice bigram) ======
function toBigrams(str) {
  const s = normalize(str);
  if (s.length < 2) return s ? [s] : [];
  const arr = [];
  for (let i = 0; i < s.length - 1; i++) arr.push(s.slice(i, i + 2));
  return arr;
}
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
      inter++;
      map.set(token, v - 1);
    }
  }
  return (2 * inter) / (A.length + B.length);
}

// ====== 工具：關鍵字交集分數 ======
function keywordOverlap(a, b) {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const token of A) if (B.has(token)) inter++;
  return inter / Math.min(A.size, B.size);
}

// ====== 主功能：FAQ 比對 ======
export function matchFAQ(input, { minScore = 0.4 } = {}) {
  if (!Array.isArray(FAQ_LIST) || FAQ_LIST.length === 0) return null;

  const questions = FAQ_LIST.map((q) => q.question || q.q).filter(Boolean);
  if (questions.length === 0) return null;

  const normalizedInput = normalize(input);

  // (1) 完整包含判斷（直接包含）
  const contain = FAQ_LIST.find(
    (item) =>
      normalize(item?.question || "").includes(normalizedInput) ||
      normalizedInput.includes(normalize(item?.question || ""))
  );
  if (contain) return contain.answer || contain.a || null;

  // (2) 關鍵字交集 & 模糊比對
  let best = { item: null, score: 0 };
  for (const item of FAQ_LIST) {
    const qText = item?.question || item?.q || "";
    const dice = diceSimilarity(input, qText);
    const overlap = keywordOverlap(input, qText);
    const score = dice * 0.6 + overlap * 0.4; // 混合分數
    if (score > best.score) best = { item, score };
  }

  const dynamicMin = normalizedInput.length <= 4 ? 0.25 : minScore;
  if (best.score < dynamicMin) return null;
  return best.item?.answer || best.item?.a || null;
}

// ====== 品牌延伸搜尋 ======
export function findRelatedFAQContent(keyword) {
  if (!Array.isArray(FAQ_LIST) || FAQ_LIST.length === 0) return null;
  if (!keyword) return null;

  const lower = normalize(keyword);
  const related = FAQ_LIST
    .filter((item) => {
      const q = normalize(item?.question || "");
      const a = normalize(item?.answer || "");
      return (q + a).includes(lower);
    })
    .map((item) => `【${item.question}】\n${item.answer}`)
    .join("\n\n");
  return related || null;
}

// ====== 品牌資料擷取 ======
function extractMetaFromText(text) {
  const meta = { address: null, phone: null, urls: [] };
  if (!text) return meta;

  const addrMatch =
    text.match(/(?:地址[:：]\s*|📍\s*)([^\n\r]+)/) ||
    text.match(/台|臺|新北|桃園|高雄|基隆|嘉義|彰化|雲林|南投|屏東|宜蘭|花蓮|台東/);
  if (addrMatch) meta.address = addrMatch[1] || addrMatch[0];

  const phoneMatch = text.match(/(?:電話[:：]\s*|\(?0\d{1,2}\)?[-\s]?)\d{3,4}[-\s]?\d{3,4}/);
  if (phoneMatch) meta.phone = phoneMatch[0].replace(/^電話[:：]\s*/, "");

  const urlRegex = /(https?:\/\/[^\s)]+)/g;
  const urls = new Set();
  let m;
  while ((m = urlRegex.exec(text)) !== null) urls.add(m[1]);
  meta.urls = Array.from(urls);
  return meta;
}

export function extractVendorMeta(vendorKeyword) {
  const ctx = findRelatedFAQContent(vendorKeyword) || "";
  const meta = extractMetaFromText(ctx);
  return {
    context: ctx || null,
    address: meta.address || null,
    phone: meta.phone || null,
    urls: meta.urls || []
  };
}
