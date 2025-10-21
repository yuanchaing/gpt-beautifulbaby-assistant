// api/webhook.js
import crypto from 'crypto';
import * as line from '@line/bot-sdk';
import { isMediaGenerationRequest } from '../utils/policy.js';
import { matchFAQ } from '../utils/faq.js';

// ====== OpenAI 設定（環境變數）======
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_COMPLETION_MODEL = process.env.OPENAI_COMPLETION_MODEL || 'gpt-4o-mini';

// 你的 LINE Bot 憑證（務必來自 Messaging API Channel）
const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

// ====== 工具：讀 raw body（用於簽章驗證）======
async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ====== LINE 簽章驗證 ======
function verifyLineSignature(rawBody, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET || '';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const expected = hmac.digest('base64');
  return signature === expected;
}

// ====== LINE Verify 測試事件（replyToken 全 0 / 全 f）======
function isLineVerifyTestEvent(events = []) {
  const TEST_TOKENS = new Set([
    '00000000000000000000000000000000',
    'ffffffffffffffffffffffffffffffff',
  ]);
  return events.some((ev) => ev?.replyToken && TEST_TOKENS.has(ev.replyToken));
}

// ====== OpenAI Chat 補答（FAQ 未命中時）======
async function askGPT({ text, userId }) {
  if (!OPENAI_API_KEY) {
    return '（系統提示）目前未設定 OPENAI_API_KEY，暫時無法提供智能客服回答。';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000); // 20s timeout

  const system = [
    '你是專業的中文客服助理，回答需：',
    '1) 口吻親切、簡潔、具體；',
    '2) 優先以繁體中文；',
    '3) 若問題與門市資訊、營業時間、活動、優惠相關，給出清楚步驟或要點；',
    '4) 不確定時，誠實說明並提出可行的下一步（如提供關鍵字或引導人工）；',
    '5) 嚴禁生成圖片/影片/音檔，若使用者要求，請婉拒並提供可行的文字協助替代方案。',
  ].join('\n');

  const body = {
    model: OPENAI_COMPLETION_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: text },
    ],
    temperature: 0.3,
    max_tokens: 600,
  };

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return `（系統提示）AI 回覆暫時無法取得：${resp.status} ${errText || ''}`.slice(0, 500);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return '（系統提示）AI 回覆內容為空。';
    }
    return content;
  } catch (e) {
    return `（系統提示）AI 回覆逾時或失敗：${e?.message || String(e)}`.slice(0, 500);
  }
}

// ====== 主處理器 ======
export default async function handler(req, res) {
  // 1) GET：給 LINE 後台手動點「驗證」時測，直接回 200 ok
  if (req.method === 'GET') {
    return res.status(200).send('ok');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // 2) 讀 raw body 並驗簽
  const rawBody = await readRawBody(req);
  const signature = req.headers['x-line-signature'] || '';
  if (!verifyLineSignature(rawBody, signature)) {
    // 簽章錯 -> 401（可協助你在 LINE 後台辨識憑證是否正確）
    return res.status(401).json({ error: 'invalid_signature' });
  }

  // 3) 解析事件
  let payload = {};
  try {
    payload = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    return res.status(400).json({ error: 'invalid_json' });
  }

  const events = Array.isArray(payload.events) ? payload.events : [];

  // 4) LINE Verify 測試事件：直接 200，避免誤觸業務邏輯
  if (isLineVerifyTestEvent(events) || events.length === 0) {
    return res.status(200).end();
  }

  // 5) 逐筆事件處理（FAQ 命中 → 直接回；否則 → GPT）
  for (const ev of events) {
    try {
      // 僅處理文字訊息；其他型別可視需求擴充
      if (ev?.type !== 'message' || ev?.message?.type !== 'text') continue;
      const text = (ev.message.text || '').trim();

      // 5-1) 圖片/影片/音檔生成類需求 → 媒體策略拒絕
      if (isMediaGenerationRequest({ text, event: ev })) {
        await client.replyMessage(ev.replyToken, [
          { type: 'text', text: process.env.APP_MEDIA_REJECT_MSG || '目前暫不提供圖片、影片、音檔生成服務。' },
        ]);
        continue;
      }

      // 5-2) FAQ 命中
      const faqAns = matchFAQ(text, { minScore: 0.45 });
      if (faqAns) {
        await client.replyMessage(ev.replyToken, [
          { type: 'text', text: faqAns },
        ]);
        continue;
      }

      // 5-3) FAQ 未中 → 轉給 GPT
      const userId = ev?.source?.userId || '';
      const gpt = await askGPT({ text, userId });
      await client.replyMessage(ev.replyToken, [
        { type: 'text', text: gpt.slice(0, 5000) }, // LINE 單則最多 5000 字
      ]);
    } catch (e) {
      // 單則事件失敗：不阻斷整批處理，記錄並嘗試給使用者一則保底訊息
      try {
        if (ev?.replyToken) {
          await client.replyMessage(ev.replyToken, [
            { type: 'text', text: '抱歉，系統剛剛忙碌，請再試一次或改用其他說法。' },
          ]);
        }
      } catch {}
    }
  }

  // 6) 一律 200，避免 LINE 平台重試風暴
  return res.status(200).end();
}
