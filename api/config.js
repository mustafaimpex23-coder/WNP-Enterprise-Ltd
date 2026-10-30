// GET /api/config – public keys the admin panel needs (all safe to expose:
// the anon / publishable key can only do what the database security rules allow).

// Accepts any form of the Supabase address (with /rest/v1, a trailing slash,
// spaces, quotes or even the dashboard link) and turns it into https://<id>.supabase.co
function cleanSupabaseUrl(raw) {
  let u = String(raw || '').trim().replace(/^['"]|['"]$/g, '').trim();
  const dash = u.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dash) return 'https://' + dash[1] + '.supabase.co';
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { return new URL(u).origin; } catch { return u; }
}
const cleanKey = (k) => String(k || '').trim().replace(/^['"]|['"]$/g, '').trim();

module.exports = (req, res) => {
  const env = (k) => (process.env[k] || '').trim();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    supabaseUrl: cleanSupabaseUrl(env('SUPABASE_URL')),
    supabaseAnonKey: cleanKey(env('SUPABASE_ANON_KEY')),
    vapidPublicKey: cleanKey(env('VAPID_PUBLIC_KEY')),
  });
};
