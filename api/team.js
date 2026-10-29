// /api/team – add or remove admin-panel team members (admins only)
//   POST   { email, password }  -> creates the login and gives panel access
//   DELETE { user_id }          -> removes panel access and deletes the login
const { sb } = require('./quote.js');

async function currentAdmin(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await sb().auth.getUser(token);
  if (!data || !data.user) return null;
  const { data: a } = await sb().from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
  return a ? data.user : null;
}

module.exports = async (req, res) => {
  const me = await currentAdmin(req);
  if (!me) return res.status(403).json({ ok: false, error: 'Only admins can manage the team.' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};

  if (req.method === 'POST') {
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ ok: false, error: 'Enter a valid email.' });
    if (password.length < 8) return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters.' });

    let userId;
    const { data: created, error } = await sb().auth.admin.createUser({ email, password, email_confirm: true });
    if (error) {
      // user may already exist -> find them and just grant access
      const { data: list } = await sb().auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = list && list.users.find((u) => (u.email || '').toLowerCase() === email);
      if (!found) return res.status(400).json({ ok: false, error: error.message });
      userId = found.id;
    } else userId = created.user.id;

    const { error: e2 } = await sb().from('admins').upsert({ user_id: userId, email });
    if (e2) return res.status(500).json({ ok: false, error: e2.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const id = String(b.user_id || '');
    if (!id) return res.status(400).json({ ok: false, error: 'Missing user.' });
    if (id === me.id) return res.status(400).json({ ok: false, error: "You can't remove yourself." });
    await sb().from('admins').delete().eq('user_id', id);
    await sb().auth.admin.deleteUser(id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false });
};
