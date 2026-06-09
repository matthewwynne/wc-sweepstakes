import { markPaidByRef } from '../../lib/db.js';
import { verifyWebhook } from '../../lib/stitch.js';

export default async function handler(req, res){
  if (req.method !== 'POST'){ res.status(405).json({ error: 'method_not_allowed' }); return; }
  let raw = ''; for await (const chunk of req) raw += chunk;
  const sig = req.headers['x-stitch-signature'] || '';
  if (!verifyWebhook(sig, raw)){ res.status(401).json({ error: 'bad_signature' }); return; }
  let payload; try { payload = JSON.parse(raw); } catch { res.status(400).json({ error: 'bad_json' }); return; }
  try {
    const node = payload?.data?.client?.paymentInitiationRequests?.node || {};
    const state = node.state || node.status || '';
    const ref = node.externalReference;
    if (ref && /complete/i.test(String(state))) await markPaidByRef(ref);
    res.status(200).json({ ok: true });
  } catch (e){ res.status(200).json({ ok: true, note: String(e) }); }
}
