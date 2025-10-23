// api/debug-products.js
import { productCatalogStats, debugMatchProducts } from '../utils/products.js';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const q = url.searchParams.get('q') || '';

    const stats = productCatalogStats();
    const matches = q ? debugMatchProducts(q, { limit: 8, minScore: 0.35 }) : [];

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify({
      ok: true,
      q,
      stats,      // { exists, path, count, sampleNames: [...] }
      matches,    // [{score, name, spec, price, discount, plan, note}]
      hint: [
        '1) stats.exists=true 且 count>0 才表示 Vercel 已讀到 products.json。',
        '2) 帶 ?q=你的句子 可看分數與命中情況（score 越高越相關）。',
        '3) 若 exists=false：請確認 storage/products.json 有被推上 Git 並未被 .gitignore 排除。',
      ],
    }, null, 2));
  } catch (e) {
    res.status(500).send(JSON.stringify({ ok: false, error: String(e) }));
  }
}
