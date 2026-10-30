// HTML templates for every public page of the WNP Enterprise website.
// Pages are sent as finished HTML so Google and AI tools can read them.
const { md, plain, esc } = require('./md.js');
const PHOTOS = require('./photos.json');

const BRAND = 'WNP Enterprise';
const LEGAL = 'WNP Enterprise Ltd';
const COMPANY_NO = '16012866';

/* ---------------------------------------------------------------- helpers */
const rich = (t) => esc(t).replace(/\*([^*]+)\*/g, '<em>$1</em>');
const strip = (t) => String(t || '').replace(/\*/g, '');
const digits = (s) => String(s || '').replace(/[^\d]/g, '').replace(/^00/, '');
const year = () => new Date().getFullYear();
function clip(s, n) { s = String(s || '').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; }

function waLink(ctx, text) {
  return 'https://wa.me/' + ctx.wa + (text ? '?text=' + encodeURIComponent(text) : '');
}
const WA_ICON = '<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3zm6 15.5c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2-.2.3-.9 1.1-1.1 1.3-.2.2-.4.3-.7.1-.3-.2-1.4-.5-2.7-1.6-1-.9-1.7-2-1.9-2.3-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.3-.6.1-.2 0-.5 0-.6l-1-2.5c-.3-.7-.5-.6-.8-.6h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.6 5.8 5 .8.3 1.4.5 1.9.7.8.3 1.5.2 2.1.1.6-.1 2-.8 2.2-1.6.3-.8.3-1.4.2-1.6-.1-.1-.3-.2-.6-.4z"/></svg>';
const PH = '<div class="ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>Photo coming soon</div>';

// A photo saved in the website folder (e.g. /drawer-box-1.jpg) has fast,
// resized copies in /img/. Photos uploaded in the admin panel are used as they are.
function localName(url) {
  const m = String(url || '').match(/^(?:https?:\/\/[^/]+)?\/(?:images\/|Images\/|img\/)?([A-Za-z0-9_-]+)\.(?:jpe?g|png|webp)$/i);
  return m && PHOTOS[m[1]] ? m[1] : null;
}
function photoSrc(url) { const n = localName(url); return n ? `/img/${n}-1200.jpg` : url; }
function absUrl(ctx, url) { if (!url) return ''; const u = photoSrc(url); return /^https?:/i.test(u) ? u : ctx.site + u; }

function photo(url, alt, o = {}) {
  if (!url) return '';
  const n = localName(url);
  const load = o.eager ? 'fetchpriority="high"' : 'loading="lazy"';
  const sizes = o.sizes || '(max-width:760px) 100vw, 33vw';
  if (n) {
    const p = PHOTOS[n];
    return `<picture><source type="image/webp" srcset="/img/${n}-600.webp 600w, /img/${n}-1200.webp 1200w" sizes="${sizes}">` +
      `<img src="/img/${n}-1200.jpg" alt="${esc(alt)}" width="${p.w}" height="${p.h}" ${load} decoding="async"></picture>`;
  }
  return `<img src="${esc(url)}" alt="${esc(alt)}" ${load} decoding="async">`;
}

// Photos for a product card / a design, falling back to the photo files in the website folder
function fileIf(name) { return PHOTOS[name] ? '/' + name + '.jpg' : null; }
function designPhotos(p, d, i) {
  if (d.images && d.images.length) return d.images.map((u, k) => ({ url: u, alt: (d.image_alts || [])[k] || `${p.name} – ${d.name}` }));
  const f = fileIf(`${p.slug}-${i + 1}`);
  return f ? [{ url: f, alt: `${p.name} – ${d.name}` }] : [];
}
function productPhotos(p) {
  const list = (p.images || []).map((u, k) => ({ url: u, alt: (p.image_alts || [])[k] || p.name }));
  if (!list.length) { const f = fileIf(p.slug); if (f) list.push({ url: f, alt: p.name }); }
  p.designs.forEach((d, i) => designPhotos(p, d, i).forEach((x) => list.push(x)));
  return list;
}
const coverOf = (p) => productPhotos(p)[0] || null;

/* ------------------------------------------------------------ schema code */
function postal(str, country) {
  const s = String(str || '').trim();
  const us = s.match(/^(.+?),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)(?:,\s*(.+))?$/);
  if (us) return { '@type': 'PostalAddress', streetAddress: us[1], addressLocality: us[2], addressRegion: us[3], postalCode: us[4], addressCountry: 'US' };
  const uk = s.match(/^(.*),\s*([A-Za-z .'-]+)\s+([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})(?:,\s*(.+))?$/i);
  if (uk) return { '@type': 'PostalAddress', streetAddress: uk[1], addressLocality: uk[2].trim(), postalCode: uk[3].toUpperCase(), addressCountry: 'GB' };
  return { '@type': 'PostalAddress', streetAddress: s, addressCountry: country };
}
function orgSchema(ctx) {
  const s = ctx.settings;
  const addr = [postal(s.address, 'GB')];
  if (s.us_address) addr.push(postal(s.us_address, 'US'));
  return {
    '@context': 'https://schema.org', '@type': 'Organization', '@id': ctx.site + '/#org',
    name: LEGAL, alternateName: BRAND, url: ctx.site + '/',
    description: 'Custom luxury rigid boxes and perfume packaging from 50 pieces, for brands in the UK, USA, Canada and Europe.',
    email: s.email, telephone: '+' + digits(s.phone || s.whatsapp), address: addr,
    areaServed: ['GB', 'US', 'CA', 'EU'],
  };
}
function crumbSchema(ctx, items) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it[0], item: ctx.site + it[1] })),
  };
}
function crumbs(items) {
  return '<nav class="crumbs" aria-label="Breadcrumb">' + items.map((it, i) =>
    i === items.length - 1 ? `<span aria-current="page">${esc(it[0])}</span>` : `<a href="${it[1]}">${esc(it[0])}</a><span aria-hidden="true">›</span>`).join('') + '</nav>';
}

/* --------------------------------------------------------------- layout */
function pageTitle(t) {
  if (String(t).includes(BRAND)) return t;
  const full = `${t} | ${BRAND}`;
  return full.length <= 60 ? full : t;
}

