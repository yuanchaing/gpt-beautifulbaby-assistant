// services/openai-client.js
import fetch from 'node-fetch';

const {
  OPENAI_API_KEY,
  OPENAI_BASE_URL = 'https://api.openai.com',
  OPENAI_COMPLETION_MODEL = 'gpt-4.1-2025-04-14',
  OPENAI_COMPLETION_TEMPERATURE = '0.9',
  OPENAI_COMPLETION_MAX_TOKENS = '160',
  OPENAI_COMPLETION_FREQUENCY_PENALTY = '0',
  OPENAI_COMPLETION_PRESENCE_PENALTY = '0.6',
  OPENAI_COMPLETION_STOP_SEQUENCES,
  OPENAI_TIMEOUT,
} = process.env;

const TIMEOUT_MS = Number(OPENAI_TIMEOUT || 9000);

/**
 * Chat Completions 包裝
 * @param {Array<{role:'system'|'user'|'assistant',content:string}>} messages
 * @param {Object} [options]
 * @param {number|null|undefined} [options.max_tokens] - 覆寫最大 tokens；若為 null 表示不設定此欄位
 * @param {number} [options.temperature] - 覆寫溫度
 */
export async function chatCompletions(messages, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const body = {
    model: OPENAI_COMPLETION_MODEL,
    messages,
    temperature: options.temperature !== undefined
      ? Number(options.temperature)
      : Number(OPENAI_COMPLETION_TEMPERATURE),
    frequency_penalty: Number(OPENAI_COMPLETION_FREQUENCY_PENALTY),
    presence_penalty: Number(OPENAI_COMPLETION_PRESENCE_PENALTY),
  };

  // 只有在 options.max_tokens === null 時，才完全不帶 max_tokens 欄位
  if (options.max_tokens === null) {
    // omit
  } else {
    body.max_tokens = Number(
      options.max_tokens !== undefined ? options.max_tokens : OPENAI_COMPLETION_MAX_TOKENS
    );
  }

  if (OPENAI_COMPLETION_STOP_SEQUENCES) {
    body.stop = OPENAI_COMPLETION_STOP_SEQUENCES.split(',').map(s => s.trim());
  }

  const res = await fetch(`${OPENAI_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).catch((e) => {
    clearTimeout(id);
    throw e;
  });

  clearTimeout(id);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content ?? '';
  return content;
}
