import crypto from 'crypto';
import * as line from '@line/bot-sdk';
import { handleEvents, printPrompts } from '../app/index.js';
import config from '../config/index.js';
import { isMediaGenerationRequest } from '../utils/policy.js';
import { matchFAQ } from '../utils/faq.js';

// 讀 raw body（Vercel 下可直接監聽 data/end）
async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifyLineSignature(rawBody, signature) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET || '';
  const hmac = crypto.createHmac('sha256', channelSecret);
  hmac.update(rawBody);
  const expected = hmac.digest('base64');
  return signature === expected;
}

export default async function handler(req, res) {
  // GET：給 LINE Verify 用
  if (req.method === 'GET') {
    return res.status(200).send('ok');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // 讀 raw body 以驗簽
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

  // FAQ / 媒體請求前置處理（可依你專案需求調整）
  const patchedPayload = {
    ...payload,
    events: events.map((ev) => {
      const text = ev?.message?.text || '';
      const isMedia = isMediaGenerationRequest({ text, event: ev });
      if (isMedia) return ev;
      if (ev?.type === 'message' && ev?.message?.type === 'text') {
        const ans = matchFAQ(text, { minScore: 0.45 });
        if (ans) return { ...ev, __faqHit: true, message: { ...ev.message, type: 'text', text: ans } };
      }
      return ev;
    }),
  };

  try {
    await handleEvents(patchedPayload);
    if (config.APP_DEBUG) printPrompts();
    return res.status(200).end();
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
