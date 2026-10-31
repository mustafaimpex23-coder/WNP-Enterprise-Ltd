// Renders every public page of the website as finished HTML.
// vercel.json sends all page addresses here; the admin panel controls the content.
const { loadAll } = require('./_lib/data.js');
const V = require('./_lib/views.js');

const VERSION = '5';  // bump to refresh cached CSS/JS after a change
const CANONICAL = (process.env.SITE_URL || 'https://wnpenterprise.vercel.app').trim().replace(/\/$/, '');

const COUNTRY = ['uk', 'usa', 'canada'];
const CATEGORY = ['rigid-boxes', 'perfume-boxes'];
const RESERVED = ['portfolio', 'our-work', 'quote', 'faq', 'blog', 'reviews', 'review', 'sitemap.xml', 'robots.txt'];

function send(res, status, body, type, cache) {
  res.statusCode = status;
  res.setHeader('Content-Type', type || 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cache || 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
  res.end(body);
}

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let path = (url.searchParams.get('path') || url.pathname || '/').replace(/^\/+|\/+$/g, '').toLowerCase();
  if (path.startsWith('api/render')) path = '';
  const parts = path ? path.split('/') : [];

  // Only the real website address is indexed by Google; preview links are hidden
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  const canonicalHost = new URL(CANONICAL).host.toLowerCase();
  const noindex = !!host && host !== canonicalHost && !host.startsWith('localhost') && !host.startsWith('127.0.0.1');
  if (noindex) res.setHeader('X-Robots-Tag', 'noindex');

  let data;
  try { data = await loadAll(); } catch (e) { console.error(e); return send(res, 500, 'Temporarily unavailable', 'text/plain', 'no-store'); }

  const s = data.settings;
  const ctx = {
    data, settings: s, path: '/' + path, site: CANONICAL, noindex, v: VERSION,
    wa: String(s.whatsapp || '').replace(/[^\d]/g, '').replace(/^00/, '') || '447394499329',
    min: parseInt(s.min_qty, 10) > 0 ? parseInt(s.min_qty, 10) : 50,
  };

  try {
    if (!parts.length) return send(res, 200, V.home(ctx));
    const [a, b] = parts;

    if (a === 'sitemap.xml') return send(res, 200, V.sitemap(ctx), 'application/xml; charset=utf-8');
    if (a === 'robots.txt') return send(res, 200, V.robots(ctx), 'text/plain; charset=utf-8');
    if (a === 'index.html') { res.statusCode = 301; res.setHeader('Location', '/'); return res.end(); }

    if (a === 'quote' && !b) {
      return send(res, 200, V.quotePage(ctx, { product: url.searchParams.get('product') || '', type: url.searchParams.get('type') || '' }));
    }
    if (a === 'portfolio' && !b) return send(res, 200, V.ourWork(ctx));
    if (a === 'our-work' && !b) { res.statusCode = 301; res.setHeader('Location', '/portfolio'); return res.end(); }
    if (a === 'faq' && !b) return send(res, 200, V.faqPage(ctx));
    if (a === 'blog') {
      if (!b) return send(res, 200, V.blogList(ctx));
      const post = data.posts.find((x) => x.slug === b);
      if (post) return send(res, 200, V.post(ctx, post));
    }
    if (a === 'reviews' && !b) return send(res, 200, V.reviewsPage(ctx));
    if (a === 'review' && b) return send(res, 200, V.reviewForm(ctx, b), null, 'no-store');

    if (!b && !RESERVED.includes(a)) {
      const product = data.products.find((p) => p.slug === a);
      if (product) return send(res, 200, V.product(ctx, product));
      const page = data.pages[a];
      if (page) {
        if (CATEGORY.includes(a)) return send(res, 200, V.category(ctx, page));
        if (COUNTRY.includes(a)) return send(res, 200, V.countryPage(ctx, page));
        if (a === 'samples') return send(res, 200, V.samplesPage(ctx, page));
        return send(res, 200, V.genericPage(ctx, page));
      }
      // Simple pages that exist even before the database update is run
      if (a === 'samples' || a === 'privacy') {
        const fallback = a === 'samples'
          ? { slug: 'samples', title: 'Order a Paid Sample', body: 'Want to check the quality, size and finish before a full order? Order a paid sample of any box style. We confirm the sample price and shipping before you pay.' }
          : { slug: 'privacy', title: 'Privacy Policy', body: 'WNP Enterprise Ltd (Company No. 16012866) uses the details you send through this website only to reply to you, prepare your quote and deliver your order. We do not sell your details. To see, correct or delete your details, email us.' };
        return send(res, 200, a === 'samples' ? V.samplesPage(ctx, fallback) : V.genericPage(ctx, fallback));
      }
    }
    return send(res, 404, V.notFound(ctx), null, 'public, max-age=0, s-maxage=60');
  } catch (e) {
    console.error('render error', e);
    return send(res, 500, 'Something went wrong. Please refresh the page.', 'text/plain', 'no-store');
  }
};
