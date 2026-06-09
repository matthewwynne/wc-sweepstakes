import { setPaymentsEnabled, getState } from '../../lib/db.js';
import { methodGuard, readBody, requireAdmin } from '../_auth.js';

// Admin: turn in-app payments on/off (kept off until the Stitch production
// account is active — players can still confirm entry in the meantime).
export default async function handler(req, res){
  if (!methodGuard(req, res, ['POST'])) return;
  if (!requireAdmin(req, res)) return;
  const { enabled } = readBody(req);
  await setPaymentsEnabled(!!enabled);
  res.status(200).json(await getState());
}
