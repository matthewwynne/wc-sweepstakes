import crypto from 'node:crypto';
import { playerExists, setPayment } from '../lib/db.js';
import { createPaymentRequest } from '../lib/stitch.js';
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
    const externalReference = 'sweep-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + crypto.randomUUID().slice(0, 8);
    const proto = (req.headers['x-forwarded-proto'] || 'https');
    const redirectUri = proto + '://' + req.headers.host + '/?pay=return';
    const { id, url } = await createPaymentRequest({ externalReference, redirectUri, amount: 250, payerIdentifier: name });
    await setPayment(name, externalReference, id);
    res.status(200).json({ url });
  } catch (e){
    res.status(500).json({ error: 'pay_failed', detail: String(e) });
  }
}
