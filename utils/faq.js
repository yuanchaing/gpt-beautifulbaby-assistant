// utils/faq.js
// 修正點：正確處理 q 為「字串或陣列」的情況，避免空字串造成永遠命中第一筆；
// 模糊比對會對所有別名取最大分數；findRelated 也會檢索所有別名。
import fs from "fs";
import path from "path";

const faqPath = path.join(process.cwd(), "storage", "faq.json");

let FAQ_LIST = [];
try {
  FAQ_LIST = JSON.parse(fs.readFileSync(faqPath, "utf8"));
} catch {
  FAQ_LIST = [];
}

/** 將 question/q 統一轉成「非空字串陣列」 */
function getQuestionTexts(item) {
  const out = [];
  const add = (v) => {
    if (typeof v === "string" && v.trim()) out.push(v.trim());
  };
  if (typeof item?.question === "string") add(item.question);
  const q = item?.q;
  if (Array.isArray(q)) q.forEach(add);
  else if (typeof q === "string") add(q);
  return out;
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

/**
 * 嚴謹版 FAQ 命中：
 * 1) 「包含判斷」只能在「問題別名非空」時成立（避免 "" 命中）
 * 2) 模糊比對對所有別名取最大分數
 * 3) 短詞動態門檻較高以減少誤命中
 */
export function matchFAQ(input, { minScore = 0.5 } = {}) {
  if (!Array.isArray(FAQ_LIST) || FAQ_LIST.length === 0) return null;
  const normalizedInput = normalize(input);
  if (!normalizedInput) return null;

  // 1) 精確/包含：任一別名命中才算
  for (const item of FAQ_LIST) {
    const qs = getQuestionTexts(item);
    for (const qt of qs) {
      const ni = normalizedInput;
      const nq = normalize(qt);
      if (!nq) continue; // 不能用空字串
      if (nq.includes(ni) || ni.includes(nq)) {
        return item?.answer || item?.a || null;
      }
    }
  }

  // 2) 模糊比對：對每題的所有別名取「最大」相似度
  let best = { item: null, score: 0 };
  for (const item of FAQ_LIST) {
    const qs = getQuestionTexts(item);
    let maxForItem = 0;
    for (const qt of qs) {
      const s = diceSimilarity(input, qt);
      if (s > maxForItem) maxForItem = s;
    }
    if (maxForItem > best.score) best = { item, score: maxForItem };
  }

  // 動態門檻：短詞更嚴格
  const dynamicMin = normalizedInput.length <= 4 ? Math.max(minScore, 0.6) : minScore;
  if (best.score < dynamicMin) return null;
  return best.item?.answer || best.item?.a || null;
}

/** 在 FAQ 全文中搜尋與 keyword 相關的內容，回合併字串 */
export function findRelatedFAQContent(keyword) {
  if (!Array.isArray(FAQ_LIST) || FAQ_LIST.length === 0) return null;
  const key = normalize(keyword);
  if (!key) return null;

  const blocks = [];
  for (const item of FAQ_LIST) {
    const qs = getQuestionTexts(item).map((t) => normalize(t));
    const a = normalize(item?.answer || item?.a || "");
    const joined = qs.join("") + a;
    if (joined.includes(key)) {
      const title = getQuestionTexts(item)[0] || "(未命名)";
      blocks.push(`【${title}】\n${item?.answer || item?.a || ""}`);
    }
  }
  return blocks.length ? blocks.join("\n\n") : null;
}

/** 從文字萃取地址/電話/網址（供品牌 GPT 用） */
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

/** 從 FAQ 找品牌相關脈絡與 meta */
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
