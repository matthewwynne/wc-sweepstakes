import { markPaidByLinkId } from '../../lib/db.js';
import { verifyWebhook, ENTRY_CENTS } from '../../lib/stitch.js';

export default async function handler(req, res){
  if (req.method !== 'POST'){ res.status(405).json({ error: 'method_not_allowed' }); return; }

  // Svix verification needs the RAW bytes. Collect Buffer chunks and concat them —
  // decoding each chunk to a string separately (raw += chunk) corrupts any multibyte
  // char split across a chunk boundary, which would break the HMAC and drop a real event.
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks);

  let payload;
  try {
    payload = verifyWebhook(raw, req.headers); // svix accepts a Buffer; returns the verified, parsed payload
  } catch {
    res.status(400).json({ error: 'bad_signature' });
    return;
  }

  // payment.paid payload: { amount, id (payment id), status:'PAID', type:'LINK',
  //   linkId, consentId, subscriptionId, terminalSessionId }. Map LINK payments
  //   back to a player via the stored payment-link id. Idempotent (UPDATE → true).
  const isPaidLink = payload && payload.status === 'PAID' && payload.type === 'LINK' && payload.linkId;
  if (!isPaidLink){
    res.status(200).json({ ok: true }); // nothing to record — ack so Svix doesn't retry
    return;
  }

  // Defense-in-depth: confirm the paid amount matches the entry fee before crediting a
  // player. A correctly-delivered event with the wrong amount isn't a transient failure,
  // so ack with 200 (don't trigger Svix retries) but skip the DB write.
  if (payload.amount !== ENTRY_CENTS){
    res.status(200).json({ ok: true, note: 'amount_mismatch' });
    return;
  }

  try {
    await markPaidByLinkId(payload.linkId);
    res.status(200).json({ ok: true });
  } catch (e){
    // Verified event but the DB write failed (e.g. transient Neon error). Return 5xx
    // so Svix retries with backoff — a 200 here would lose the payment permanently.
    res.status(500).json({ error: 'write_failed', detail: String(e) });
  }
}
