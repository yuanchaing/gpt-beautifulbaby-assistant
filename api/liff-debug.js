// api/liff-debug.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const body = await getJSON(req);
    // 印在 Vercel Function Logs（Deployments → Production → Functions → api/liff-debug）
    console.log('[LIFF-DEBUG]', JSON.stringify(body, null, 2));

    // 回傳一個簡單的 id（時間戳），你回報給我時可附上
    const id = Date.now();
    return res.status(200).json({ ok: true, id });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e?.message || String(e) });
  }
}

function getJSON(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
