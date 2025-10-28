// api/webhook.js
import crypto from "crypto";
import * as line from "@line/bot-sdk";
import fetch from "node-fetch";
import { isMediaGenerationRequest } from "../utils/policy.js";
import { matchFAQ, findRelatedFAQContent, extractVendorMeta } from "../utils/faq.js";
import { matchProducts, formatProductAnswer } from "../utils/products.js";

export const config = { api: { bodyParser: false } };

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_COMPLETION_MODEL = process.env.OPENAI_COMPLETION_MODEL || "gpt-4o";

const LINE_SAFE_LEN = 1800;
const LINE_REPLY_MAX = 5;

function smartSplitText(text, maxLen = LINE_SAFE_LEN) {
  if (!text) return [];
  const parts = [];
  let remaining = text.trim();
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      parts.push(remaining);
      break;
    }
    const slice = remaining.slice(0, maxLen);
    const lastSplit = Math.max(
      slice.lastIndexOf("。"),
      slice.lastIndexOf("，"),
      slice.lastIndexOf("\n")
    );
    if (lastSplit > 0) {
      parts.push(slice.slice(0, lastSplit + 1));
      remaining = remaining.slice(lastSplit + 1);
    } else {
      parts.push(slice);
      remaining = remaining.slice(maxLen);
    }
  }
  return parts;
}

async function replySmart({ replyToken, text }) {
  const messages = smartSplitText(text).map((t) => ({ type: "text", text: t }));
  await client.replyMessage(replyToken, messages);
}

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function verifyLineSignature(rawBody, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET || "";
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  return hmac.digest("base64") === signature;
}

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
  "章成麥芽餅"
];

function extractVendorKeyword(text) {
  const s = String(text || "").toLowerCase();
  for (const k of VENDOR_KEYWORDS) if (s.includes(k.toLowerCase())) return k;
  return null;
}

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
    "",
    "可用資料：",
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

export default async function handler(req, res) {
  const rawBody = await readRawBody(req);
  const signature = req.headers["x-line-signature"];
  if (!verifyLineSignature(rawBody, signature)) return res.status(401).send("Invalid signature");

  const body = JSON.parse(rawBody.toString("utf-8") || "{}");
  const events = body?.events || [];

  for (const ev of events) {
    if (ev?.type !== "message" || ev?.message?.type !== "text") continue;
    const text = ev.message.text.trim();
    const replyToken = ev.replyToken;

    // 1️⃣ 商品命中（最高優先）
    const productMatches = matchProducts(text, { limit: 5, minScore: 0.35 });
    if (productMatches.length > 0) {
      const answer = formatProductAnswer(productMatches, text);
      await replySmart({ replyToken, text: answer });
      continue;
    }

    // 2️⃣ FAQ 命中
    const faqAns = matchFAQ(text, { minScore: 0.5 });
    if (faqAns) {
      await replySmart({ replyToken, text: faqAns });
      continue;
    }

    // 3️⃣ 品牌問題 → GPT 查詢
    const vendor = extractVendorKeyword(text);
    if (vendor) {
      const meta = extractVendorMeta(vendor);
      const gptAnswer = await askGPT_vendorStructured({
        vendor,
        address: meta.address,
        question: text,
        context: meta.context,
        urls: meta.urls
      });
      await replySmart({ replyToken, text: gptAnswer });
      continue;
    }

    // 4️⃣ fallback
    await replySmart({
      replyToken,
      text: "目前僅提供與觀光工廠、品牌成員相關的資訊。"
    });
  }

  res.status(200).end();
}
