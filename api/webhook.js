// api/webhook.js
import crypto from "crypto";
import * as line from "@line/bot-sdk";
import fetch from "node-fetch";

import { isMediaGenerationRequest } from "../utils/policy.js";
import { matchFAQ, findRelatedFAQContent, extractVendorMeta } from "../utils/faq.js";
import { rememberLastQuestion, getLastQuestion } from "../utils/memory.js";

// ======== Vercel (Next.js) API 設定：關閉 bodyParser，保留原始請求體供簽章驗證 ========
export const config = { api: { bodyParser: false } };

// ===== LINE Client =====
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || "";
const client = new line.Client({
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET,
});

// ===== AI（僅用於品牌/廠商：FAQ 未命中 → 結構化詢問） =====
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_COMPLETION_MODEL = process.env.OPENAI_COMPLETION_MODEL || "gpt-4o";

// ===== 分段設定（智慧切句） =====
const LINE_SAFE_LEN = Number(process.env.LINE_SAFE_LEN || 1800);
const LINE_REPLY_MAX = Number(process.env.LINE_REPLY_MAX || 5);
const TRUNCATE_NOTICE =
  process.env.LINE_TRUNCATE_NOTICE ||
  "（訊息過長，部分內容已省略。如需完整內容請以現場或官網資訊為準。）";

// ===== 智慧分段（以句號、頓號、換行為優先邊界）=====
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
  let messages = smartSplitText(text).map((t) => ({ type: "text", text: t }));
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
    req.on("data", (c) => chunks.push(c));
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
  return events.some((ev) => t.has(ev?.replyToken));
}

// ===== 品牌/廠商關鍵字 & 辨識 =====
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
  "章成麥芽餅",
  "廠商",
  "品牌",
];

function extractVendorKeyword(text) {
  if (!text) return null;
  const s = String(text).toLowerCase();
  for (const k of VENDOR_KEYWORDS) {
    if (s.includes(String(k).toLowerCase())) return k;
  }
  return null;
}

// ===== 僅用於「FAQ 未命中」的品牌延伸：結構化 Prompt =====
async function askGPT_vendorStructured({ vendor, address, question, context, urls, lastQuestion }) {
  const sys = [
    "你是資料綜整助理。請僅根據提供的資料與一般常識進行說明；不可臆測或虛構細節。",
    "凡非直接來自提供資料的延伸推斷或常識，請以【不同來源】標註該句子。",
    "結尾務必加入：『※實際資訊以現場或官網公告為準。』",
    "用繁體中文、條列清楚、避免冗語。",
  ].join("\n");

  const user = [
    `廠商：${vendor || "未知"}`,
    `地點：${address || "未知"}`,
    `問題：${question}`,
    `備註：請輸出問題詳細並且具完整內容與訊息；若詢問為「價格」，請說明常見價位範圍與影響因素（如杯/份/大小/配料），並指引至現場或官網查詢最新價格。`,
    "",
    "可用資料（FAQ 摘要，不可超出此範圍斷言）：",
    context || "（無）",
    urls && urls.length ? `\n可能參考網址：\n- ${urls.join("\n- ")}` : "",
    lastQuestion ? `\n使用者上一題：${lastQuestion}` : "",
  ].join("\n");

  const body = {
    model: OPENAI_COMPLETION_MODEL,
    temperature: 0.4,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    // 不加 max_tokens → 讓 gpt-4o 自行輸出完整內容
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return json?.choices?.[0]?.message?.content?.trim() || "（無回覆）";
  } catch {
    return "抱歉，目前暫時無法查詢該品牌的資訊。";
  }
}

// ===== 主處理 =====
export default async function handler(req, res) {
  try {
    const rawBody = await readRawBody(req);

    // --- 開發/健康檢查用：允許 ping（不帶簽章也回 200）
    // 啟用方式：在 Vercel 環境變數設 ALLOW_WEBHOOK_PING=1
    if (
      process.env.ALLOW_WEBHOOK_PING === "1" &&
      (req.method === "GET" || (req.method === "POST" && !req.headers["x-line-signature"]))
    ) {
      res.status(200).send("pong");
      return;
    }

    // --- 簽章驗證（必須用 raw body）
    const signature = req.headers["x-line-signature"];
    if (!verifyLineSignature(rawBody, signature, LINE_CHANNEL_SECRET)) {
      // 簽章錯誤會讓 LINE 收不到回覆，請檢查：bodyParser 是否關閉 / secret 是否正確
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
        // 擋掉媒體生成
        if (isMediaGenerationRequest({ text, event: ev })) {
          await client.replyMessage(replyToken, [
            { type: "text", text: "目前僅提供觀光工廠與品牌成員的文字資訊服務。" },
          ]);
          continue;
        }

        // FAQ（一般問題只回 FAQ）
        const faqAnsDirect = matchFAQ(text, { minScore: 0.45 });

        // 品牌承接：當前問題取不到 → 用上一題補
        const lastQ = getLastQuestion(userId);
        let vendor = extractVendorKeyword(text) || extractVendorKeyword(lastQ || "");

        if (vendor) {
          // ——【品牌 / 廠商分支】——
          // 提高 FAQ 命中率（品牌 + 當前問題）
          const qForFAQ = vendor && !text.includes(vendor) ? `${vendor} ${text}` : text;
          const faqAns = matchFAQ(qForFAQ, { minScore: 0.45 }) || faqAnsDirect;

          if (faqAns) {
            await replySmart({ replyToken, text: faqAns });
          } else {
            // FAQ 未命中 → 從 FAQ 萃取品牌脈絡（地址/網址/摘要）+ 結構化 Prompt 問 GPT
            const meta = extractVendorMeta(vendor); // { context, address, phone, urls }
            const answer = await askGPT_vendorStructured({
              vendor,
              address: meta.address,
              question: text,
              context: meta.context,
              urls: meta.urls,
              lastQuestion: lastQ || null,
            });
            await replySmart({ replyToken, text: answer });
          }
        } else {
          // ——【一般問題分支】——
          if (faqAnsDirect) {
            await replySmart({ replyToken, text: faqAnsDirect });
          } else {
            await replySmart({
              replyToken,
              text: "目前僅提供與觀光工廠、品牌成員相關的資訊。",
            });
          }
        }

        // 記住上一題（無 DB、同一實例有效）
        rememberLastQuestion(userId, text);
      } catch (innerErr) {
        console.error("handler inner error:", innerErr);
        await client.replyMessage(replyToken, [
          { type: "text", text: "抱歉，系統忙碌，請稍後再試。" },
        ]);
      }
    }

    res.status(200).end();
  } catch (e) {
    console.error("webhook fatal error:", e);
    // 仍回 200，避免 LINE 無限重送
    res.status(200).end();
  }
}
