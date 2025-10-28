// utils/faq.js
import fs from "fs";
import path from "path";

const faqPath = path.join(process.cwd(), "storage", "faq.json");

let FAQ_LIST = [];
try {
  FAQ_LIST = JSON.parse(fs.readFileSync(faqPath, "utf8"));
} catch {
  FAQ_LIST = [];
}

function normalize(str) {
  return String(str || "").toLowerCase().replace(/\s+/g, "").trim();
}

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

export function matchFAQ(input, { minScore = 0.5 } = {}) {
  if (!Array.isArray(FAQ_LIST) || FAQ_LIST.length === 0) return null;
  const normalizedInput = normalize(input);

  // 完全包含命中
  const contain = FAQ_LIST.find(
    (item) =>
      normalize(item?.question || "").includes(normalizedInput) ||
      normalizedInput.includes(normalize(item?.question || ""))
  );
  if (contain) return contain.answer || contain.a || null;

  // 嚴格模糊比對
  let best = { item: null, score: 0 };
  for (const item of FAQ_LIST) {
    const qText = item?.question || item?.q || "";
    const score = diceSimilarity(input, qText);
    if (score > best.score) best = { item, score };
  }

  // 降低短詞誤命中
  const dynamicMin = normalizedInput.length <= 4 ? 0.6 : minScore;
  if (best.score < dynamicMin) return null;
  return best.item?.answer || best.item?.a || null;
}

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

function extractMetaFromText(text) {
  const meta = { address: null, phone: null, urls: [] };
  if (!text) return meta;
  const addrMatch = text.match(/(?:地址[:：]\s*|📍\s*)([^\n\r]+)/);
  if (addrMatch) meta.address = addrMatch[1];
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
