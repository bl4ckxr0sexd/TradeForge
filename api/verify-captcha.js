// Vercel serverless function: POST { token } -> { url } once Google confirms
// the reCAPTCHA v2 token. The real installer URL never reaches the client
// (or the page source) until this succeeds.
//
// Requires two Vercel Project → Settings → Environment Variables entries
// (Production) — NOT in the repo's .env, since one of these is a secret:
//   RECAPTCHA_SECRET_KEY  — secret key from google.com/recaptcha/admin
//   DOWNLOAD_URL           — same installer URL as .env's DOWNLOAD_URL

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secret = process.env.RECAPTCHA_SECRET_KEY;
  const downloadUrl = process.env.DOWNLOAD_URL;
  if (!secret || !downloadUrl) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  const token = req.body && req.body.token;
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Missing token' });
    return;
  }

  const params = new URLSearchParams({
    secret,
    response: token,
    remoteip: req.headers['x-forwarded-for'] || '',
  });

  let verify;
  try {
    const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    verify = await verifyRes.json();
  } catch (err) {
    res.status(502).json({ error: 'Verification service unreachable' });
    return;
  }

  if (!verify.success) {
    res.status(403).json({ error: 'Captcha verification failed' });
    return;
  }

  res.status(200).json({ url: downloadUrl });
};
