// utils/faq.js
// 改進版：FAQ 模糊比對 + 關鍵字包含命中（短詞優化）
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

// ---------- 工具 ----------
function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/\s+/g, "")
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

function bestMatchIndex(input, candidates) {
  let best = { index: -1, score: 0 };
  for (let i = 0; i < candidates.length; i++) {
    const s = diceSimilarity(input, candidates[i]);
    if (s > best.score) best = { index: i, score: s };
  }
  return best;
}

// ---------- 主功能 ----------
export function matchFAQ(input, { minScore = 0.4 } = {}) {
  if (!Array.isArray(FAQ_LIST) || FAQ_LIST.length === 0) return null;
  const questions = FAQ_LIST.map((q) => q.question || q.q).filter(Boolean);
  if (questions.length === 0) return null;

  const normalizedInput = normalize(input);

  // (1) 直接包含關鍵字的匹配（最寬鬆）
  const contain = FAQ_LIST.find(
    (item) =>
      normalize(item?.question || "").includes(normalizedInput) ||
      normalizedInput.includes(normalize(item?.question || ""))
  );
  if (contain) return contain.answer || contain.a || null;

  // (2) 模糊比對（短詞放寬）
  const dynamicMin = normalizedInput.length <= 4 ? 0.2 : minScore;
  const { index, score } = bestMatchIndex(input, questions);
  if (index < 0 || score < dynamicMin) return null;
  const item = FAQ_LIST[index];
  return item?.answer || item?.a || null;
}

// ---------- 品牌延伸搜尋 ----------
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

// ---------- 品牌資料擷取 ----------
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