function navHtml(ctx) {
  const d = ctx.data, p = ctx.path;
  const on = (x) => (p === x || p.startsWith(x + '/') ? ' class="on" aria-current="page"' : '');
  const styles = d.products.map((x) => `<a href="/${esc(x.slug)}">${esc(x.name)}</a>`).join('');
  return `<ul id="menu">
    <li class="dd"><button type="button" aria-expanded="false">Box Styles</button>
      <div class="dd-menu">${d.pages['rigid-boxes'] ? '<a href="/rigid-boxes">All rigid boxes</a>' : ''}${d.pages['perfume-boxes'] ? '<a href="/perfume-boxes">Perfume boxes</a>' : ''}<hr>${styles}</div></li>
    ${d.pages.samples ? `<li><a href="/samples"${on('/samples')}>Samples</a></li>` : ''}
    ${d.pages.about ? `<li><a href="/about"${on('/about')}>About</a></li>` : ''}
    ${d.posts.length ? `<li><a href="/blog"${on('/blog')}>Blog</a></li>` : ''}
    ${d.reviews.length ? `<li><a href="/reviews"${on('/reviews')}>Reviews</a></li>` : ''}
    <li><a href="/faq"${on('/faq')}>FAQ</a></li>
    <li><a href="/#contact">Contact</a></li>
    <li><a href="/quote" class="btn btn-dark">Get a Quote</a></li>
  </ul>`;
}

function footerHtml(ctx) {
  const s = ctx.settings, d = ctx.data;
  const pg = (slug, label) => (d.pages[slug] ? `<li><a href="/${slug}">${esc(label)}</a></li>` : '');
  const phone = s.phone || s.whatsapp;
  return `<footer><div class="wrap"><div class="foot">
    <div><a href="/" class="logo"><b>WNP</b><span>Enterprise Ltd</span></a>
      <p style="margin-top:16px;max-width:320px">${esc(s.footer_text)}</p></div>
    <div><h4>Box Styles</h4><ul>${d.products.map((x) => `<li><a href="/${esc(x.slug)}">${esc(x.name)}</a></li>`).join('')}</ul></div>
    <div><h4>Company</h4><ul>${pg('about', 'About us')}${pg('samples', 'Paid samples')}${pg('shipping', 'Shipping & delivery')}
      <li><a href="/faq">FAQ</a></li>${d.posts.length ? '<li><a href="/blog">Blog</a></li>' : ''}${d.reviews.length ? '<li><a href="/reviews">Reviews</a></li>' : ''}
      ${pg('uk', 'UK')}${pg('usa', 'USA')}${pg('canada', 'Canada')}<li><a href="/quote">Get a quote</a></li></ul></div>
    <div><h4>Contact</h4>
      <ul><li><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></li>
        <li><a href="${waLink(ctx, 'Hi WNP Enterprise, I would like to know more about your custom rigid boxes.')}" target="_blank" rel="noopener">WhatsApp ${esc(s.whatsapp)}</a></li>
        ${s.phone ? `<li><a href="tel:+${digits(phone)}">Call ${esc(phone)}</a></li>` : ''}
        ${s.booking_url ? `<li><a href="${esc(s.booking_url)}" target="_blank" rel="noopener">Book a call</a></li>` : ''}</ul>
      <address style="margin-top:14px"><b>United Kingdom</b>${esc(s.address)}</address>
      ${s.us_address ? `<address><b>United States</b>${esc(s.us_address)}</address>` : ''}
    </div></div>
    <div class="legal"><span>© ${year()} ${LEGAL}. All rights reserved. · <a href="/privacy">Privacy Policy</a>${d.pages.terms ? ' · <a href="/terms">Terms</a>' : ''}${d.pages.returns ? ' · <a href="/returns">Returns</a>' : ''}</span>
      <span>Registered in England &amp; Wales · Company No. ${COMPANY_NO}</span></div>
  </div></footer>`;
}

