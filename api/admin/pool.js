import { upsertPool } from '../../lib/db.js';
import { methodGuard, readBody, requireAdmin } from '../_auth.js';

export default async function handler(req, res){
  if (!methodGuard(req, res, ['POST'])) return;
  if (!requireAdmin(req, res)) return;
  const { match_id, home, away } = readBody(req);
  if (!match_id) return res.status(400).json({ error: 'match_id_required' });
  await upsertPool(match_id, home ?? null, away ?? null);
  res.status(200).json({ ok: true });
}
