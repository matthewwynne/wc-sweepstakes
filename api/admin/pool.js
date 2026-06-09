import { upsertPool } from '../../lib/db.js';
import { methodGuard, readBody, requireAdmin } from '../_auth.js';

export default async function handler(req, res){
  if (!methodGuard(req, res, ['POST'])) return;
  if (!requireAdmin(req, res)) return;
  const { match_id, home, away } = readBody(req);
  if (!match_id) return res.status(400).json({ error: 'match_id_required' });
  const coerce = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) return undefined;
    return n;
  };
  const h = coerce(home);
  const a = coerce(away);
  if (h === undefined || a === undefined) return res.status(400).json({ error: 'invalid_score' });
  await upsertPool(match_id, h, a);
  res.status(200).json({ ok: true });
}
