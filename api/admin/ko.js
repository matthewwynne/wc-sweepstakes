import { addKo, deleteKo } from '../../lib/db.js';
import { methodGuard, readBody, requireAdmin } from '../_auth.js';

export default async function handler(req, res){
  if (!methodGuard(req, res, ['POST','DELETE'])) return;
  if (!requireAdmin(req, res)) return;
  const body = readBody(req);
  if (req.method === 'DELETE'){
    if (body.id == null) return res.status(400).json({ error: 'id_required' });
    await deleteKo(body.id);
    return res.status(200).json({ ok: true });
  }
  const { round, a, b } = body;
  if (!round || !a || !b) return res.status(400).json({ error: 'round_teams_required' });
  if (a === b) return res.status(400).json({ error: 'same_team' });
  const sa = Number(body.as), sb = Number(body.bs);
  if (!Number.isInteger(sa) || sa < 0 || !Number.isInteger(sb) || sb < 0)
    return res.status(400).json({ error: 'invalid_score' });
  const id = await addKo({ round, a, b, as: sa, bs: sb, pen: body.pen });
  res.status(200).json({ id });
}
