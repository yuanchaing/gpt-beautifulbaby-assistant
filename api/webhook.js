// api/webhook.js
import crypto from "crypto";
import * as line from "@line/bot-sdk";
import { isMediaGenerationRequest } from "../utils/policy.js";
import { matchFAQ } from "../utils/faq.js";
import { refineWithPersona } from "../services/faq-refiner.js";
import fetch from "node-fetch";
import { matchProducts, formatProductAnswer } from "../utils/products.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_COMPLETION_MODEL = process.env.OPENAI_COMPLETION_MODEL || "gpt-4o";
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

const client = new line.Client({
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET
});

// ======== 分段設定 ========
const LINE_REPLY_MAX = 5;
const LINE_SAFE_LEN = Number(process.env.LINE_SAFE_LEN || 1800);
const TRUNCATE_NOTICE =
  process.env.LINE_TRUNCATE_NOTICE ||
  "（訊息過長，部分內容已省略。如需完整內容請輸入更精準的關鍵字。）";

// ======== 安全分段（智能切句）========
function smartSplitText(text, maxLen = LINE_SAFE_LEN) {
  if (!text) return [];
  const output = [];
  let remaining = text.trim();

  const sentenceEnd = /([。！？\n]|$)/;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      output.push(remaining);
      break;
    }

    let slice = remaining.slice(0, maxLen);
    // 嘗試往前找自然分割點
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
      // 在句子邊界切
      output.push(slice.slice(0, lastSplit + 1).trim());
      remaining = remaining.slice(lastSplit + 1).trim();
    } else {
      // 沒找到合適邊界，就硬切
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

// ======== 簽章驗證 ========
async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
function verifyLineSignature(rawBody, signature) {
  const hmac = crypto.createHmac("sha256", LINE_CHANNEL_SECRET);
  hmac.update(rawBody);
  const expected = hmac.digest("base64");
  return signature === expected;
}
function isLineVerifyTestEvent(events = []) {
  const testTokens = new Set([
    "00000000000000000000000000000000",
    "ffffffffffffffffffffffffffffffff"
  ]);
  return events.some(ev => testTokens.has(ev?.replyToken));
}

// ======== GPT 直接回覆 ========
async function askGPT({ text }) {
  const system = [
    "你是專業的中文客服助理，請以繁體中文回答，語氣親切自然。",
    "回答要具體、有條理，不生成圖片或影音內容。"
  ].join("\n");

  const body = {
    model: OPENAI_COMPLETION_MODEL,
    temperature: 0.3,
    messages: [
      { role: "system", content: system },
      { role: "user", content: text }
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
    return "抱歉，目前系統有點忙碌，請稍後再試。";
  }
}

// ======== 主處理函式 ========
export default async function handler(req, res) {
  const rawBody = await readRawBody(req);
  const signature = req.headers["x-line-signature"];
  if (!verifyLineSignature(rawBody, signature)) {
    return res.status(401).send("Invalid signature");
  }

  const body = JSON.parse(rawBody.toString("utf8") || "{}");
  const events = body?.events || [];
  if (isLineVerifyTestEvent(events)) return res.status(200).end();

  for (const ev of events) {
    if (ev?.type !== "message" || ev?.message?.type !== "text") continue;
    const text = ev.message.text.trim();
    const replyToken = ev.replyToken;

    try {
      // 若是媒體生成需求
      if (isMediaGenerationRequest({ text, event: ev })) {
        await client.replyMessage(replyToken, [
          { type: "text", text: "目前暫不提供圖片、影片、音檔生成服務。" }
        ]);
        continue;
      }

      // 商品資料庫比對
      const productMatches = matchProducts(text, { limit: 8, minScore: 0.35 });
      if (productMatches.length > 0) {
        const answer = formatProductAnswer(productMatches, text);
        await replySmart({ replyToken, text: answer });
        continue;
      }

      // FAQ 命中 → 經 GPT 潤飾
      const faqAns = matchFAQ(text, { minScore: 0.45 });
      if (faqAns) {
        let finalText = faqAns;
        try {
          const refined = await refineWithPersona({
            question: text,
            rawAnswer: faqAns
          });
          if (refined) finalText = refined;
        } catch {}
        await replySmart({ replyToken, text: finalText });
        continue;
      }

      // 一般 GPT 回覆
      const gpt = await askGPT({ text });
      await replySmart({ replyToken, text: gpt });
    } catch (e) {
      await client.replyMessage(replyToken, [
        { type: "text", text: "抱歉，系統暫時忙碌，請稍後再試。" }
      ]);
    }
  }

  res.status(200).end();
}