function layout(ctx, o) {
  const s = ctx.settings;
  const title = o.rawTitle || pageTitle(o.title);
  const desc = clip(o.description || s.hero_subtitle, 158);
  const canonical = ctx.site + (o.path || ctx.path);
  const schemas = [orgSchema(ctx)].concat(o.schema || []);
  const ogImg = o.image ? absUrl(ctx, o.image) : ctx.site + '/img/magnetic-flip-top-perfume-box-1200.jpg';
  return `<!DOCTYPE html>
<html lang="${o.lang || 'en-GB'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
${o.noindex || ctx.noindex ? '<meta name="robots" content="noindex, nofollow">' : ''}
${s.gsc_verification ? `<meta name="google-site-verification" content="${esc(s.gsc_verification.replace(/.*content="([^"]+)".*/, '$1'))}">` : ''}
<meta name="theme-color" content="#141414">
<meta property="og:type" content="${o.ogType || 'website'}">
<meta property="og:site_name" content="${LEGAL}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImg)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23141414'/%3E%3Crect x='4' y='4' width='56' height='56' rx='11' fill='none' stroke='%23b8935a' stroke-width='2'/%3E%3Ctext x='32' y='45' text-anchor='middle' font-family='Georgia,Times New Roman,serif' font-size='36' font-weight='700' fill='%23b8935a'%3EW%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600&display=swap"></noscript>
<link rel="stylesheet" href="/assets/site.css?v=${ctx.v}">
${schemas.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body data-wa="${ctx.wa}" data-min="${ctx.min}"${s.ga_id ? ` data-ga="${esc(s.ga_id)}"` : ''}>
<a class="skip" href="#main">Skip to content</a>
${s.announcement ? `<div class="announce">${esc(s.announcement)}</div>` : ''}
<header><div class="wrap">
  <a href="/" class="logo" aria-label="WNP Enterprise home"><b>WNP</b><span>Enterprise Ltd</span></a>
  <nav aria-label="Main"><button class="menu-btn" aria-label="Open menu" aria-controls="menu" aria-expanded="false"><span></span><span></span><span></span></button>
  ${navHtml(ctx)}</nav>
</div></header>
<main id="main">
${o.body}
</main>
${footerHtml(ctx)}
<a class="wa-float" href="${waLink(ctx, 'Hi WNP Enterprise, I would like to know more about your custom rigid boxes.')}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">${WA_ICON.replace('fill="currentColor"', 'fill="#fff"')}</a>
${s.ga_id ? `<div class="cookie" id="cookie" role="dialog" aria-label="Cookies"><span>We use Google Analytics cookies to see which pages are useful. <a href="/privacy">Privacy policy</a></span><div class="btns"><button class="btn btn-ghost" data-cookie="no">No thanks</button><button class="btn btn-gold" data-cookie="yes">Accept</button></div></div>` : ''}
<script src="/assets/site.js?v=${ctx.v}" defer></script>
</body>
</html>`;
}

/* --------------------------------------------------------- shared blocks */
function productCard(ctx, p) {
  const c = coverOf(p);
  const n = p.designs.length;
  return `<a class="card" href="/${esc(p.slug)}">
    <div class="ph-box${c ? '' : ''}">${n ? `<span class="count">${n} design${n === 1 ? '' : 's'}</span>` : ''}${p.badge ? `<span class="badge-tag">${esc(p.badge)}</span>` : ''}${c ? photo(c.url, c.alt) : PH}</div>
    <div class="card-body"><h3>${esc(p.name)}</h3><p>${esc(p.short_desc || '')}</p><span class="btn btn-dark">View designs →</span></div></a>`;
}
const productGrid = (ctx, list) => `<div class="grid">${list.map((p) => productCard(ctx, p)).join('')}</div>`;

function stars(n) { n = Math.max(0, Math.min(5, Math.round(n))); return `<span class="stars" aria-label="${n} out of 5 stars">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`; }
function reviewCard(ctx, r) {
  const prod = ctx.data.products.find((p) => p.slug === r.product_slug);
  return `<figure class="review">${stars(r.rating)}<blockquote><p>${esc(r.text)}</p></blockquote>
    ${r.photo ? photo(r.photo, `Box made for ${r.brand || r.name}`) : ''}
    <figcaption class="who"><b>${esc(r.name)}</b>${esc([r.brand, r.country].filter(Boolean).join(' · '))}${prod ? ` · <a href="/${esc(prod.slug)}" style="text-decoration:underline">${esc(prod.name)}</a>` : ''}</figcaption></figure>`;
}
// A post without its own cover photo borrows the photo of a related box style
function postCover(ctx, b) {
  if (b.cover_image) return { url: b.cover_image, alt: b.cover_alt || b.title };
  const rel = ctx.data.products.filter((p) => (b.product_slugs || []).includes(p.slug));
  const c = coverOf(rel[0] || ctx.data.products[(b.slug || '').length % Math.max(1, ctx.data.products.length)] || { images: [], designs: [], slug: '' });
  return c ? { url: c.url, alt: b.title } : null;
}
function postCard(ctx, b) {
  const c = postCover(ctx, b);
  return `<a class="post-card" href="/blog/${esc(b.slug)}"><div class="ph-box">${c ? photo(c.url, c.alt) : PH}</div>
    <div class="body"><span class="meta">${esc(b.category || 'Guide')}${b.published_at ? ' · ' + fmtDate(b.published_at) : ''}</span><h3>${esc(b.title)}</h3><p>${esc(b.excerpt || plain(b.body, 150))}</p></div></a>`;
}
function fmtDate(d) { try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } }

function ctaBand(ctx, title, text) {
  return `<section class="cta-band"><div class="wrap"><h2>${esc(title || 'Ready to start your boxes?')}</h2>
    <p>${esc(text || `Send your size, finishes and quantity. We reply within 24 hours. Minimum ${ctx.min} pieces per design.`)}</p>
    <div class="acts"><a class="btn btn-gold" href="/quote">Get a Quote</a><a class="btn btn-wa" href="${waLink(ctx, 'Hi WNP Enterprise, I would like a quote for custom boxes.')}" target="_blank" rel="noopener">${WA_ICON} Chat on WhatsApp</a></div></div></section>`;
}

function pageHero(ctx, title, sub, items, eyebrow) {
  return `<section class="page-hero"><div class="wrap">${items ? crumbs(items) : ''}${eyebrow ? `<span class="eyebrow" style="color:var(--gold)">${esc(eyebrow)}</span>` : ''}<h1>${rich(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div></section>`;
}

/* --------------------------------------------------------- quote form */
function productOptions(ctx, selected) {
  let out = '';
  let found = false;
  ctx.data.products.forEach((p) => {
    const opts = [p.name].concat(p.designs.map((d) => `${p.name} – ${d.name}`));
    out += `<optgroup label="${esc(p.name)}">` + opts.map((o) => {
      const sel = selected && o.toLowerCase() === selected.toLowerCase();
      if (sel) found = true;
      return `<option${sel ? ' selected' : ''}>${esc(o)}</option>`;
    }).join('') + '</optgroup>';
  });
  if (selected && !found) out = `<option selected>${esc(selected)}</option>` + out;
  return `<option value="">Choose a box style…</option>` + out + `<option>Not sure / Other</option>`;
}

function quoteForm(ctx, o = {}) {
  const type = o.type || 'order';
  const isEnq = type === 'enquiry';
  const unit = o.unit || 'cm';
  const qtyLabel = type === 'sample' ? 'Number of samples *' : 'Quantity *';
  return `<div class="form-box">
  <form class="f light js-quote" data-type="${type}" novalidate>
    <div class="hp" aria-hidden="true"><label for="f_website">Website</label><input id="f_website" name="website" tabindex="-1" autocomplete="off"></div>
    ${o.toggle ? `<div class="seg" role="radiogroup" aria-label="Request type">
      <label><input type="radio" name="request_type" value="order"${type !== 'sample' ? ' checked' : ''}><span>Bulk order quote</span></label>
      <label><input type="radio" name="request_type" value="sample"${type === 'sample' ? ' checked' : ''}><span>Paid sample</span></label></div>`
      : `<input type="hidden" name="request_type" value="${type}">`}
    <div class="field"><label for="f_product">Box style</label><select id="f_product" name="product">${productOptions(ctx, o.product)}</select></div>
    <div class="row">
      <div class="field"><label for="f_name">Full name *</label><input id="f_name" name="name" autocomplete="name" required></div>
      <div class="field"><label for="f_email">Email *</label><input id="f_email" name="email" type="email" autocomplete="email" required></div>
    </div>
    <div class="row">
      <div class="field"><label for="f_phone">Contact number (optional)</label><input id="f_phone" name="phone" type="tel" autocomplete="tel" placeholder="+44 … / +1 …"></div>
      <div class="field"><label for="f_company">Company / Brand</label><input id="f_company" name="company" autocomplete="organization"></div>
    </div>
    <div class="row">
      <div class="field"><label for="f_country">Country${isEnq ? '' : ' *'}</label><input id="f_country" name="country" autocomplete="country-name" ${isEnq ? '' : 'required '}placeholder="e.g. United Kingdom" value="${esc(o.country || '')}"></div>
      <div class="field"><label for="f_qty" class="js-qty-label">${qtyLabel}</label><input id="f_qty" name="quantity" type="number" step="1" inputmode="numeric" required>
        <div class="hint js-qty-hint"></div><div class="err js-qty-err"></div></div>
    </div>
    <div class="field"><label>Box size (length × width × height)</label>
      <div class="size-row">
        <input name="size_l" type="number" step="0.1" min="0" inputmode="decimal" placeholder="Length" aria-label="Length">
        <input name="size_w" type="number" step="0.1" min="0" inputmode="decimal" placeholder="Width" aria-label="Width">
        <input name="size_h" type="number" step="0.1" min="0" inputmode="decimal" placeholder="Height" aria-label="Height">
        <select name="size_unit" aria-label="Unit"><option value="cm"${unit === 'cm' ? ' selected' : ''}>cm</option><option value="in"${unit === 'in' ? ' selected' : ''}>inches</option></select>
      </div><div class="hint">Or your bottle size. Leave empty if you are not sure yet.</div></div>
    <div class="field"><label for="f_msg">${o.us ? 'Colors' : 'Colours'}, finishes &amp; other details</label><textarea id="f_msg" name="details" placeholder="${o.us ? 'Color' : 'Colour'}, logo finish (foil / emboss), insert type, deadline…"></textarea></div>
    <div class="form-actions">
      <button type="submit" class="btn btn-gold">${type === 'sample' ? 'Request sample price' : isEnq ? 'Send enquiry' : 'Send quote request'}</button>
      <a class="btn btn-wa" href="${waLink(ctx, 'Hi WNP Enterprise, I would like a quote for custom boxes.')}" target="_blank" rel="noopener">${WA_ICON} Or chat with us on WhatsApp</a>
    </div>
    <p class="form-note js-note">Minimum order ${ctx.min} pieces · We reply within 24 hours</p>
    <p class="consent">By sending this form you agree to our <a href="/privacy">Privacy Policy</a>.</p>
  </form>
  <div class="form-done" role="status"><div class="success-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
    <h3>Thank you!</h3><p>Your request has been sent. Our team will contact you within 24 hours.</p></div>
  </div>`;
}

/* ================================================================ PAGES */

function home(ctx) {
  const s = ctx.settings, d = ctx.data;
  const now = Date.now();
  const offers = (d.offers || []).filter((o) => o.is_active !== false && (!o.starts_at || new Date(o.starts_at) <= now) && (!o.ends_at || new Date(o.ends_at) >= now));
  const offerHtml = offers.length ? `<section class="offers" id="offers"><div class="wrap"><div class="section-head"><span class="eyebrow">Offers</span><h2>${rich(s.offers_title)}</h2></div>
    <div class="offer-grid">${offers.map((o) => {
      const link = o.cta_link || '/quote';
      const href = link === 'whatsapp' ? waLink(ctx, `Hi WNP Enterprise, I am interested in your offer: "${o.title}".`)
        : link === 'quote' ? '/quote?product=' + encodeURIComponent('Offer: ' + o.title)
        : link === '#samples' ? '/samples' : link === '#products' ? '/#products' : link === '#contact' ? '/#contact' : link;
      return `<article class="offer">${o.image ? `<div class="ph-box">${photo(o.image, o.title)}</div>` : ''}<div class="offer-body"><span class="eyebrow">Offer</span><h3>${esc(o.title)}</h3><p>${esc(o.text || '')}</p>
        <a class="btn ${link === 'whatsapp' ? 'btn-wa' : 'btn-dark'}" href="${esc(href)}"${link === 'whatsapp' ? ' target="_blank" rel="noopener"' : ''}>${esc(o.cta_label || 'Get a Quote')}</a></div></article>`;
    }).join('')}</div></div></section>` : '';

  const reviews = d.reviews.slice(0, 3);
  const posts = d.posts.slice(0, 3);
  const faqs = d.faqs.slice(0, 5);

  const body = `
<section class="hero" id="home"><div class="wrap">
  <span class="eyebrow" style="color:var(--gold)">${esc(s.hero_eyebrow)}</span>
  <h1>${rich(s.hero_title)}</h1>
  <p>${esc(s.hero_subtitle)}</p>
  <div class="hero-actions"><a href="/quote" class="btn btn-gold">Get a Quote</a>
    <a class="btn btn-outline" href="${waLink(ctx, 'Hi WNP Enterprise, I would like to know more about your custom rigid boxes.')}" target="_blank" rel="noopener">Talk to a Representative</a></div>
</div></section>
<div class="trust"><div class="wrap">
  <div><b>UK Registered</b>Company No. ${COMPANY_NO}</div>
  <div><b>Low Minimum</b>From ${ctx.min} pieces</div>
  <div><b>100% Custom</b>Any size, any colour</div>
  <div><b>Premium Finishes</b>Foil, emboss, soft-touch</div>
  <div><b>UK &amp; US offices</b>Delivered to UK, USA, Canada &amp; Europe</div>
</div></div>
${offerHtml}
<section id="products"><div class="wrap">
  <div class="section-head"><span class="eyebrow">Our Box Styles</span><h2>${rich(s.products_title)}</h2><p>${esc(s.products_subtitle)}</p></div>
  ${productGrid(ctx, d.products)}
</div></section>
<section id="how" style="background:var(--paper-2)"><div class="wrap">
  <div class="section-head"><span class="eyebrow">How It Works</span><h2>From idea to your door</h2><p>A simple process, with one point of contact from start to finish.</p></div>
  <div class="steps">
    <div class="step"><h3>Get a quote</h3><p>Send your box size, finishes and quantity. We reply with an exact price within 24 hours.</p></div>
    <div class="step"><h3>Approve your design</h3><p>We confirm the design with you. Order a paid sample first if you want to check it in hand.</p></div>
    <div class="step"><h3>Production</h3><p>Your boxes are made to your size, colours and logo finish.</p></div>
    <div class="step"><h3>Delivered</h3><p>Export-packed and delivered to your door in the UK, USA, Canada or Europe.</p></div>
  </div></div></section>
<section class="sample" id="samples"><div class="wrap">
  <div><span class="eyebrow" style="color:var(--gold)">Paid Samples</span><h2>See it in your hands before bulk</h2>
    <p>Want to check the quality, size and finish before placing a full order? Order a paid sample of any box style.</p>
    <div class="sample-actions"><a class="btn btn-gold" href="/samples">Order a Paid Sample</a>
      <a class="btn btn-wa" href="${waLink(ctx, 'Hi WNP Enterprise, I would like to order a paid sample. Please share the sample price and details.')}" target="_blank" rel="noopener">Ask on WhatsApp</a></div></div>
  <ul class="sample-points">
    <li><span><b>Sample price depends on size, style and finishes.</b> We confirm the exact cost before you pay.</span></li>
    <li><span>A single custom sample costs more per piece than bulk, because it is made individually.</span></li>
    <li><span><b>Minimum bulk order is ${ctx.min} pieces.</b> The higher your quantity, the lower the price per box.</span></li>
    <li><span>Sample shipping is charged separately, based on your country.</span></li>
  </ul></div></section>
<section id="why"><div class="wrap">
  <div class="section-head"><span class="eyebrow">Why WNP Enterprise</span><h2>${rich(s.why_title)}</h2><p>${esc(s.why_text)}</p></div>
  <div class="why-grid">
    <div class="why-item"><div class="ico">◈</div><h3>One point of contact</h3><p>One team from your first message to delivery.</p></div>
    <div class="why-item"><div class="ico">✎</div><h3>Made to your size</h3><p>Every box is built around your bottle or product.</p></div>
    <div class="why-item"><div class="ico">✦</div><h3>Premium finishes</h3><p>Foil, embossing, spot UV, soft-touch, velvet and foam inserts.</p></div>
    <div class="why-item"><div class="ico">✈</div><h3>Delivered to you</h3><p>Safe export packing to the UK, USA, Canada and Europe.</p></div>
  </div></div></section>
${reviews.length ? `<section style="background:var(--paper-2)"><div class="wrap"><div class="section-head"><span class="eyebrow">Reviews</span><h2>What our customers say</h2></div>
  <div class="reviews">${reviews.map((r) => reviewCard(ctx, r)).join('')}</div><p class="more-link"><a class="btn btn-dark" href="/reviews">All reviews</a></p></div></section>` : ''}
${posts.length ? `<section><div class="wrap"><div class="section-head"><span class="eyebrow">Guides</span><h2>From the blog</h2></div>
  <div class="posts">${posts.map((b) => postCard(ctx, b)).join('')}</div><p class="more-link"><a class="btn btn-dark" href="/blog">All articles</a></p></div></section>` : ''}
${faqs.length ? `<section id="faq" style="background:var(--paper-2)"><div class="wrap"><div class="section-head"><span class="eyebrow">FAQ</span><h2>Quick answers</h2></div>
  <div class="faq">${faqs.map((f) => `<details><summary>${esc(f.question)}</summary><p>${esc(f.answer || '')}</p></details>`).join('')}</div>
  <p class="more-link"><a class="btn btn-dark" href="/faq">All questions</a></p></div></section>` : ''}
<section class="contact" id="contact"><div class="wrap">
  <div class="intro"><span class="eyebrow" style="color:var(--gold)">Contact Us</span><h2>${rich(s.contact_title)}</h2><p>${esc(s.contact_text)}</p>
    <ul class="contact-list">
      <li><span class="i">✉</span><div><b>Email</b><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></div></li>
      <li><span class="i">☎</span><div><b>WhatsApp</b><a href="${waLink(ctx, 'Hi WNP Enterprise, I would like to know more about your custom rigid boxes.')}" target="_blank" rel="noopener">${esc(s.whatsapp)}</a></div></li>
      ${s.phone ? `<li><span class="i">✆</span><div><b>Phone</b><a href="tel:+${digits(s.phone)}">${esc(s.phone)}</a></div></li>` : ''}
      ${s.booking_url ? `<li><span class="i">◷</span><div><b>Book a call</b><a href="${esc(s.booking_url)}" target="_blank" rel="noopener">Pick a time that suits you</a></div></li>` : ''}
      <li><span class="i">⌂</span><div><b>UK office</b>${esc(s.address)}</div></li>
      ${s.us_address ? `<li><span class="i">⌂</span><div><b>US office</b>${esc(s.us_address)}</div></li>` : ''}
    </ul></div>
  ${quoteForm(ctx, { type: 'enquiry' })}
</div></section>`;

  return layout(ctx, {
    rawTitle: 'Custom Luxury Rigid Boxes & Perfume Boxes | WNP Enterprise',
    description: `Custom luxury rigid boxes and perfume boxes made to your size, from just ${ctx.min} pieces. Delivered to the UK, USA, Canada and Europe.`,
    path: '/', body,
    schema: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: LEGAL, url: ctx.site + '/' }],
  });
}

/* ---- sizes: "Small: 8 x 8 x 14" (cm) -> table in cm and inches */
function sizesTable(text) {
  const rows = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(?:(.*?):\s*)?([\d.]+)\s*[x×*]\s*([\d.]+)\s*[x×*]\s*([\d.]+)\s*(cm|mm|in|inch|inches|")?/i);
    if (!m) return null;
    let [a, b, c] = [m[2], m[3], m[4]].map(Number);
    const u = (m[5] || 'cm').toLowerCase();
    if (u === 'mm') { a /= 10; b /= 10; c /= 10; }
    if (u.startsWith('in') || u === '"') { a *= 2.54; b *= 2.54; c *= 2.54; }
    const cm = [a, b, c].map((x) => +x.toFixed(1)).join(' × ');
    const inch = [a, b, c].map((x) => +(x / 2.54).toFixed(1)).join(' × ');
    return { label: m[1] || '', cm, inch };
  }).filter(Boolean);
  if (!rows.length) return '';
  return `<table class="sizes"><thead><tr><th>Size</th><th>Centimetres</th><th>Inches</th></tr></thead><tbody>${rows.map((r, i) =>
    `<tr><td>${esc(r.label || 'Size ' + (i + 1))}</td><td>${r.cm} cm</td><td>${r.inch} in</td></tr>`).join('')}</tbody></table>`;
}

function product(ctx, p) {
  const d = ctx.data;
  const min = p.min_order || ctx.min;
  const photos = productPhotos(p);
  const main = photos[0];
  const specs = String(p.specs || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const facts = specs.length ? specs : [
    'Made to your exact size',
    `Minimum order: ${min} pieces per design`,
    'Finishes: gold or silver foil, embossing, debossing, spot UV, soft-touch',
    'Inserts: foam, card or velvet, cut to your product',
    'Delivered to the UK, USA, Canada and Europe',
  ];
  const reviews = d.reviews.filter((r) => r.product_slug === p.slug);
  const posts = d.posts.filter((b) => (b.product_slugs || []).includes(p.slug));
  const others = d.products.filter((x) => x.slug !== p.slug).slice(0, 3);
  const items = [['Home', '/'], ['Box styles', d.pages['rigid-boxes'] ? '/rigid-boxes' : '/#products'], [p.name, '/' + p.slug]];

  const designsHtml = p.designs.map((dz, i) => {
    const ph = designPhotos(p, dz, i);
    const full = `${p.name} – ${dz.name}`;
    return `<article class="design" id="design-${i + 1}">
      <div class="ph-box"${ph.length > 1 ? ' data-gal' : ''}><span class="num">Design ${i + 1}</span>${ph[0] ? photo(ph[0].url, ph[0].alt) : PH}</div>
      ${ph.length > 1 ? `<div class="mini" style="padding-top:10px">${ph.map((x, k) => `<button type="button" class="${k ? '' : 'on'}" data-src="${esc(photoSrc(x.url))}" data-alt="${esc(x.alt)}" aria-label="Photo ${k + 1}">${photo(x.url, '', { sizes: '44px' })}</button>`).join('')}</div>` : ''}
      <div class="design-body"><h3>${esc(dz.name)}</h3><p>${esc(dz.description || '')}</p>
        ${dz.tags.length ? `<div class="tags">${dz.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="design-actions"><a class="btn btn-dark btn-sm" href="/quote?product=${encodeURIComponent(full)}">Get a quote for this design</a>
          <a class="btn btn-wa btn-sm" href="${waLink(ctx, `Hi WNP Enterprise, I am interested in the "${full}". Please share price and details. (Minimum ${min} pieces)`)}" target="_blank" rel="noopener">${WA_ICON} Talk to a representative</a></div></div></article>`;
  }).join('');

  const body = `
${pageHero(ctx, p.name, p.short_desc, items, p.badge || 'Custom rigid box')}
<section style="padding-top:56px"><div class="wrap pp">
  <div class="pp-gallery">
    <div class="main">${main ? photo(main.url, main.alt, { eager: true, sizes: '(max-width:980px) 100vw, 50vw' }) : `<div class="ph-box" style="height:100%">${PH}</div>`}</div>
    ${photos.length > 1 ? `<div class="thumbs">${photos.slice(0, 10).map((x, k) => `<button type="button" class="${k ? '' : 'on'}" data-src="${esc(photoSrc(x.url))}" data-alt="${esc(x.alt)}" aria-label="Show photo ${k + 1}">${photo(x.url, '', { sizes: '72px' })}</button>`).join('')}</div>` : ''}
  </div>
  <div class="pp-info">
    <h2>Made to your size, colour and logo</h2>
    <p class="lead">${esc(p.short_desc || '')} Choose a design below, or tell us your own idea.</p>
    <div class="moq-bar"><span><b>Minimum order: ${min} pieces</b> per design · Higher quantity = lower price per box</span></div>
    <div class="pp-actions"><a class="btn btn-gold" href="/quote?product=${encodeURIComponent(p.name)}">Get a Quote</a>
      <a class="btn btn-wa" href="${waLink(ctx, `Hi WNP Enterprise, I am interested in the "${p.name}". Please share price and details. (Minimum ${min} pieces)`)}" target="_blank" rel="noopener">${WA_ICON} WhatsApp</a>
      ${d.pages.samples ? '<a class="btn btn-dark" href="/samples">Order a sample</a>' : ''}</div>
    <div class="facts"><h3>Specifications</h3><ul>${facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>${sizesTable(p.sizes) ? `<h3 style="margin-top:18px">Popular sizes</h3>${sizesTable(p.sizes)}` : ''}</div>
  </div>
</div></section>
${p.designs.length ? `<section style="background:var(--paper-2)"><div class="wrap"><div class="section-head"><span class="eyebrow">${p.designs.length} design${p.designs.length === 1 ? '' : 's'}</span><h2>Designs for the ${esc(p.name)}</h2><p>Every design is made to your size, colour and logo.</p></div>
  <div class="designs${p.designs.length < 3 ? '' : ''}">${designsHtml}</div></div></section>` : ''}
${p.description ? `<section><div class="wrap"><div class="prose" style="margin:0 auto">${md(p.description)}</div></div></section>` : ''}
${reviews.length ? `<section><div class="wrap"><div class="section-head"><span class="eyebrow">Reviews</span><h2>What customers say</h2></div><div class="reviews">${reviews.slice(0, 6).map((r) => reviewCard(ctx, r)).join('')}</div></div></section>` : ''}
${posts.length ? `<section><div class="wrap"><div class="section-head"><span class="eyebrow">Guides</span><h2>Helpful reading</h2></div><div class="posts">${posts.slice(0, 3).map((b) => postCard(ctx, b)).join('')}</div></div></section>` : ''}
${ctaBand(ctx, `Get a quote for your ${p.name}`)}
${others.length ? `<section><div class="wrap"><div class="section-head"><span class="eyebrow">More styles</span><h2>Other box styles</h2></div>${productGrid(ctx, others)}</div></section>` : ''}`;

  const prodSchema = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name,
    description: plain(p.description, 300) || p.short_desc || p.name,
    image: photos.slice(0, 6).map((x) => absUrl(ctx, x.url)),
    brand: { '@type': 'Brand', name: BRAND }, manufacturer: { '@id': ctx.site + '/#org' },
    url: ctx.site + '/' + p.slug,
  };
  if (reviews.length) {
    const avg = reviews.reduce((a, r) => a + (r.rating || 5), 0) / reviews.length;
    prodSchema.aggregateRating = { '@type': 'AggregateRating', ratingValue: +avg.toFixed(1), reviewCount: reviews.length, bestRating: 5 };
    prodSchema.review = reviews.slice(0, 5).map((r) => ({ '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 }, author: { '@type': 'Person', name: r.name }, reviewBody: r.text }));
  }
  return layout(ctx, {
    title: p.name,
    description: p.meta_description || `${p.short_desc || p.name} Made to your size from ${min} pieces, with premium finishes. Delivered to the UK, USA, Canada and Europe.`,
    path: '/' + p.slug, image: main && main.url, body,
    schema: [prodSchema, crumbSchema(ctx, items)],
  });
}

function genericPage(ctx, page, o = {}) {
  const items = [['Home', '/'], [page.title, '/' + page.slug]];
  const us = o.us;
  const body = `${pageHero(ctx, page.title, o.sub || '', items, o.eyebrow)}
<section><div class="wrap">${o.before || ''}<div class="prose">${md(page.body)}</div>${o.after || ''}</div></section>
${o.grid ? `<section style="background:var(--paper-2)"><div class="wrap"><div class="section-head"><span class="eyebrow">Box styles</span><h2>${esc(o.gridTitle || 'Choose your box style')}</h2></div>${o.grid}</div></section>` : ''}
${o.noCta ? '' : ctaBand(ctx, o.ctaTitle, us ? `Send your size, colors and quantity. We reply within 24 hours. Minimum ${ctx.min} pieces per design.` : undefined)}`;
  return layout(ctx, {
    title: page.title, description: page.meta_description || plain(page.body, 155), path: '/' + page.slug, body,
    lang: us ? 'en-US' : 'en-GB',
    schema: [crumbSchema(ctx, items)].concat(o.schema || []),
  });
}

function category(ctx, page) {
  let list = ctx.data.products;
  let grid;
  if (page.slug === 'perfume-boxes') {
    const isPerfume = (p) => /perfume/i.test(`${p.name} ${p.category || ''}`);
    const first = list.filter(isPerfume), rest = list.filter((p) => !isPerfume(p));
    grid = productGrid(ctx, first.length ? first : list) + (first.length && rest.length ? `<div class="section-head" style="margin-top:56px"><h2>Also used for perfume</h2></div>${productGrid(ctx, rest)}` : '');
  } else grid = productGrid(ctx, list);
  return genericPage(ctx, page, { grid, eyebrow: 'From ' + ctx.min + ' pieces', ctaTitle: 'Tell us about your boxes' });
}

function quotePage(ctx, q) {
  const s = ctx.settings;
  const type = q.type === 'sample' ? 'sample' : 'order';
  const items = [['Home', '/'], ['Get a quote', '/quote']];
  const body = `${pageHero(ctx, 'Request a quote', 'Fill in your details and we will send you the price and next steps within 24 hours.', items, 'Get a Quote')}
<section><div class="wrap form-wrap">
  ${quoteForm(ctx, { type, toggle: true, product: q.product || '' })}
  <aside>
    <div class="side-card"><h3>Good to know</h3><ul>
      <li>✦ Minimum order: <b>${ctx.min} pieces</b> per design</li>
      <li>✦ The higher the quantity, the lower the price per box</li>
      <li>✦ Delivery is included in bulk quotes</li>
      <li>✦ Paid samples available before bulk</li></ul></div>
    <div class="side-card"><h3>Prefer to talk?</h3><p>Message us on WhatsApp at <a style="text-decoration:underline" href="${waLink(ctx, 'Hi WNP Enterprise, I would like a quote for custom boxes.')}" target="_blank" rel="noopener">${esc(s.whatsapp)}</a> or email <a style="text-decoration:underline" href="mailto:${esc(s.email)}">${esc(s.email)}</a>.</p>
      ${s.booking_url ? `<p style="margin-top:10px"><a class="btn btn-dark btn-sm" href="${esc(s.booking_url)}" target="_blank" rel="noopener">Book a call</a></p>` : ''}</div>
    <div class="side-card"><h3>Artwork</h3><p>A vector logo (AI, EPS, SVG or PDF) is best. You can send it by email or WhatsApp after you submit.</p></div>
  </aside>
</div></section>`;
  return layout(ctx, { title: 'Get a Quote for Custom Rigid Boxes', description: `Request a quote for custom rigid boxes and perfume boxes, from ${ctx.min} pieces. We reply within 24 hours.`, path: '/quote', body, schema: [crumbSchema(ctx, items)] });
}

function samplesPage(ctx, page) {
  return genericPage(ctx, page, {
    eyebrow: 'Paid samples', noCta: true,
    after: `<div style="max-width:760px;margin-top:34px"><h2 style="font-size:32px;margin-bottom:16px">Request a sample price</h2>${quoteForm(ctx, { type: 'sample' })}</div>`,
  });
}

function countryPage(ctx, page) {
  const us = page.slug === 'usa' || page.slug === 'canada';
  return genericPage(ctx, page, { us, grid: productGrid(ctx, ctx.data.products), eyebrow: page.slug === 'uk' ? 'United Kingdom' : page.slug === 'usa' ? 'United States' : 'Canada' });
}

function faqPage(ctx) {
  const items = [['Home', '/'], ['FAQ', '/faq']];
  const faqs = ctx.data.faqs;
  const body = `${pageHero(ctx, 'Frequently asked questions', 'Straight answers about custom rigid boxes, samples, finishes and delivery.', items, 'FAQ')}
<section><div class="wrap"><div class="faq">${faqs.map((f) => `<details><summary>${esc(f.question)}</summary><p>${esc(f.answer || '')}</p></details>`).join('')}</div></div></section>
${ctaBand(ctx, 'Still have a question?', 'Send us a message and we will reply within 24 hours.')}`;
  return layout(ctx, {
    title: 'FAQ – Custom Rigid Boxes', description: 'Answers about custom rigid boxes: minimum order, sizes, finishes, artwork files, samples and delivery to the UK, USA and Canada.',
    path: '/faq', body,
    schema: [crumbSchema(ctx, items), {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer || '' } })),
    }],
  });
}

