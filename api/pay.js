import crypto from 'node:crypto';
import { playerExists, setPayment } from '../lib/db.js';
import { createPaymentLink, ENTRY_CENTS } from '../lib/stitch.js';
import { methodGuard, readBody } from './_auth.js';

export default async function handler(req, res){
  if (!methodGuard(req, res, ['POST'])) return;
  const { name } = readBody(req);
  if (!name){
    res.status(400).json({ error: 'missing_name' });
    return;
  }
  if (!await playerExists(name)){
    res.status(400).json({ error: 'not_on_roster' });
    return;
  }
  try {
    // merchantReference: alphanumeric, spaces and hyphens only (Stitch pattern).
    const merchantReference = 'sweep-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + crypto.randomUUID().slice(0, 8);
    const { id, link } = await createPaymentLink({ payerName: name, merchantReference, amount: ENTRY_CENTS });

    // Send the payer back to our (pre-registered) site after checkout. Stitch
    // appends ?reference=...&payment_id=... to this URL. SITE_URL must be one of
    // the redirect URLs registered via POST /api/v1/redirect-urls.
    const origin = process.env.SITE_URL || ((req.headers['x-forwarded-proto'] || 'https') + '://' + req.headers.host);
    const url = link + (link.includes('?') ? '&' : '?') + 'redirect_url=' + encodeURIComponent(origin);

    // Store the payment-link id (matched against the webhook's linkId) + our ref.
    await setPayment(name, merchantReference, id);
    res.status(200).json({ url });
  } catch (e){
    res.status(500).json({ error: 'pay_failed', detail: String(e) });
  }
}
