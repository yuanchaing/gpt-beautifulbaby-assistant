// api/webhook.js
import crypto from 'crypto';
import * as line from '@line/bot-sdk';
import { isMediaGenerationRequest } from '../utils/policy.js';
import { matchFAQ } from '../utils/faq.js';
import fetch from 'node-fetch';
import { refineWithPersona } from '../services/faq-refiner.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_COMPLETION_MODEL = process.env.OPENAI_COMPLETION_MODEL || 'gpt-4o-mini';

// 由 faq-refiner 讀取 FAQ_REFINED_MAXLEN；這裡保留可選覆寫（通常不填）
const FAQ_REFINED_MAXLEN = (
  process.env.FAQ_REFINED_MAXLEN !== undefined
    ? Number(process.env.FAQ_REFINED_MAXLEN)
    : undefined
);

// LINE Bot 憑證
const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifyLineSignature(rawBody, signature) {
  const secret = process.env.LINE_CHANNEL_SECRET || '';
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const expected = hmac.digest('base64');
  return signature === expected;
}

function isLineVerifyTestEvent(events = []) {
  const TEST_TOKENS = new Set([
    '00000000000000000000000000000000',
    'ffffffffffffffffffffffffffffffff',
  ]);
  return events.some((ev) => ev?.replyToken && TEST_TOKENS.has(ev.replyToken));
}

// 一般對話（與本需求無關，保留原限制）
async function askGPT({ text }) {
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
  const rawBody = await readRawBody(req);
  const signature = req.headers['x-line-signature'];
  if (!verifyLineSignature(rawBody, signature)) {
    return res.status(401).send('Invalid signature');
  }

  const body = JSON.parse(rawBody.toString('utf-8') || '{}');
  const events = body?.events || [];

  if (isLineVerifyTestEvent(events)) {
    return res.status(200).end();
  }

  for (const ev of events) {
    try {
      if (ev?.type !== 'message' || ev?.message?.type !== 'text') continue;
      const text = (ev.message.text || '').trim();

      if (isMediaGenerationRequest({ text, event: ev })) {
        await client.replyMessage(ev.replyToken, [
          { type: 'text', text: process.env.APP_MEDIA_REJECT_MSG || '目前暫不提供圖片、影片、音檔生成服務。' },
        ]);
        continue;
      }

      // FAQ 命中 → 交給人設優化（此路徑可「不限制字數」）
      const faqAns = matchFAQ(text, { minScore: 0.45 });
      if (faqAns) {
        let finalText = faqAns;
        try {
          const refined = await refineWithPersona({
            question: text,
            rawAnswer: faqAns,
            // 若 FAQ_REFINED_MAXLEN <= 0 或未填，代表不限制字數
            maxLen: FAQ_REFINED_MAXLEN,
          });
          if (refined) finalText = refined;
        } catch (e) {
          // fallback 原 FAQ
        }

        await client.replyMessage(ev.replyToken, [
          { type: 'text', text: finalText.slice(0, 5000) }, // LINE 單則最多 5000 字
        ]);
        continue;
      }

      // 未命中 FAQ → 一般對話
      const gpt = await askGPT({ text });
      await client.replyMessage(ev.replyToken, [
        { type: 'text', text: gpt.slice(0, 5000) },
      ]);
    } catch (e) {
      try {
        if (ev?.replyToken) {
          await client.replyMessage(ev.replyToken, [
            { type: 'text', text: '抱歉，系統剛剛忙碌，請再試一次或改用其他說法。' },
          ]);
        }
      } catch {}
    }
  }

  return res.status(200).end();
}
