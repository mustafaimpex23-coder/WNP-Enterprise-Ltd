// GET /api/config – public keys the admin panel needs (all safe to expose:
// the anon key can only do what the database security rules allow).
module.exports = (req, res) => {
  const env = (k) => (process.env[k] || '').trim();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    supabaseUrl: env('SUPABASE_URL'),
    supabaseAnonKey: env('SUPABASE_ANON_KEY'),
    vapidPublicKey: env('VAPID_PUBLIC_KEY'),
  });
};
