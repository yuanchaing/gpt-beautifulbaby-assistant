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
} = process.env;

/**
 * 以人設優化 FAQ 回覆，保持事實不變、不臆測。
 * @param {object} payload
 * @param {string} payload.question 原始問題（可無）
 * @param {string} payload.rawAnswer FAQ 原始答案（必填）
 * @param {number} [payload.maxLen=200] 期望最大字數
 * @returns {Promise<string>}
 */
export async function refineWithPersona({ question = '', rawAnswer, maxLen = 200 }) {
  if (!rawAnswer) return '';

  // system：APP_INIT_PROMPT + BOT 名稱/語氣，讓模型從一開始就知道人設邊界
  const system = [
    APP_INIT_PROMPT?.trim() || '',
    `你現在的身份是「${BOT_NAME || 'AI'}」。語氣（Tone）：${BOT_TONE || '自然、專業、友善'}`,
    '請嚴格避免捏造/臆測，不要加入 FAQ 未提供的新事實。',
  ].filter(Boolean).join('\n');

  const humanKickoff = (HUMAN_INIT_PROMPT || '').trim();
  const botKickoff = (BOT_INIT_PROMPT || '').trim();

  const langHint = (() => {
    // 與官方文件一致，APP_LANG 支援 zh_TW / zh_CN / en / ja
    switch (APP_LANG) {
      case 'zh_TW':
        return '請使用繁體中文回覆。';
      case 'zh_CN':
        return '请使用简体中文回复。';
      case 'en':
        return 'Reply in natural English.';
      case 'ja':
        return '日本語で回答してください。';
      default:
        return 'Reply in the user locale.';
    }
  })();

  const instruction = [
    '請依人設優化下列 FAQ 回覆內容，但必須保持事實與原意不變：',
    '— 可重寫句子使更友善、具體、好讀。',
    '— 可加入簡短的步驟化條列，但不要新增未提供的新事實。',
    `— 最多 ${maxLen} 字；必要時可用項目符號。`,
    '— 若包含連結，請保留原網址。',
    langHint,
    '',
    question ? `【原始問題】\n${question}\n` : '',
    `【原始答案】\n${rawAnswer}`,
  ].join('\n');

  const messages = [
    { role: 'system', content: system },
    ...(humanKickoff ? [{ role: 'user', content: humanKickoff }] : []),
    ...(botKickoff ? [{ role: 'assistant', content: botKickoff }] : []),
    { role: 'user', content: instruction },
  ];

  const refined = await chatCompletions(messages);
  return (refined || '').trim();
}
