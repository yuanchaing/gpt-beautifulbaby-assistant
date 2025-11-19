// utils/faq.js
// 直接匯入 JSON，避免在 Vercel 上用 fs 讀檔失敗
import faqRaw from "../storage/faq.json" assert { type: "json" };

// 兼容不同打包結果：有些環境會把資料放在 default 底下
const FAQ_DATA = Array.isArray(faqRaw)
  ? faqRaw
  : Array.isArray(faqRaw?.default)
  ? faqRaw.default
  : [];

// 字串正規化：全小寫、去空白
function normalize(str) {
  return String(str ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

/**
 * FAQ 比對：
 * - 逐一掃過 faq.json 裡的每個 q 關鍵字
 * - 用「是否互相為 substring」的方式來算分
 * - 分數最高且 >= minScore 的就當作命中
 *
 * @param {string} input 使用者輸入文字
 * @param {{ minScore?: number }} options
 * @returns {string|null} FAQ 回答文字（a），或 null
 */
export function matchFAQ(input, options = {}) {
  const text = normalize(input);
  if (!text) return null;

  const { minScore = 0 } = options;
  const faq = FAQ_DATA;

  let bestItem = null;
  let bestScore = 0;

  for (const item of faq) {
    if (!item || !Array.isArray(item.q)) continue;

    for (const q of item.q) {
      const nq = normalize(q);
      if (!nq) continue;

      let score = 0;

      if (text === nq) {
        // 完全相同
        score = 1;
      } else if (text.includes(nq)) {
        // 使用者句子包含關鍵字
        score = nq.length / text.length;
      } else if (nq.includes(text)) {
        // 關鍵字包含使用者句子（例如關鍵字比較長）
        score = text.length / nq.length;
      }

      if (score > bestScore) {
        bestScore = score;
        bestItem = item;
      }
    }
  }

  if (!bestItem || bestScore < minScore) {
    return null;
  }

  return bestItem.a || null;
}

/**
 * 從 FAQ 中抽取品牌相關摘要，提供給 GPT 當作 context
 *
 * @param {string} vendor 例如「彼緹娃」、「國王家族」、「八木茶飲」…
 * @returns {{ address: string, context: string, urls: string[] }}
 */
export function extractVendorMeta(vendor) {
  if (!vendor) {
    return { address: "", context: "", urls: [] };
  }

  const v = normalize(vendor);
  const faq = FAQ_DATA;

  let matchedItem = null;

  // 找出第一個有包含該 vendor 關鍵字的 FAQ 項目
  for (const item of faq) {
    if (!item || !Array.isArray(item.q)) continue;

    const hit = item.q.some((q) => {
      const nq = normalize(q);
      if (!nq) return false;
      return nq.includes(v) || v.includes(nq);
    });

    if (hit) {
      matchedItem = item;
      break;
    }
  }

  if (!matchedItem) {
    return { address: "", context: "", urls: [] };
  }

  const answer = String(matchedItem.a ?? "");

  // 粗略從文字中抓出地址（📍 開頭那一行）
  let address = "";
  const addrMatch = answer.match(/📍\s*([^\n]+)/);
  if (addrMatch) {
    address = addrMatch[1].trim();
  }

  // 抓出所有網址，當作可能官方 / FB / 店家連結
  const urls = [];
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let m;
  while ((m = urlRegex.exec(answer)) !== null) {
    urls.push(m[1]);
  }

  return {
    address,
    context: answer.trim(),
    urls
  };
}
