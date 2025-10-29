// api/diag.js
// 用來診斷部署環境是否讀到 FAQ / Products，並用「與 webhook 相同」的決策順序：
// 1) product → 2) vendor (vendor-aware FAQ，否則 GPT) → 3) faq → 4) fallback
import fs from "fs";
import path from "path";
import { matchFAQ } from "../utils/faq.js";

// 如果你的專案已經有 utils/products.js，就使用它；否則 fallback 簡易讀檔（僅統計，不做比對）
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
    const count = Array.isArray(json)
      ? json.length
      : (json && Array.isArray(json.items) ? json.items.length : 0);
    const sample = Array.isArray(json) ? json.slice(0, 3) : json;
    return { ok: true, path: p, count, sample };
  } catch (e) {
    return { ok: false, reason: String(e), path: path.join(process.cwd(), relPath) };
  }
}

const VENDOR_KEYWORDS = [
  "彼緹娃","國王家族","Kings Family","上雅禮品","智匠工藝社",
  "Les OMBRES","Les OMBRES d’Ambre","八木茶飲","巷隅咖啡","Lane Corner Café",
  "日寶食品","佛都愛玉","御品紅豆","鯤島","Khuntor","泰興肉脯","廠商","品牌"
];

function detectVendor(text) {
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

  // 產品比對（若 utils/products.js 存在）
  let productHit = null;
  if (q && productsUtils?.matchProducts) {
    try {
      const matches = productsUtils.matchProducts(q, { limit: 5, minScore: 0.35 }) || [];
      productHit = { usedUtils: true, count: matches.length, top: matches.slice(0, 3) };
    } catch (e) {
      productHit = { usedUtils: true, error: String(e) };
    }
  }

  // FAQ 比對（一般 & vendor-aware）
  let faqHit = null;
  let faqVendorHit = null;
  const vendor = q ? detectVendor(q) : null;

  if (q) {
    try {
      // vendor-aware FAQ：把品牌名拼進去再試一次（與 webhook 相同策略）
      if (vendor) {
        const vq = `${vendor} ${q}`;
        const ansV = matchFAQ(vq, { minScore: 0.5 });
        faqVendorHit = { matched: !!ansV, preview: ansV ? ansV.slice(0, 100) : null };
      }
      // 一般 FAQ
      const ans = matchFAQ(q, { minScore: 0.5 });
      faqHit = { matched: !!ans, preview: ans ? ans.slice(0, 100) : null };
    } catch (e) {
      faqHit = { error: String(e) };
    }
  }

  // —— 決策順序需與 webhook 完全一致 ——
  let decision = "fallback";
  if (productHit && productHit.count > 0) {
    decision = "product";
  } else if (vendor) {
    // vendor-aware 優先：若 vendor-aware FAQ 命中 → vendor-faq
    if (faqVendorHit?.matched) decision = "vendor-faq";
    else decision = "vendor-gpt";
  } else if (faqHit?.matched) {
    decision = "faq";
  } else {
    decision = "fallback";
  }

  res.status(200).json({
    ok: true,
    tips: [
      "1) faq.ok==true 且 count>0 → 部署已讀到 FAQ。",
      "2) products.ok==true 且 count>0 → 部署已讀到商品。",
      "3) 決策順序與 webhook 一致：product → vendor(vendor-faq/vendor-gpt) → faq → fallback。",
      "4) query 參數 q 可模擬實際問題（例如 ?q=佛都愛玉 價格）。"
    ],
    faq,
    products: prod,
    test: {
      q,
      vendorDetected: vendor,
      productHit,
      faqVendorHit,
      faqHit,
      decision
    }
  });
}
