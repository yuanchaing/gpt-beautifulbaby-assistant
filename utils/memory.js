// utils/memory.js
// 超輕量「上一題」暫存（無資料庫）。注意：Serverless 僅在同一實例的 warm 期間有效。
const store = new Map(); // key: userId, value: { text, expireAt }
const DEFAULT_TTL_MS = Number(process.env.LAST_Q_TTL_MS || 10 * 60 * 1000); // 10 分鐘

export function rememberLastQuestion(userId, text, ttlMs = DEFAULT_TTL_MS) {
  if (!userId || !text) return;
  const expireAt = Date.now() + ttlMs;
  store.set(userId, { text, expireAt });
}

export function getLastQuestion(userId) {
  if (!userId) return null;
  const rec = store.get(userId);
  if (!rec) return null;
  if (Date.now() > rec.expireAt) {
    store.delete(userId);
    return null;
  }
  return rec.text;
}

export function clearLastQuestion(userId) {
  if (!userId) return;
  store.delete(userId);
}
