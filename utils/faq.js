// utils/faq.js
import fs from "fs";
import path from "path";
import stringSimilarity from "string-similarity";

const faqPath = path.join(process.cwd(), "storage", "faq.json");
let FAQ_LIST = [];
try {
  FAQ_LIST = JSON.parse(fs.readFileSync(faqPath, "utf8"));
} catch {
  FAQ_LIST = [];
}

/** 以相似度匹配 FAQ，回傳答案字串 */
export function matchFAQ(input, { minScore = 0.45 } = {}) {
  if (!Array.isArray(FAQ_LIST) || FAQ_LIST.length === 0) return null;
  const questions = FAQ_LIST.map(q => q.question || q.q).filter(Boolean);
  const matches = stringSimilarity.findBestMatch(input, questions);
  const best = matches.bestMatch;
  if (!best || best.rating < minScore) return null;
  const item = FAQ_LIST.find(i => (i.question || i.q) === best.target);
  return item?.answer || item?.a || null;
}

/** 在 FAQ 全文中以包含關鍵字的方式搜尋「相關內容」，回傳合併字串 */
export function findRelatedFAQContent(keyword) {
  if (!Array.isArray(FAQ_LIST) || FAQ_LIST.length === 0) return null;
  if (!keyword) return null;
  const lower = String(keyword).toLowerCase();

  const related = FAQ_LIST
    .filter(item => {
      const q = (item.question || item.q || "").toString();
      const a = (item.answer || item.a || "").toString();
      return (q + " " + a).toLowerCase().includes(lower);
    })
    .map(item => {
      const title = (item.question || item.q || "").toString();
      const ans = (item.answer || item.a || "").toString();
      return `【${title}】\n${ans}`;
    })
    .join("\n\n");

  return related || null;
}

/** 從某段文字中「盡力」萃取常見欄位：地址 / 電話 / 網址清單 */
function extractMetaFromText(text) {
  const meta = { address: null, phone: null, urls: [] };
  if (!text) return meta;

  // 地址（包含「地址：」「📍」等）
  const addrMatch =
    text.match(/(?:地址[:：]\s*|📍\s*)([^\n\r]+)/) ||
    text.match(/台(?:北|中|南)|桃園|新(?:北|竹)|高雄|基隆|嘉義|彰化|雲林|南投|屏東|宜蘭|花蓮|台東|澎湖|金門|馬祖/);
  if (addrMatch) meta.address = addrMatch[1] || addrMatch[0];

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

/** 從 FAQ 內找出第一段「最像這個品牌」的內容，並萃取地址/電話/網址 */
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
