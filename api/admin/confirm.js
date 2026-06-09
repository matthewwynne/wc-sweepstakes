import { setConfirmed, playerExists } from '../../lib/db.js';
import { methodGuard, readBody, requireAdmin } from '../_auth.js';

// Admin override of a player's confirmation (the public /api/confirm only sets it
// true; this can also clear a mistaken "I'm in").
export default async function handler(req, res){
  if (!methodGuard(req, res, ['POST'])) return;
  if (!requireAdmin(req, res)) return;
  const { name, confirmed } = readBody(req);
  if (!name) return res.status(400).json({ error: 'name_required' });
  if (!await playerExists(name)) return res.status(400).json({ error: 'not_on_roster' });
  await setConfirmed(name, !!confirmed);
  res.status(200).json({ ok: true });
}
