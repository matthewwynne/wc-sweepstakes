import crypto from 'node:crypto';

function safeEqual(a, b){
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function requireAdmin(req, res){
  const key = req.headers['x-admin-key'];
  if (!key || !process.env.ADMIN_PASSPHRASE || !safeEqual(key, process.env.ADMIN_PASSPHRASE)){
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

export function readBody(req){
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

export function methodGuard(req, res, allowed){
  if (!allowed.includes(req.method)){
    res.status(405).json({ error: 'method_not_allowed' });
    return false;
  }
  return true;
}
