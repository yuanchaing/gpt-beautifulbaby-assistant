// api/webhook.js
import crypto from "crypto";
import * as line from "@line/bot-sdk";
import { isMediaGenerationRequest } from "../utils/policy.js";
import { matchFAQ, findRelatedFAQContent } from "../utils/faq.js";
import { refineWithPersona } from "../services/faq-refiner.js"; // 保留，如你要先潤飾 FAQ 可用
import fetch from "node-fetch";
import { matchProducts, formatProductAnswer } from "../utils/products.js";
import { rememberLastQuestion, getLastQuestion } from "../utils/memory.js";

// ===== LINE Client =====
const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
});

// ===== AI 設定（僅用於「廠商問題 FAQ 未命中」） =====
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_COMPLETION_MODEL = process.env.OPENAI_COMPLETION_MODEL || "gpt-4o";

// ===== 分段設定 =====
const LINE_SAFE_LEN = Number(process.env.LINE_SAFE_LEN || 1800);
const LINE_REPLY_MAX = Number(process.env.LINE_REPLY_MAX || 5);
const TRUNCATE_NOTICE =
  process.env.LINE_TRUNCATE_NOTICE ||
  "（訊息過長，部分內容已省略。如需完整內容請輸入更精準的關鍵字。）";

// ===== 智慧分段（句號、頓號、換行優先）=====
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

// ===== raw body & 簽章驗證 =====
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

// ===== 判斷是否為「廠商／品牌」問題 =====
function isVendorQuestion(text) {
  const vendorKeywords = [
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
    "章成麥芽餅",
    "廠商",
    "品牌"
  ];
  const lc = text.toLowerCase();
  return vendorKeywords.some(k => lc.includes(String(k).toLowerCase()));
}

// ===== 只在「廠商問題 FAQ 未命中」時，帶著 FAQ 摘要 + 上一題，交給 GPT 延伸 =====
async function askGPTwithContext({ question, context, lastQuestion }) {
  const system = [
    "你是一位中文導覽員，僅能根據『提供的資料內容』回答，禁止臆測或擴寫資料外的資訊。",
    "請以繁體中文，段落清楚、語氣親切自然。"
  ].join("\n");

  const user = [
    `使用者本次問題：${question}`,
    lastQuestion ? `使用者上一題：${lastQuestion}` : "",
    "",
    "以下是可用資料（只允許引用這些內容）：",
    context
  ].join("\n");

  const body = {
    model: OPENAI_COMPLETION_MODEL,
    temperature: 0.4,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
    // 不設定 max_tokens：讓 gpt-4o 自行輸出完整內容
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

// ===== 主處理 =====
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
    const userId = ev?.source?.userId || ""; // 用來記憶上一題

    try {
      // （可選）擋掉影像生成等請求
      if (isMediaGenerationRequest({ text, event: ev })) {
        await client.replyMessage(replyToken, [
          { type: "text", text: "目前僅提供觀光工廠與品牌成員的文字資訊服務。" }
        ]);
        continue;
      }

      // —— 商品：若你仍想保留（可視專案需求保留或移除）
      const productMatches = matchProducts(text, { limit: 8, minScore: 0.35 });
      if (productMatches.length > 0) {
        const answer = formatProductAnswer(productMatches, text);
        await replySmart({ replyToken, text: answer });
        rememberLastQuestion(userId, text);
        continue;
      }

      // —— FAQ 基本命中
      const faqAns = matchFAQ(text, { minScore: 0.45 });

      if (isVendorQuestion(text)) {
        // 廠商 / 品牌問題
        if (faqAns) {
          await replySmart({ replyToken, text: faqAns });
        } else {
          // FAQ 未命中 → 在 FAQ 內找該品牌的相關內容，再交 GPT 延伸
          const related = findRelatedFAQContent(text);
          if (related) {
            const lastQ = getLastQuestion(userId);
            const explain = await askGPTwithContext({
              question: text,
              context: related,
              lastQuestion: lastQ || null
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
        // 一般問題：只從 FAQ 找，不用 GPT
        if (faqAns) {
          await replySmart({ replyToken, text: faqAns });
        } else {
          await replySmart({
            replyToken,
            text: "目前僅提供與觀光工廠、品牌成員相關的資訊。"
          });
        }
      }

      // 最後把本次問題記起來（無資料庫，只在 warm instance 生效）
      rememberLastQuestion(userId, text);
    } catch (e) {
      await client.replyMessage(replyToken, [
        { type: "text", text: "抱歉，系統忙碌，請稍後再試。" }
      ]);
    }
  }

  res.status(200).end();
}
