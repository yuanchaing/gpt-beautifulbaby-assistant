// api/webhook.js
// 單純「記憶上一題」→ 帶入 GPT 脈絡回答；不做 FAQ / 商品 / 品牌分支。
// 保留：智慧分段、LINE 簽章驗證、只用 reply、不用 push。

import crypto from "crypto";
import * as line from "@line/bot-sdk";
import fetch from "node-fetch";
import { rememberLastQuestion, getLastQuestion } from "../utils/memory.js";

// 關閉 bodyParser（LINE 簽章一定要用 raw body 計算）
export const config = { api: { bodyParser: false } };

// ===== LINE Client =====
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || "";
const client = new line.Client({
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET,
});

// ===== OpenAI 設定 =====
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_COMPLETION_MODEL = process.env.OPENAI_COMPLETION_MODEL || "gpt-4o";

// ===== 分段設定 =====
const LINE_SAFE_LEN = Number(process.env.LINE_SAFE_LEN || 1800);
const LINE_REPLY_MAX = Number(process.env.LINE_REPLY_MAX || 5);
const TRUNCATE_NOTICE =
  process.env.LINE_TRUNCATE_NOTICE ||
  "（訊息過長，部分內容已省略。）";

// ===== 智慧分段（以句號、頓號、換行優先）=====
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
function verifyLineSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const expected = hmac.digest("base64");
  return signature === expected;
}
function isLineVerifyTestEvent(events = []) {
  const t = new Set([
    "00000000000000000000000000000000",
    "ffffffffffffffffffffffffffffffff",
  ]);
  return events.some(ev => t.has(ev?.replyToken));
}

// ===== GPT：帶上一題脈絡 =====
async function askGPTWithMemory({ question, lastQuestion }) {
  const system = [
    "你是專業且親切的中文客服助理，請以繁體中文回答。",
    "回覆應條理清晰、直接、具體，必要時用條列式說明。"
  ].join("\n");

  const user = [
    lastQuestion ? `上一題：${lastQuestion}` : "",
    `本次問題：${question}`
  ].filter(Boolean).join("\n");

  const body = {
    model: OPENAI_COMPLETION_MODEL,
    temperature: 0.3,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
    // 不設定 max_tokens：讓 gpt-4o 自行輸出完整內容（128k）
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`OpenAI API error ${res.status} ${msg}`);
  }

  const json = await res.json();
  return json?.choices?.[0]?.message?.content?.trim() || "（無回覆）";
}

// ===== 主處理 =====
export default async function handler(req, res) {
  try {
    const rawBody = await readRawBody(req);

    // 必須用 rawBody 進行簽章驗證
    const signature = req.headers["x-line-signature"];
    if (!verifyLineSignature(rawBody, signature, LINE_CHANNEL_SECRET)) {
      return res.status(401).send("Invalid signature");
    }

    const body = JSON.parse(rawBody.toString("utf-8") || "{}");
    const events = body?.events || [];
    if (isLineVerifyTestEvent(events)) return res.status(200).end();

    for (const ev of events) {
      if (ev?.type !== "message" || ev?.message?.type !== "text") continue;
      const text = (ev.message.text || "").trim();
      const replyToken = ev.replyToken;
      const userId = ev?.source?.userId || "";

      try {
        const lastQ = getLastQuestion(userId);
        const answer = await askGPTWithMemory({ question: text, lastQuestion: lastQ });
        await replySmart({ replyToken, text: answer });

        // 記住「上一題」
        rememberLastQuestion(userId, text);
      } catch (e) {
        console.error("handler inner error:", e);
        await client.replyMessage(replyToken, [
          { type: "text", text: "抱歉，系統忙碌，請稍後再試。" }
        ]);
      }
    }

    res.status(200).end();
  } catch (e) {
    console.error("webhook fatal error:", e);
    // 回 200 避免 LINE 重送
    res.status(200).end();
  }
}
