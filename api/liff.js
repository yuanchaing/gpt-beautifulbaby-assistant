export default function handler(_req, res) {
  res.status(200).json({ liffId: process.env.LIFF_ID || '' });
}
