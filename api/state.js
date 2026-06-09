import { getState } from '../lib/db.js';
import { methodGuard } from './_auth.js';

export default async function handler(req, res){
  if (!methodGuard(req, res, ['GET'])) return;
  try {
    res.status(200).json(await getState());
  } catch (e){
    res.status(500).json({ error: 'state_failed', detail: String(e) });
  }
}
