// api/webhook.js
import crypto from 'crypto';
import * as line from '@line/bot-sdk';
import { handleEvents, printPrompts } from '../app/index.js';
import config from '../config/index.js';
import { isMediaGenerationRequest } from '../utils/policy.js';
import { matchFAQ } from '../utils/faq.js';

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
  // LINE Verify 測試事件常用兩種 token：all-zero 與 all-f
  const TEST_TOKENS = new Set([
    '00000000000000000000000000000000',
    'ffffffffffffffffffffffffffffffff'
  ]);
  return events.some(ev => ev?.replyToken && TEST_TOKENS.has(ev.replyToken));
}

export default async function handler(req, res) {
  // GET：給 LINE 後台 Verify 頁先測（手動點網址）
  if (req.method === 'GET') {
    return res.status(200).send('ok');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // 讀 raw body 並驗簽
  const rawBody = await readRawBody(req);
  const signature = req.headers['x-line-signature'] || '';
  if (!verifyLineSignature(rawBody, signature)) {
    // 簽章錯誤一律回 401，協助你在 LINE 後台分辨憑證是否正確
    return res.status(401).json({ error: 'invalid_signature' });
  }

  // 解析內容
  let payload = {};
  try {
    payload = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    return res.status(400).json({ error: 'invalid_json' });
  }

  const events = Array.isArray(payload.events) ? payload.events : [];

  // ✅ 關鍵：遇到 LINE Verify 的測試事件，直接 200，避免你的業務邏輯嘗試 reply 造成 500
  if (isLineVerifyTestEvent(events) || events.length === 0) {
    return res.status(200).end();
  }

  // 正常事件：先做 FAQ / 媒體請求預處理
  const patchedPayload = {
    ...payload,
    events: events.map((ev) => {
      const text = ev?.message?.text || '';
      const isMedia = isMediaGenerationRequest({ text, event: ev });
      if (isMedia) return ev;
      if (ev?.type === 'message' && ev?.message?.type === 'text') {
        const ans = matchFAQ(text, { minScore: 0.45 });
        if (ans) {
          return { ...ev, __faqHit: true, message: { ...ev.message, type: 'text', text: ans } };
        }
      }
      return ev;
    }),
  };

  try {
    await handleEvents(patchedPayload);
    if (config.APP_DEBUG) printPrompts();
    return res.status(200).end();
  } catch (e) {
    // 任何未預期錯誤，仍回 200，避免 LINE 重試；同時回傳錯誤訊息協助除錯
    return res.status(200).json({ warning: 'handled_with_error', detail: e?.message || String(e) });
  }
}
