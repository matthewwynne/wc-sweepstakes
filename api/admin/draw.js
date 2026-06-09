import { runDraw, getState } from '../../lib/db.js';
import { methodGuard, readBody, requireAdmin } from '../_auth.js';

export default async function handler(req, res){
  if (!methodGuard(req, res, ['POST'])) return;
  if (!requireAdmin(req, res)) return;
  const { seed, force } = readBody(req);
  if (!seed) return res.status(400).json({ error: 'seed_required' });
  const r = await runDraw(seed, !!force);
  if (r.error === 'locked') return res.status(409).json({ error: 'already_locked' });
  if (r.error === 'need24') return res.status(400).json({ error: 'need_24_players', count: r.count });
  res.status(200).json(await getState());
}
