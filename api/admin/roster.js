import { setRoster, getState } from '../../lib/db.js';
import { methodGuard, readBody, requireAdmin } from '../_auth.js';

export default async function handler(req, res){
  if (!methodGuard(req, res, ['POST'])) return;
  if (!requireAdmin(req, res)) return;
  const { names } = readBody(req);
  if (!Array.isArray(names) || names.length === 0) return res.status(400).json({ error: 'names_required' });
  const state = await getState();
  if (state.locked) return res.status(409).json({ error: 'locked' });
  const clean = names.map(s => String(s).trim()).filter(Boolean);
  if (clean.length === 0) return res.status(400).json({ error: 'empty_roster' });
  await setRoster(clean);
  res.status(200).json(await getState());
}
