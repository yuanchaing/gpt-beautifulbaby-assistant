// api/webhook.js
import crypto from "crypto";
import * as line from "@line/bot-sdk";
import fetch from "node-fetch";

import { isMediaGenerationRequest } from "../utils/policy.js";
import { matchFAQ, findRelatedFAQContent, extractVendorMeta } from "../utils/faq.js";
import { matchProducts, formatProductAnswer } from "../utils/products.js";

// 關閉 bodyParser（LINE 簽章驗證用）
export const config = { api: { bodyParser: false } };

// LINE Client
const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
});

// GPT（用於品牌延伸查詢）
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_COMPLETION_MODEL = process.env.OPENAI_COMPLETION_MODEL || "gpt-4o";

// 分段回覆設定
const LINE_SAFE_LEN = Number(process.env.LINE_SAFE_LEN || 1800);
const LINE_REPLY_MAX = Number(process.env.LINE_REPLY_MAX || 5);
const TRUNCATE_NOTICE =
  process.env.LINE_TRUNCATE_NOTICE ||
  "（訊息過長，部分內容已省略。如需完整內容請以現場或官網資訊為準。）";

// 智慧分段（以句號、頓號、換行為優先邊界）
function smartSplitText(text, maxLen = LINE_SAFE_LEN) {
  if (!text) return [];
  const out = [];
  let remaining = text.trim();

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      out.push(remaining);
      break;
    }
    const slice = remaining.slice(0, maxLen);
    const lastSplit = Math.max(
      slice.lastIndexOf("。"),
      slice.lastIndexOf("！"),
      slice.lastIndexOf("？"),
      slice.lastIndexOf("，"),
      slice.lastIndexOf("、"),
      slice.lastIndexOf("；"),
      slice.lastIndexOf("\n")
    );
    if (lastSplit > 0 && lastSplit > maxLen * 0.6) {
      out.push(slice.slice(0, lastSplit + 1).trim());
      remaining = remaining.slice(lastSplit + 1).trim();
    } else {
      out.push(slice.trim());
      remaining = remaining.slice(maxLen).trim();
    }
  }
  return out;
}

async function replySmart({ replyToken, text }) {
  let messages = smartSplitText(text).map(t => ({ type: "text", text: t }));
  if (messages.length > LINE_REPLY_MAX) {
    messages = messages.slice(0, LINE_REPLY_MAX - 1);
    messages.push({ type: "text", text: TRUNCATE_NOTICE });
  }
  await client.replyMessage(replyToken, messages);
}

// 讀取 rawBody + 驗證簽章
async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function verifyLineSignature(rawBody, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET || "";
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const expected = hmac.digest("base64");
  return signature === expected;
}

function isLineVerifyTestEvent(events = []) {
  const t = new Set([
    "00000000000000000000000000000000",
    "ffffffffffffffffffffffffffffffff"
  ]);
  return events.some(ev => t.has(ev?.replyToken));
}

// 品牌清單（用於關鍵字判斷）
const VENDOR_KEYWORDS = [
  "彼緹娃",
  "國王家族",
  "Kings Family",
  "上雅禮品",
  "智匠工藝社",
  "Les OMBRES",
  "Les OMBRES d’Ambre",
  "八木茶飲",
  "巷隅咖啡",
  "Lane Corner Café",
  "日寶食品",
  "佛都愛玉",
  "御品紅豆",
  "鯤島",
  "Khuntor",
  "泰興肉脯",
  "廠商",
  "品牌"
];

function extractVendorKeyword(text) {
  if (!text) return null;
  const s = String(text).toLowerCase();
  for (const k of VENDOR_KEYWORDS) {
    if (s.includes(String(k).toLowerCase())) return k;
  }
  return null;
}

// GPT：結構化查詢品牌資訊
async function askGPT_vendorStructured({ vendor, address, question, context, urls }) {
  const sys = [
    "你是資料整合助理，請根據提供的資料與常識回答問題。",
    "如有非資料直接提供的內容，需加註【不同來源】並提示以現場或官網為準。",
    "請用繁體中文、條列清楚、自然簡潔，結尾務必附註「※實際資訊以現場或官網公告為準。」"
  ].join("\n");

  const user = [
    `廠商：${vendor || "未知"}`,
    `地點：${address || "未知"}`,
    `問題：${question}`,
    "備註：請輸出問題詳細並且具完整內容與訊息。",
    "",
    "可用資料（FAQ 摘要）：",
    context || "（無）",
    urls && urls.length ? `\n可能參考網址：\n- ${urls.join("\n- ")}` : ""
  ].join("\n");

  const body = {
    model: OPENAI_COMPLETION_MODEL,
    temperature: 0.4,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user }
    ]
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    return json?.choices?.[0]?.message?.content?.trim() || "（無回覆）";
  } catch {
    return "抱歉，目前暫時無法查詢該品牌的資訊。";
  }
}

// 主處理
export default async function handler(req, res) {
  const rawBody = await readRawBody(req);
  const signature = req.headers["x-line-signature"];
  if (!verifyLineSignature(rawBody, signature)) {
    return res.status(401).send("Invalid signature");
  }

  const body = JSON.parse(rawBody.toString("utf-8") || "{}");
  const events = body?.events || [];
  if (isLineVerifyTestEvent(events)) return res.status(200).end();

  for (const ev of events) {
    if (ev?.type !== "message" || ev?.message?.type !== "text") continue;
    const text = (ev.message.text || "").trim();
    const replyToken = ev.replyToken;

    try {
      // 擋影像生成
      if (isMediaGenerationRequest({ text, event: ev })) {
        await client.replyMessage(replyToken, [
          { type: "text", text: "目前僅提供觀光工廠與品牌成員的文字資訊服務。" }
        ]);
        continue;
      }

      // 1) 商品命中（最高優先）
      const productMatches = matchProducts(text, { limit: 5, minScore: 0.35 });
      if (productMatches.length > 0) {
        const answer = formatProductAnswer(productMatches, text);
        await replySmart({ replyToken, text: answer });
        continue;
      }

      // 2) 廠商/品牌問題（第二優先）
      const vendor = extractVendorKeyword(text);
      if (vendor) {
        // 2a) 先嘗試「帶品牌」的 FAQ 命中（避免被一般 FAQ 誤攔）
        const vendorAwareQ = `${vendor} ${text}`;
        const faqAnsVendor = matchFAQ(vendorAwareQ, { minScore: 0.5 });

        if (faqAnsVendor) {
          await replySmart({ replyToken, text: faqAnsVendor });
        } else {
          // 2b) FAQ 沒命中 → 用 FAQ 內與品牌相關內容當 context，交 GPT 延伸
          const meta = extractVendorMeta(vendor); // { context, address, phone, urls }
          const gptAnswer = await askGPT_vendorStructured({
            vendor,
            address: meta.address,
            question: text,
            context: meta.context,
            urls: meta.urls
          });
          await replySmart({ replyToken, text: gptAnswer });
        }
        continue;
      }

      // 3) FAQ 命中（第三優先）
      const faqAns = matchFAQ(text, { minScore: 0.5 });
      if (faqAns) {
        await replySmart({ replyToken, text: faqAns });
        continue;
      }

      // 4) fallback
      await replySmart({
        replyToken,
        text: "目前僅提供與觀光工廠、品牌成員相關的資訊。"
      });
    } catch (err) {
      console.error("error:", err);
      await client.replyMessage(replyToken, [
        { type: "text", text: "抱歉，系統忙碌，請稍後再試。" }
      ]);
    }
  }

  res.status(200).end();
}