function blogList(ctx) {
  const items = [['Home', '/'], ['Blog', '/blog']];
  const posts = ctx.data.posts;
  const body = `${pageHero(ctx, 'Packaging guides', 'Practical guides on rigid boxes, finishes, sizes and launching your product.', items, 'Blog')}
<section><div class="wrap">${posts.length ? `<div class="posts">${posts.map((b) => postCard(ctx, b)).join('')}</div>` : '<p style="text-align:center;color:var(--muted)">New articles are on the way.</p>'}</div></section>
${ctaBand(ctx)}`;
  return layout(ctx, { title: 'Packaging Guides & Blog', description: 'Guides on custom rigid boxes and perfume packaging: box styles, finishes, sizing your bottle and planning a small launch.', path: '/blog', body, schema: [crumbSchema(ctx, items)] });
}

function post(ctx, b) {
  const items = [['Home', '/'], ['Blog', '/blog'], [b.title, '/blog/' + b.slug]];
  const related = ctx.data.products.filter((p) => (b.product_slugs || []).includes(p.slug));
  const body = `${pageHero(ctx, b.title, b.excerpt || '', items, (b.category || 'Guide') + (b.published_at ? ' · ' + fmtDate(b.published_at) : ''))}
<section><div class="wrap"><article class="prose" style="margin:0 auto">
  ${b.cover_image ? `<div class="post-cover">${photo(b.cover_image, b.cover_alt || b.title, { eager: true, sizes: '(max-width:760px) 100vw, 760px' })}</div>` : ''}
  ${md(b.body)}
</article></div></section>
${related.length ? `<section style="background:var(--paper-2)"><div class="wrap"><div class="section-head"><span class="eyebrow">Box styles in this article</span><h2>See the boxes</h2></div>${productGrid(ctx, related)}</div></section>` : ''}
${ctaBand(ctx)}`;
  return layout(ctx, {
    title: b.title, description: b.meta_description || b.excerpt || plain(b.body, 155), path: '/blog/' + b.slug, image: b.cover_image, ogType: 'article', body,
    schema: [crumbSchema(ctx, items), {
      '@context': 'https://schema.org', '@type': 'BlogPosting', headline: b.title, description: b.meta_description || b.excerpt || '',
      datePublished: b.published_at || b.created_at, dateModified: b.updated_at || b.published_at || b.created_at,
      image: b.cover_image ? [absUrl(ctx, b.cover_image)] : undefined,
      author: { '@id': ctx.site + '/#org' }, publisher: { '@id': ctx.site + '/#org' },
      mainEntityOfPage: ctx.site + '/blog/' + b.slug,
    }],
  });
}

