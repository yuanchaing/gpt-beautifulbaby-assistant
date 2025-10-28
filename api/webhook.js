// api/webhook.js
import crypto from "crypto";
import * as line from "@line/bot-sdk";
import { isMediaGenerationRequest } from "../utils/policy.js";
import { matchFAQ, findRelatedFAQContent } from "../utils/faq.js";
import { refineWithPersona } from "../services/faq-refiner.js";
import fetch from "node-fetch";
import { matchProducts, formatProductAnswer } from "../utils/products.js";

// ===== LINE Client =====
const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
});

// ===== AI 設定 =====
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_COMPLETION_MODEL = process.env.OPENAI_COMPLETION_MODEL || "gpt-4o";

// ===== 分段設定 =====
const LINE_SAFE_LEN = Number(process.env.LINE_SAFE_LEN || 1800);
const LINE_REPLY_MAX = 5;
const TRUNCATE_NOTICE =
  "（訊息過長，部分內容已省略。如需完整內容請輸入更精準的關鍵字。）";

// ===== 智慧分段 =====
function smartSplitText(text, maxLen = LINE_SAFE_LEN) {
  if (!text) return [];
  const output = [];
  let remaining = text.trim();

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      output.push(remaining);
      break;
    }

    let slice = remaining.slice(0, maxLen);
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
      output.push(slice.slice(0, lastSplit + 1).trim());
      remaining = remaining.slice(lastSplit + 1).trim();
    } else {
      output.push(slice.trim());
      remaining = remaining.slice(maxLen).trim();
    }
  }
  return output;
}

async function replySmart({ replyToken, text }) {
  const parts = smartSplitText(text);
  let messages = parts.map(t => ({ type: "text", text: t }));
  if (messages.length > LINE_REPLY_MAX) {
    messages = messages.slice(0, LINE_REPLY_MAX - 1);
    messages.push({ type: "text", text: TRUNCATE_NOTICE });
  }
  await client.replyMessage(replyToken, messages);
}

// ===== 讀取 raw body & 簽章驗證 =====
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

// ===== 呼叫 GPT（僅用於廠商問題延伸說明） =====
async function askGPTwithContext({ question, context }) {
  const prompt = [
    "你是一位中文導覽員，請根據以下提供的資料（僅限內容內資訊）進行說明或回答問題。",
    "請不要虛構資訊，也不要引用資料外的內容。",
    "保持自然口吻，以繁體中文回答。"
  ].join("\n");

  const body = {
    model: OPENAI_COMPLETION_MODEL,
    temperature: 0.4,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `使用者問題：${question}\n\n相關資料：${context}` }
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
  } catch (err) {
    return "抱歉，目前暫時無法查詢該品牌的資訊。";
  }
}

// ===== 判斷是否為廠商問題 =====
function isVendorQuestion(text) {
  const vendorKeywords = [
    "彼緹娃",
    "國王家族",
    "Kings Family",
    "上雅禮品",
    "智匠工藝社",
    "Les OMBRES",
    "八木茶飲",
    "巷隅咖啡",
    "日寶食品",
    "佛都愛玉",
    "御品紅豆",
    "鯤島",
    "Khuntor",
    "章成麥芽餅"
  ];
  return vendorKeywords.some(k => text.includes(k) || text.includes("廠商") || text.includes("品牌"));
}

// ===== 主處理邏輯 =====
export default async function handler(req, res) {
  const rawBody = await readRawBody(req);
  const signature = req.headers["x-line-signature"];
  if (!verifyLineSignature(rawBody, signature)) {
    return res.status(401).send("Invalid signature");
  }

  const body = JSON.parse(rawBody.toString("utf-8") || "{}");
  const events = body?.events || [];

  for (const ev of events) {
    if (ev?.type !== "message" || ev?.message?.type !== "text") continue;
    const text = ev.message.text.trim();
    const replyToken = ev.replyToken;

    try {
      // 一般 FAQ 查詢
      const faqAns = matchFAQ(text, { minScore: 0.45 });

      if (isVendorQuestion(text)) {
        // 廠商相關問題
        if (faqAns) {
          // FAQ 命中 → 直接回覆
          await replySmart({ replyToken, text: faqAns });
        } else {
          // FAQ 未命中 → 從 FAQ 內找該品牌資料並交給 GPT
          const related = findRelatedFAQContent(text);
          if (related) {
            const explain = await askGPTwithContext({
              question: text,
              context: related
            });
            await replySmart({ replyToken, text: explain });
          } else {
            await replySmart({
              replyToken,
              text: "抱歉，目前暫無該品牌的相關資料。"
            });
          }
        }
      } else {
        // 一般問題 → 只回 FAQ，不用 GPT
        if (faqAns) {
          await replySmart({ replyToken, text: faqAns });
        } else {
          await replySmart({
            replyToken,
            text: "目前僅提供與觀光工廠、品牌成員相關的資訊。"
          });
        }
      }
    } catch (err) {
      await client.replyMessage(replyToken, [
        { type: "text", text: "抱歉，系統忙碌，請稍後再試。" }
      ]);
    }
  }

  res.status(200).end();
}
