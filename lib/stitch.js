import crypto from 'node:crypto';

const TOKEN_URL = 'https://secure.stitch.money/connect/token';
const API = 'https://api.stitch.money/v2';

export async function getToken(){
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.STITCH_CLIENT_ID,
    client_secret: process.env.STITCH_CLIENT_SECRET,
    scope: 'client_paymentrequest',
    audience: TOKEN_URL
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok){
    const text = await res.text();
    throw new Error(`Stitch token request failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return json.access_token;
}

export async function createPaymentRequest({ externalReference, redirectUri, amount = 250, payerIdentifier }){
  const token = await getToken();
  const expireAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(`${API}/payment-requests`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: { currency: 'ZAR', quantity: amount },
      externalReference,
      expireAt,
      payer: { identifier: payerIdentifier },
      paymentMethods: { card: { enabled: true, applePay: { enabled: true } } }
    })
  });
  if (!res.ok){
    const text = await res.text();
    throw new Error(`Stitch payment request failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  const id = json.id;
  const interaction = json.interaction;
  const url = interaction.url + (interaction.url.includes('?') ? '&' : '?') + 'redirect_uri=' + encodeURIComponent(redirectUri);
  return { id, url };
}

export function verifyWebhook(signatureHeader, rawBody, secret = process.env.STITCH_WEBHOOK_SECRET){
  if (!signatureHeader) return false;
  let ts, hash;
  for (const part of String(signatureHeader).split(',')){
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === 't') ts = v;
    else if (k === 'hmac_sha256') hash = v;
  }
  if (!ts || !hash) return false;
  const expected = crypto.createHmac('sha256', secret).update(ts + '.' + rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
