import { confirmPlayer } from '../lib/db.js';
import { methodGuard, readBody } from './_auth.js';

export default async function handler(req, res){
  if (!methodGuard(req, res, ['POST'])) return;
  const { name } = readBody(req);
  if (!name) return res.status(400).json({ error: 'name_required' });
  const ok = await confirmPlayer(name);
  if (!ok) return res.status(400).json({ error: 'not_on_roster' });
  res.status(200).json({ ok: true });
}
