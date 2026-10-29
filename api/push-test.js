// POST /api/push-test – the admin panel's "Send test notification" button.
// Needs the logged-in admin's token; sends a test push to that admin's devices.
const { pushAll, sb } = require('./quote.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ ok: false, error: 'Not logged in' });

  const { data, error } = await sb().auth.getUser(token);
  if (error || !data || !data.user) return res.status(401).json({ ok: false, error: 'Not logged in' });

  const { data: admin } = await sb().from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
  if (!admin) return res.status(403).json({ ok: false, error: 'Not an admin' });

  const sent = await pushAll(
    { title: 'Notifications are working ✅', body: 'You will get an alert like this for every new website query.', url: '/admin/', tag: 'test' },
    data.user.id
  );
  return res.status(200).json({ ok: true, sent });
};
