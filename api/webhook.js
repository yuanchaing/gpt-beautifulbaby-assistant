// api/webhook.js
import crypto from 'crypto';
import * as line from '@line/bot-sdk';
import { isMediaGenerationRequest } from '../utils/policy.js';
import { matchFAQ } from '../utils/faq.js';
import fetch from 'node-fetch'; // 保險：即使在 Node 18 全域 fetch，可確保本檔有 fetch 可用
import { refineWithPersona } from '../services/faq-refiner.js';

// ====== OpenAI 設定（環境變數）======
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_COMPLETION_MODEL = process.env.OPENAI_COMPLETION_MODEL || 'gpt-4o-mini';

// FAQ 優化輸出長度（預設 250 字）
const FAQ_REFINED_MAXLEN = Number(process.env.FAQ_REFINED_MAXLEN || 250);

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

// ====== 簡易 GPT 封裝（一般對話用）======
async function askGPT({ text, userId }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.OPENAI_TIMEOUT || 9000));

  const system = [
    '你是專業的中文客服助理，回答需：',
    '1) 口吻親切、簡潔、具體；',
    '2) 優先以繁體中文；',
    '3) 若問題與門市資訊、營業時間、活動、優惠相關、地點，給出清楚步驟或要點；',
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
      const msg = await resp.text().catch(() => '');
      throw new Error(`OpenAI error ${resp.status} ${msg}`);
    }

    const json = await resp.json();
    return json?.choices?.[0]?.message?.content ?? '（無回覆）';
  } catch (e) {
    clearTimeout(timeout);
    return '抱歉，我現在有點忙碌，請稍後再試或換個說法提問。';
  }
}

export default async function handler(req, res) {
  // 1) 讀 raw body、做簽章驗證
  const rawBody = await readRawBody(req);
  const signature = req.headers['x-line-signature'];
  if (!verifyLineSignature(rawBody, signature)) {
    return res.status(401).send('Invalid signature');
  }

  // 2) 解析 events
  const body = JSON.parse(rawBody.toString('utf-8') || '{}');
  const events = body?.events || [];

  // 3) LINE Verify 測試：立刻 200
  if (isLineVerifyTestEvent(events)) {
    return res.status(200).end();
  }

  // 4) 並行逐則處理
  for (const ev of events) {
    try {
      // 僅處理文字訊息；其他型別可視需求擴充
      if (ev?.type !== 'message' || ev?.message?.type !== 'text') continue;
      const text = (ev.message.text || '').trim();

      // 4-1) 圖片/影片/音檔生成類需求 → 媒體策略拒絕
      if (isMediaGenerationRequest({ text, event: ev })) {
        await client.replyMessage(ev.replyToken, [
          { type: 'text', text: process.env.APP_MEDIA_REJECT_MSG || '目前暫不提供圖片、影片、音檔生成服務。' },
        ]);
        continue;
      }

      // 4-2) FAQ 命中 → 走「人設優化」後回覆
      const faqAns = matchFAQ(text, { minScore: 0.45 });
      if (faqAns) {
        let finalText = faqAns;
        try {
          const refined = await refineWithPersona({
            question: text,
            rawAnswer: faqAns,
            maxLen: FAQ_REFINED_MAXLEN,
          });
          if (refined) finalText = refined;
        } catch (e) {
          // 若優化失敗，fallback 原 FAQ
        }

        await client.replyMessage(ev.replyToken, [
          { type: 'text', text: finalText.slice(0, 5000) },
        ]);
        continue;
      }

      // 4-3) FAQ 未中 → 轉給 GPT 一般對話
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

  // 5) 一律 200，避免 LINE 平台重試風暴
  return res.status(200).end();
}
