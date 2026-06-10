// ── CUSTOMER EMAIL via Microsoft Graph ───────────────────────────────────────
// Sends as a real @iconremodelinggroup.com mailbox through Microsoft 365.
// Replaces the dead Gmail/nodemailer version (Google blocks SMTP from cloud
// servers with WebLoginRequired). No DNS changes needed — uses the M365
// tenant that already sends the company's everyday email.
//
// Required Vercel env vars (Production + Preview):
//   MS_TENANT_ID     — Directory (tenant) ID from the Azure app registration
//   MS_CLIENT_ID     — Application (client) ID
//   MS_CLIENT_SECRET — Client secret VALUE (not the secret ID)
//   MS_SENDER        — Mailbox to send from, e.g. rross@iconremodelinggroup.com

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, subject, message } = req.body || {};
  if (!to || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, message' });
  }

  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_SENDER } = process.env;
  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET || !MS_SENDER) {
    return res.status(500).json({ error: 'Email service not configured (missing MS_* env vars)' });
  }

  try {
    // 1. Get an app-only access token (client credentials flow)
    const tokenResp = await fetch(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    });
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) {
      console.error('Token error:', tokenData);
      return res.status(502).json({ error: 'Auth with Microsoft failed', detail: tokenData.error_description || tokenData.error });
    }

    // 2. Send the mail as the configured mailbox
    const html = String(message).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    const sendResp = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MS_SENDER)}/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: html },
          toRecipients: String(to).split(',').map(s => s.trim()).filter(Boolean).map(address => ({ emailAddress: { address } })),
        },
        saveToSentItems: true,
      }),
    });

    if (sendResp.status === 202) return res.status(200).json({ success: true });
    const errBody = await sendResp.json().catch(() => ({}));
    console.error('Graph sendMail error:', sendResp.status, errBody);
    return res.status(502).json({ error: 'Failed to send email', detail: errBody?.error?.message || `Graph status ${sendResp.status}` });
  } catch (err) {
    console.error('Email error:', err);
    return res.status(500).json({ error: 'Failed to send email', detail: err.message });
  }
};
