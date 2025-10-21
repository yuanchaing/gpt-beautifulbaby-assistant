// api/webhook.js
import crypto from 'crypto';
import * as line from '@line/bot-sdk';
import { handleEvents, printPrompts } from '../app/index.js';
import config from '../config/index.js';
import { isMediaGenerationRequest } from '../utils/policy.js';
import { matchFAQ } from '../utils/faq.js';

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
    'ffffffffffffffffffffffffffffffff'
  ]);
  return events.some(ev => ev?.replyToken && TEST_TOKENS.has(ev.replyToken));
}

export default async function handler(req, res) {
  // GET：給 LINE 後台手動點擊「驗證」的頁面先測
  if (req.method === 'GET') {
    return res.status(200).send('ok');
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers['x-line-signature'] || '';
  if (!verifyLineSignature(rawBody, signature)) {
    return res.status(401).json({ error: 'invalid_signature' });
  }

  let payload = {};
  try {
    payload = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    return res.status(400).json({ error: 'invalid_json' });
  }

  const events = Array.isArray(payload.events) ? payload.events : [];

  // LINE 後台 Verify 的測試事件：直接 200，避免誤觸業務邏輯
  if (isLineVerifyTestEvent(events) || events.length === 0) {
    return res.status(200).end();
  }

  // 先做簡單的 FAQ / 媒體策略預處理
  const patchedPayload = {
    ...payload,
    events: events.map((ev) => {
      const text = ev?.message?.text || '';
      const isMedia = isMediaGenerationRequest({ text, event: ev });
      if (isMedia) return ev; // 交給策略層處理拒絕
      if (ev?.type === 'message' && ev?.message?.type === 'text') {
        const ans = matchFAQ(text, { minScore: 0.45 });
        if (ans) return { ...ev, __faqHit: true, message: { ...ev.message, type: 'text', text: ans } };
      }
      return ev;
    }),
  };

  // 正式執行你原本的邏輯；若失敗就保底回覆
  try {
    await handleEvents(patchedPayload);
    if (config.APP_DEBUG) printPrompts();
    return res.status(200).end();
  } catch (e) {
    // === 保底：逐筆回覆「已收到」或 FAQ 結果，避免聊天室沒回應 ===
    try {
      for (const ev of events) {
        if (ev?.type !== 'message' || ev?.message?.type !== 'text') continue;
        const text = ev.message.text || '';
        const faq = matchFAQ(text, { minScore: 0.45 });
        const replyText = faq || `已收到：${text}`;
        await client.replyMessage(ev.replyToken, [{ type: 'text', text: replyText }]);
      }
      // 回 200，避免 LINE 重試
      return res.status(200).json({ fallback: true, detail: e?.message || String(e) });
    } catch (e2) {
      // 即便 fallback 也失敗了，還是回 200，避免重複打擾使用者
      return res.status(200).json({ fallback: false, error: e2?.message || String(e2) });
    }
  }
}
