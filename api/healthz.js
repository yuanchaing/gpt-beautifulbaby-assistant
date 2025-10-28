// api/healthz.js
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.status(200).json({
    ok: true,
    env: {
      NODE_ENV: process.env.NODE_ENV || null,
      PROJECT: process.env.VERCEL_PROJECT_PRODUCTION_URL || null
    },
    time: new Date().toISOString()
  });
}
