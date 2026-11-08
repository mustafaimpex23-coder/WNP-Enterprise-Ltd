// Renders every public page of the website as finished HTML.
// vercel.json sends all page addresses here; the admin panel controls the content.
const { loadAll } = require('./_lib/data.js');
const V = require('./_lib/views.js');

const VERSION = '32';  // bump to refresh cached CSS/JS after a change
const CANONICAL = (process.env.SITE_URL || 'https://luxorapackaging.com').trim().replace(/\/$/, '');

const COUNTRY = ['uk', 'usa', 'canada', 'europe'];
const CATEGORY = ['rigid-boxes', 'perfume-boxes'].concat(V.LANDING);

// Old or alternative addresses for the same buyer search, sent to the one page that covers it
const REDIRECTS = {
  'custom-rigid-boxes': 'rigid-boxes', 'wholesale': 'rigid-boxes', 'wholesale-rigid-boxes': 'rigid-boxes', 'luxury-rigid-boxes': 'rigid-boxes',
  'custom-rigid-boxes-wholesale': 'rigid-boxes', 'luxury-rigid-boxes-wholesale': 'rigid-boxes', 'bespoke-rigid-boxes': 'rigid-boxes',
  'custom-branded-rigid-boxes': 'rigid-boxes', 'custom-logo-rigid-boxes': 'rigid-boxes',
  'custom-perfume-boxes': 'perfume-boxes', 'perfume-boxes-uk': 'perfume-boxes',
  'custom-display-boxes': 'display-box', 'display-boxes': 'display-box',
  'drawer-boxes': 'drawer-box', 'custom-drawer-boxes': 'drawer-box',
  'lid-and-base-rigid-boxes': 'lid-and-base-box', 'hinged-lid-rigid-boxes': 'book-style-box',
  'custom-magnetic-closure-boxes': 'magnetic-closure-boxes', 'magnetic-gift-boxes-uk': 'magnetic-closure-boxes',
  'custom-rigid-gift-boxes': 'rigid-gift-boxes', 'rigid-gift-boxes-wholesale': 'rigid-gift-boxes', 'rigid-gift-boxes-uk': 'rigid-gift-boxes',
  'custom-presentation-boxes': 'presentation-boxes', 'presentation-boxes-uk': 'presentation-boxes',
  'custom-jewelry-boxes': 'jewellery-boxes', 'custom-candle-boxes': 'candle-boxes', 'custom-apparel-boxes': 'apparel-boxes',
  'custom-rigid-boxes-with-inserts': 'rigid-boxes-with-inserts', 'custom-box-inserts': 'rigid-boxes-with-inserts',
  'custom-rigid-boxes-canada': 'canada', 'custom-rigid-boxes-uk': 'uk', 'luxury-rigid-boxes-uk': 'uk', 'rigid-boxes-europe': 'europe',
  'custom-packaging-usa': 'usa', 'rigid-box-quote': 'quote',
  'shoulder-neck-boxes': 'shoulder-neck-rigid-boxes', 'rigid-box-manufacturers': 'rigid-boxes', 'luxury-candle-packaging': 'candle-boxes',
  'lid-and-base-boxes': 'lid-and-base-box', 'book-style-boxes': 'book-style-box',
  'cosmetic-packaging': 'cosmetic-boxes', 'skincare-boxes': 'cosmetic-boxes', 'skincare-packaging': 'cosmetic-boxes', 'makeup-boxes': 'cosmetic-boxes',
  'custom-boxes-with-logo': 'custom-logo-boxes', 'logo-boxes': 'custom-logo-boxes', 'branded-boxes': 'custom-logo-boxes', 'custom-branded-boxes': 'custom-logo-boxes',
  'gift-hamper-boxes': 'hamper-boxes', 'hamper-packaging': 'hamper-boxes', 'luxury-hamper-boxes': 'hamper-boxes',
  'bridesmaid-boxes': 'bridesmaid-proposal-boxes', 'wedding-gift-boxes': 'bridesmaid-proposal-boxes', 'wedding-favour-boxes': 'bridesmaid-proposal-boxes',
  'wig-boxes': 'hair-extension-boxes', 'hair-boxes': 'hair-extension-boxes', 'hair-extension-packaging': 'hair-extension-boxes', 'wig-packaging': 'hair-extension-boxes',
};
const BLOG_REDIRECTS = {
  'how-rigid-boxes-are-made': 'what-is-a-rigid-box', 'magnetic-closure-boxes-benefits': 'magnetic-box-vs-drawer-box',
  'how-much-do-custom-boxes-cost': 'custom-rigid-box-cost-factors', 'custom-rigid-box-pricing-guide': 'custom-rigid-box-cost-factors',
  'custom-box-finishes-guide': 'foil-vs-embossing-vs-spot-uv', 'choosing-packaging-inserts': 'rigid-box-inserts-guide',
};
const RESERVED = ['portfolio', 'our-work', 'quote', 'faq', 'blog', 'reviews', 'review', 'sitemap.xml', 'robots.txt', 'llms.txt'];

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
  // One address per page: /Perfume-Boxes/ and /perfume-boxes/ send a permanent redirect to /perfume-boxes
  const raw = (url.searchParams.get('path') ?? url.pathname ?? '').replace(/^\/+/, '');
  if (raw && !raw.startsWith('api/') && raw !== path && /^[\w\-\/]+$/.test(raw)) {
    const q = new URLSearchParams(url.search); q.delete('path');
    const qs = q.toString();
    res.statusCode = 301; res.setHeader('Location', '/' + path + (qs ? '?' + qs : '')); res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.end();
  }
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
    if (a === 'llms.txt') return send(res, 200, V.llms(ctx), 'text/plain; charset=utf-8');
    if (a === 'index.html') { res.statusCode = 301; res.setHeader('Location', '/'); return res.end(); }
    if (!b && REDIRECTS[a] && !data.pages[a]) { res.statusCode = 301; res.setHeader('Location', '/' + REDIRECTS[a]); return res.end(); }

    if (a === 'quote' && !b) {
      return send(res, 200, V.quotePage(ctx, { product: url.searchParams.get('product') || '', type: url.searchParams.get('type') || '', qty: url.searchParams.get('qty') || '' }));
    }
    if (a === 'portfolio' && !b) return send(res, 200, V.ourWork(ctx));
    if (a === 'our-work' && !b) { res.statusCode = 301; res.setHeader('Location', '/portfolio'); return res.end(); }
    if (a === 'faq' && !b) return send(res, 200, V.faqPage(ctx));
    if (a === 'blog') {
      if (!b) return send(res, 200, V.blogList(ctx));
      const post = data.posts.find((x) => x.slug === b);
      if (post) return send(res, 200, V.post(ctx, post));
      if (BLOG_REDIRECTS[b]) { res.statusCode = 301; res.setHeader('Location', '/blog/' + BLOG_REDIRECTS[b]); return res.end(); }
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
