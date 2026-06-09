import { setPaid } from '../../lib/db.js';
import { methodGuard, readBody, requireAdmin } from '../_auth.js';

export default async function handler(req, res){
  if (!methodGuard(req, res, ['POST'])) return;
  if (!requireAdmin(req, res)) return;
  const { name, paid } = readBody(req);
  if (!name) return res.status(400).json({ error: 'name_required' });
  await setPaid(name, paid);
  res.status(200).json({ ok: true });
}
