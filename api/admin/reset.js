import { resetGame, getState } from '../../lib/db.js';
import { methodGuard, requireAdmin } from '../_auth.js';

export default async function handler(req, res){
  if (!methodGuard(req, res, ['POST'])) return;
  if (!requireAdmin(req, res)) return;
  await resetGame();
  res.status(200).json(await getState());
}