function reviewsPage(ctx) {
  const items = [['Home', '/'], ['Reviews', '/reviews']];
  const r = ctx.data.reviews;
  const avg = r.length ? r.reduce((a, x) => a + (x.rating || 5), 0) / r.length : 0;
  const body = `${pageHero(ctx, 'Customer reviews', 'What brands say about their boxes.', items, 'Reviews')}
<section><div class="wrap">${r.length ? `<div class="rating-big"><b>${avg.toFixed(1)}</b>${stars(avg)}<span>from ${r.length} review${r.length === 1 ? '' : 's'}</span></div><div class="reviews">${r.map((x) => reviewCard(ctx, x)).join('')}</div>`
    : '<p style="text-align:center;color:var(--muted)">Reviews from our customers will appear here.</p>'}</div></section>
${ctaBand(ctx)}`;
  return layout(ctx, { title: 'Customer Reviews', description: 'Reviews from brands that ordered custom rigid boxes and perfume packaging from WNP Enterprise.', path: '/reviews', body, schema: [crumbSchema(ctx, items)] });
}

function reviewForm(ctx, token) {
  const body = `${pageHero(ctx, 'How were your boxes?', 'Thank you for ordering with us. Your review helps other brands choose with confidence.', null, 'Leave a review')}
<section><div class="wrap" style="max-width:720px">
<div class="form-box">
<form class="f light js-review" data-token="${esc(token)}" novalidate>
  <div class="hp" aria-hidden="true"><label for="r_website">Website</label><input id="r_website" name="website" tabindex="-1" autocomplete="off"></div>
  <div class="field"><label>Your rating *</label><div class="star-input">${[5, 4, 3, 2, 1].map((n) => `<input type="radio" id="star${n}" name="rating" value="${n}"${n === 5 ? ' checked' : ''}><label for="star${n}" aria-label="${n} stars">★</label>`).join('')}</div></div>
  <div class="field"><label for="r_text">Your review *</label><textarea id="r_text" name="text" required placeholder="How did the boxes look and feel? How was working with us?"></textarea></div>
  <div class="row"><div class="field"><label for="r_name">Your name *</label><input id="r_name" name="name" required autocomplete="name"></div>
    <div class="field"><label for="r_brand">Brand / company</label><input id="r_brand" name="brand" autocomplete="organization"></div></div>
  <div class="field"><label for="r_country">Country</label><input id="r_country" name="country" autocomplete="country-name"></div>
  <button type="submit" class="btn btn-gold" style="width:100%">Send review</button>
  <p class="form-note js-note">Your review is checked by our team before it appears on the website.</p>
</form>
<div class="form-done" role="status"><div class="success-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><h3>Thank you!</h3><p>We have received your review.</p></div>
</div></div></section>`;
  return layout(ctx, { title: 'Leave a Review', description: 'Leave a review for your WNP Enterprise boxes.', path: '/review/' + token, body, noindex: true });
}

