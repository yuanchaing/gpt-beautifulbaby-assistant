import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function handler(_req, res) {
  try {
    const faqPath = path.join(__dirname, '..', 'storage', 'faq.json');
    const exists = fs.existsSync(faqPath);
    const stat = exists ? fs.statSync(faqPath) : null;
    res.status(200).json({
      status: 'ok',
      faq: { exists, size: stat?.size || 0, mtime: stat?.mtime || null }
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}
