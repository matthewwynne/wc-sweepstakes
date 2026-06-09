// Stitch Express REST API client (https://express.stitch.money/api/v1).
// NOTE: this is the *Express* product — a separate API from the Stitch
// Enterprise/Connect GraphQL API at api.stitch.money. Amounts are in ZAR cents.
import { Webhook } from 'svix';

const BASE = 'https://express.stitch.money/api/v1';

// R250 entry fee, in South African cents (5000 = R50.00).
export const ENTRY_CENTS = 25000;

// Short-lived (15min) bearer token via clientId/clientSecret. Low volume, so we
// fetch a fresh token per call rather than caching across warm invocations.
export async function getToken(){
  const res = await fetch(`${BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: process.env.STITCH_CLIENT_ID,
      clientSecret: process.env.STITCH_CLIENT_SECRET
      // scope defaults to client_paymentrequest, which covers payment links
    })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.data?.accessToken){
    throw new Error('stitch_token_failed: ' + res.status + ' ' + JSON.stringify(body));
  }
  return body.data.accessToken;
}

// Create a payment link. Returns { id, link } where `link` is the short checkout
// URL and `id` is the payment-link id (matched against the webhook's linkId).
export async function createPaymentLink({ payerName, merchantReference, amount = ENTRY_CENTS }){
  const token = await getToken();
  const res = await fetch(`${BASE}/payment-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ amount, payerName, merchantReference })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.data?.payment?.link){
    throw new Error('stitch_create_link_failed: ' + res.status + ' ' + JSON.stringify(body));
  }
  const p = body.data.payment;
  return { id: p.id, link: p.link };
}

// Verify a Svix-signed webhook. Pass the RAW request body (string/Buffer) and the
// svix-* headers. Returns the verified, parsed payload; throws on bad signature.
export function verifyWebhook(rawBody, headers){
  const wh = new Webhook(process.env.STITCH_WEBHOOK_SECRET);
  return wh.verify(rawBody, {
    'svix-id': headers['svix-id'],
    'svix-timestamp': headers['svix-timestamp'],
    'svix-signature': headers['svix-signature']
  });
}