function notFound(ctx) {
  const body = `<section class="notfound"><div class="wrap"><span class="eyebrow">404</span><h1>Page not found</h1><p style="color:var(--muted);margin-bottom:26px">The page you are looking for has moved or does not exist.</p>
  <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap"><a class="btn btn-dark" href="/">Go to the home page</a><a class="btn btn-gold" href="/quote">Get a Quote</a></div></div></section>
  <section style="padding-top:0"><div class="wrap">${productGrid(ctx, ctx.data.products)}</div></section>`;
  return layout(ctx, { title: 'Page not found', description: 'Page not found.', path: ctx.path, body, noindex: true });
}

/* ------------------------------------------------------------ sitemap */
function sitemap(ctx) {
  const d = ctx.data;
  const urls = [['/', null], ['/quote', null], ['/faq', null]];
  ['rigid-boxes', 'perfume-boxes', 'samples', 'about', 'shipping', 'uk', 'usa', 'canada', 'privacy', 'terms', 'returns']
    .forEach((s) => { if (d.pages[s]) urls.push(['/' + s, d.pages[s].updated_at]); });
  d.products.forEach((p) => urls.push(['/' + p.slug, p.updated_at]));
  if (d.posts.length) { urls.push(['/blog', d.posts[0].updated_at]); d.posts.forEach((b) => urls.push(['/blog/' + b.slug, b.updated_at || b.published_at])); }
  if (d.reviews.length) urls.push(['/reviews', null]);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(([u, t]) => `  <url><loc>${esc(ctx.site + u)}</loc>${t ? `<lastmod>${new Date(t).toISOString().slice(0, 10)}</lastmod>` : ''}</url>`).join('\n') + '\n</urlset>\n';
}

function robots(ctx) {
  const bots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'Bingbot', 'Googlebot'];
  const rules = 'Allow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /review/\n';
  if (ctx.noindex) return 'User-agent: *\nDisallow: /\n';
  return bots.map((b) => `User-agent: ${b}\n${rules}`).join('\n') + `\nUser-agent: *\n${rules}\nSitemap: ${ctx.site}/sitemap.xml\n`;
}

module.exports = {
  home, product, genericPage, category, quotePage, samplesPage, countryPage, faqPage,
  blogList, post, reviewsPage, reviewForm, notFound, sitemap, robots,
  _test: { sizesTable, postal, localName, pageTitle },
};
