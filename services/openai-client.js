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
  OPENAI_COMPLETION_STOP_SEQUENCES, // e.g. "assistant:,user:"
  OPENAI_TIMEOUT, // 可留空用預設
} = process.env;

const TIMEOUT_MS = Number(OPENAI_TIMEOUT || 9000);

export async function chatCompletions(messages) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const body = {
    model: OPENAI_COMPLETION_MODEL,
    messages,
    temperature: Number(OPENAI_COMPLETION_TEMPERATURE),
    max_tokens: Number(OPENAI_COMPLETION_MAX_TOKENS),
    frequency_penalty: Number(OPENAI_COMPLETION_FREQUENCY_PENALTY),
    presence_penalty: Number(OPENAI_COMPLETION_PRESENCE_PENALTY),
  };

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
