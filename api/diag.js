// api/diag.js
// 說明：用來診斷目前部署環境是否有讀到 FAQ 與 Products，並模擬輸入的決策流程。
import fs from "fs";
import path from "path";
import { matchFAQ } from "../utils/faq.js";

// 如果你的專案已經有 utils/products.js，就使用它；否則 fallback 簡易讀檔。
let productsUtils = null;
try {
  productsUtils = await import("../utils/products.js");
} catch (_) {}

export const config = { api: { bodyParser: true } };

function loadJSON(relPath) {
  try {
    const p = path.join(process.cwd(), relPath);
    if (!fs.existsSync(p)) return { ok: false, reason: "not_found", path: p };
    const txt = fs.readFileSync(p, "utf8");
    const json = JSON.parse(txt);
    return { ok: true, path: p, count: Array.isArray(json) ? json.length : (json && json.items ? json.items.length : 0), sample: Array.isArray(json) ? json.slice(0, 3) : json };
  } catch (e) {
    return { ok: false, reason: String(e), path: path.join(process.cwd(), relPath) };
  }
}

const VENDOR_KEYWORDS = [
  "彼緹娃","國王家族","Kings Family","上雅禮品","智匠工藝社",
  "Les OMBRES","Les OMBRES d’Ambre","八木茶飲","巷隅咖啡","Lane Corner Café",
  "日寶食品","佛都愛玉","御品紅豆","鯤島","Khuntor","章成麥芽餅","廠商","品牌"
];

function extractVendorKeyword(text) {
  if (!text) return null;
  const s = String(text).toLowerCase();
  for (const k of VENDOR_KEYWORDS) {
    if (s.includes(String(k).toLowerCase())) return k;
  }
  return null;
}

export default async function handler(req, res) {
  const q = (req.query.q || req.body?.q || "").toString().trim();

  const faq = loadJSON("storage/faq.json");
  const prod = loadJSON("storage/products.json");

  // 商品比對（如果專案有 utils/products，就用；否則簡單包含測試）
  let productHit = null;
  if (q && productsUtils?.matchProducts) {
    try {
      const matches = productsUtils.matchProducts(q, { limit: 5, minScore: 0.35 }) || [];
      productHit = {
        usedUtils: true,
        count: matches.length,
        top: matches.slice(0, 3)
      };
    } catch (e) {
      productHit = { usedUtils: true, error: String(e) };
    }
  } else if (q && prod.ok && Array.isArray(prod.sample)) {
    // 簡易 fallback：名稱包含就當命中（僅供診斷）
    const arr = prod.sample;
    const hits = arr.filter(it => {
      const name = (it.name || it.title || "").toString().toLowerCase();
      return name && q.toLowerCase().includes(name.substring(0, Math.min(4, name.length)));
    });
    productHit = { usedUtils: false, count: hits.length, top: hits.slice(0, 3) };
  }

  // FAQ 比對
  let faqHit = null;
  if (q) {
    try {
      const ans = matchFAQ(q, { minScore: 0.5 });
      faqHit = { matched: !!ans, preview: ans ? ans.substring(0, 100) : null };
    } catch (e) {
      faqHit = { error: String(e) };
    }
  }

  // 品牌關鍵字偵測
  const vendor = q ? extractVendorKeyword(q) : null;

  // Pipeline 決策（和 webhook 同順序：產品 -> FAQ -> 品牌 -> fallback）
  let pipelineDecision = "fallback";
  if (productHit && productHit.count > 0) pipelineDecision = "product";
  else if (faqHit && faqHit.matched) pipelineDecision = "faq";
  else if (vendor) pipelineDecision = "vendor-gpt";
  else pipelineDecision = "fallback";

  res.status(200).json({
    ok: true,
    tips: [
      "1) faq.ok==true 且 count>0 才代表部署版有讀到 FAQ。",
      "2) products.ok==true 且 count>0 才代表部署版有讀到商品。",
      "3) 帶 ?q=你的句子 可看實際決策(product/faq/vendor/fallback)。",
      "4) 如果所有輸入都命中某一題，請檢查 storage/faq.json 的實際內容是否只有那一題。"
    ],
    faq,
    products: prod,
    test: {
      q,
      productHit,
      faqHit,
      vendorDetected: vendor,
      decision: pipelineDecision
    }
  });
}
