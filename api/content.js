// GET /api/content – everything the public website shows
// (products + designs, offers, FAQs, settings). Cached on Vercel's CDN for
// 15 seconds, so changes made in the admin panel appear on the site quickly.
const { createClient } = require('@supabase/supabase-js');

const env = (k) => (process.env[k] || '').trim();
let _db;
const db = () =>
  (_db ||= createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { auth: { persistSession: false } }));

module.exports = async (req, res) => {
  try {
    const [p, o, f, s] = await Promise.all([
      db().from('products').select('*, designs(*)').eq('is_active', true)
        .order('sort_order').order('created_at'),
      db().from('offers').select('*').order('sort_order').order('created_at', { ascending: false }),
      db().from('faqs').select('question, answer').eq('is_active', true).order('sort_order'),
      db().from('site_settings').select('key, value'),
    ]);
    const err = p.error || o.error || f.error || s.error;
    if (err) throw err;

    const products = (p.data || []).map((x) => ({
      ...x,
      designs: (x.designs || []).filter((d) => d.is_active).sort((a, b) => a.sort_order - b.sort_order),
    }));
    const settings = {};
    (s.data || []).forEach((r) => { if (r.value != null && r.value !== '') settings[r.key] = r.value; });

    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=300');
    return res.status(200).json({ ok: true, products, offers: o.data || [], faqs: f.data || [], settings });
  } catch (e) {
    console.error('content error', e.message || e);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ ok: false });
  }
};
