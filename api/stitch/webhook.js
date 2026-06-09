import { markPaidByLinkId } from '../../lib/db.js';
import { verifyWebhook } from '../../lib/stitch.js';

export default async function handler(req, res){
  if (req.method !== 'POST'){ res.status(405).json({ error: 'method_not_allowed' }); return; }

  // Svix verification requires the RAW request body — do not JSON.parse first.
  let raw = ''; for await (const chunk of req) raw += chunk;

  let payload;
  try {
    payload = verifyWebhook(raw, req.headers); // returns the verified, parsed payload
  } catch {
    res.status(400).json({ error: 'bad_signature' });
    return;
  }

  try {
    // payment.paid payload: { amount, id (payment id), status:'PAID', type:'LINK',
    //   linkId, consentId, subscriptionId, terminalSessionId }. We map LINK payments
    //   back to a player via the stored payment-link id. Idempotent (UPDATE → true).
    if (payload && payload.status === 'PAID' && payload.type === 'LINK' && payload.linkId){
      await markPaidByLinkId(payload.linkId);
    }
    res.status(200).json({ ok: true });
  } catch (e){
    // Still 2xx so Svix doesn't retry-storm on our internal errors.
    res.status(200).json({ ok: true, note: String(e) });
  }
}
