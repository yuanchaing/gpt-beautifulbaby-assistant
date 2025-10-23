// services/faq-refiner.js
import { chatCompletions } from './openai-client.js';

const {
  APP_LANG = 'zh_TW',
  APP_INIT_PROMPT = '',
  HUMAN_NAME = '',
  HUMAN_INIT_PROMPT = '',
  BOT_NAME = 'AI',
  BOT_INIT_PROMPT = '',
  BOT_TONE = '',
  FAQ_REFINED_MAXLEN, // 允許空
} = process.env;

/**
 * 以人設優化 FAQ 回覆，保持事實不變、不臆測。
 * @param {object} payload
 * @param {string} payload.question 原始問題（可無）
 * @param {string} payload.rawAnswer FAQ 原始答案（必填）
 * @param {number} [payload.maxLen] 覆寫最大字數；<=0 或未填表示不限制
 * @returns {Promise<string>}
 */
export async function refineWithPersona({ question = '', rawAnswer, maxLen }) {
  if (!rawAnswer) return '';

  // 最終限制值：優先使用參數，其次使用環境變數；<=0 或 NaN → 視為不限制
  const envLen = Number(FAQ_REFINED_MAXLEN);
  const mergedLen = (typeof maxLen === 'number') ? maxLen : envLen;
  const unlimited = !mergedLen || Number.isNaN(mergedLen) || mergedLen <= 0;

  const system = [
    APP_INIT_PROMPT?.trim() || '',
    `你現在的身份是「${BOT_NAME || 'AI'}」。語氣（Tone）：${BOT_TONE || '自然、專業、友善'}`,
    '請嚴格避免捏造/臆測，不要加入 FAQ 未提供的新事實。',
  ].filter(Boolean).join('\n');

  const humanKickoff = (HUMAN_INIT_PROMPT || '').trim();
  const botKickoff = (BOT_INIT_PROMPT || '').trim();

  const langHint = (() => {
    switch (APP_LANG) {
      case 'zh_TW': return '請使用繁體中文回覆。';
      case 'zh_CN': return '请使用简体中文回复。';
      case 'en':   return 'Reply in natural English.';
      case 'ja':   return '日本語で回答してください。';
      default:     return 'Reply in the user locale.';
    }
  })();

  const rules = [
    '請依人設優化下列 FAQ 回覆內容，但必須保持事實與原意不變：',
    '— 可重寫句子使更友善、具體、好讀。',
    '— 可加入簡短的步驟化條列，但不要新增未提供的新事實。',
  ];

  // 只有在有限制時才加入長度提示
  if (!unlimited) {
    rules.push(`— 最多 ${mergedLen} 字；必要時可用項目符號。`);
  } else {
    // 不限制：可鼓勵充分敘述，但仍保持重點清楚
    rules.push('— 盡量完整詳盡，條理清晰；必要時使用條列與小標。');
  }

  rules.push(langHint, '');

  const instruction = [
    ...rules,
    question ? `【原始問題】\n${question}\n` : '',
    `【原始答案】\n${rawAnswer}`,
  ].join('\n');

  const messages = [
    { role: 'system', content: system },
    ...(humanKickoff ? [{ role: 'user', content: humanKickoff }] : []),
    ...(botKickoff ? [{ role: 'assistant', content: botKickoff }] : []),
    { role: 'user', content: instruction },
  ];

  // 不限制字數 → 不帶 max_tokens；否則沿用預設
  const options = unlimited ? { max_tokens: null } : {};
  const refined = await chatCompletions(messages, options);
  return (refined || '').trim();
}
