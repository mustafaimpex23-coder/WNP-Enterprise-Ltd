// Loads everything the public website shows from Supabase (read-only, public
// key). Each part loads on its own, so if one table is missing the rest of the
// site still works. If Supabase can't be reached at all, built-in backup
// content is used so the site never goes blank.
const { createClient } = require('@supabase/supabase-js');

const env = (k) => (process.env[k] || '').trim();
function cleanSupabaseUrl(raw) {
  let u = String(raw || '').trim().replace(/^['"]|['"]$/g, '').trim();
  const dash = u.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dash) return 'https://' + dash[1] + '.supabase.co';
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { return new URL(u).origin; } catch { return u; }
}
const cleanKey = (k) => String(k || '').trim().replace(/^['"]|['"]$/g, '').trim();

let _db;
function db() {
  if (_db) return _db;
  const url = cleanSupabaseUrl(env('SUPABASE_URL'));
  const key = cleanKey(env('SUPABASE_ANON_KEY'));
  if (!url || !key) return null;
  _db = createClient(url, key, { auth: { persistSession: false } });
  return _db;
}

const DEFAULT_SETTINGS = {
  whatsapp: '+44 7394 499329',
  email: 'wnpenterpriseuk@gmail.com',
  address: 'Unit 5, Industrial Estate, Wednesfield Way, Well Lane, Wolverhampton WV11 1XP, UK',
  us_address: '2335 Broadway, Astoria, NY 11106, United States',
  uk_company: 'WNP Enterprise Ltd',
  us_company: 'The Providers LLC',
  us_email: 'info.theprovidersllc@gmail.com',
  min_qty: '50',
  hero_eyebrow: 'Luxury Rigid Boxes · Made to Your Size',
  hero_title: 'Custom Luxury Rigid Boxes and *Perfume Packaging*',
  hero_subtitle: 'Custom rigid boxes, perfume boxes and display packaging made to your exact size and design. From small launches to large orders, delivered across the UK, USA, Canada and Europe.',
  products_title: 'Choose your box style',
  products_subtitle: 'Pick a style to see its designs, then get a quote or talk to our team on WhatsApp.',
  offers_title: 'Current offers',
  why_title: 'Luxury quality, fair prices',
  why_text: 'WNP Enterprise Ltd is a UK-registered company supplying custom rigid packaging to perfume, beauty, gift and retail brands.',
  contact_title: 'Have a custom idea?',
  contact_text: 'Tell us about your boxes and we will reply within 24 hours.',
  footer_text: 'Custom luxury rigid boxes and perfume packaging from 50 pieces, for brands in the UK, USA, Canada and Europe.',
};

// Backup products (same as the original website), used only if the database is unreachable
const BACKUP_PRODUCTS = require('./backup-products.json');

async function safe(q) {
  try {
    const r = await q;
    if (r.error) return { error: r.error, data: null };
    return { data: r.data || [] };
  } catch (e) { return { error: e, data: null }; }
}

let cache = null, cacheAt = 0;
const TTL = 20 * 1000;

async function loadAll() {
  if (cache && Date.now() - cacheAt < TTL) return cache;
  const c = db();
  let products, pages = [], posts = [], reviews = [], faqs = [], offers = [], settingsRows = [], backup = false;

  if (c) {
    const [p, pg, bp, rv, fq, of, st] = await Promise.all([
      safe(c.from('products').select('*, designs(*)').eq('is_active', true).order('sort_order').order('created_at')),
      safe(c.from('pages').select('*').eq('is_published', true).order('sort_order')),
      safe(c.from('blog_posts').select('*').eq('is_published', true).order('published_at', { ascending: false })),
      safe(c.from('reviews').select('*').eq('is_published', true).order('sort_order').order('created_at', { ascending: false })),
      safe(c.from('faqs').select('*').eq('is_active', true).order('sort_order')),
      safe(c.from('offers').select('*').order('sort_order').order('created_at', { ascending: false })),
      safe(c.from('site_settings').select('key, value')),
    ]);
    if (p.data) products = p.data;
    pages = pg.data || []; posts = bp.data || []; reviews = rv.data || [];
    faqs = fq.data || []; offers = of.data || []; settingsRows = st.data || [];
    if (p.error) console.error('products load failed:', p.error.message || p.error);
  }
  if (!products) { products = BACKUP_PRODUCTS; backup = true; }

  products = products.map((x) => ({
    ...x,
    images: x.images || [],
    image_alts: x.image_alts || [],
    designs: (x.designs || []).filter((d) => d.is_active !== false)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((d) => ({ ...d, images: d.images || [], image_alts: d.image_alts || [], tags: d.tags || [] })),
  }));

  const settings = { ...DEFAULT_SETTINGS };
  settingsRows.forEach((r) => { if (r.value != null && String(r.value).trim() !== '') settings[r.key] = String(r.value); });
  if (backup) faqs = faqs.length ? faqs : require('./backup-faqs.json');

  const pagesBySlug = {};
  pages.forEach((p) => { pagesBySlug[p.slug] = p; });

  cache = { products, pages: pagesBySlug, posts, reviews, faqs, offers, settings, backup };
  cacheAt = Date.now();
  return cache;
}

// Used only by tests to inject content without a database
function _setForTest(data) { cache = data; cacheAt = Date.now() + 1e12; }

module.exports = { loadAll, DEFAULT_SETTINGS, cleanSupabaseUrl, cleanKey, _setForTest };
