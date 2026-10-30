// =====================================================================
// POST /api/quote  – receives every query / order from the website
//   1. saves it in Supabase (so nothing is ever lost)
//   2. sends a push notification to every admin phone / laptop
//   3. emails the team + sends the buyer an automatic confirmation
// The website only shows "Thank you" when this returns { ok: true }.
// =====================================================================
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const webpush = require('web-push');

const env = (k, d = '') => (process.env[k] || d).trim();

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

let _sb;
const sb = () =>
  (_sb ||= createClient(cleanSupabaseUrl(env('SUPABASE_URL')), cleanKey(env('SUPABASE_SERVICE_ROLE_KEY')), { auth: { persistSession: false } }));

const BRAND = env('BRAND_NAME', 'WNP Enterprise');
const SITE_URL = env('SITE_URL', 'https://wnpenterprise.vercel.app').replace(/\/$/, '');

const kind = (t) => (t === 'order' ? 'quote request' : t === 'sample' ? 'paid sample request' : 'enquiry');
const clip = (v, n = 500) => (v == null ? '' : String(v).trim().slice(0, n));
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pick = (b, ...keys) => {
  for (const k of keys) if (b[k] != null && String(b[k]).trim() !== '') return b[k];
  return '';
};

function parseBody(req) {
  let b = req.body;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch { b = Object.fromEntries(new URLSearchParams(b)); }
  }
  return b && typeof b === 'object' ? b : {};
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const b = parseBody(req);

  // Honeypot: bots fill the hidden "website" field. Pretend success.
  if (clip(b.website || b._honey)) return res.status(200).json({ ok: true });

  const q = {
    request_type: clip(pick(b, 'request_type', 'type'), 40) || 'enquiry',
    product: clip(pick(b, 'product', 'box_style', 'design'), 200),
    quantity: parseInt(pick(b, 'quantity', 'qty'), 10) || null,
    box_size: clip(pick(b, 'box_size', 'size'), 120),
    details: clip(pick(b, 'details', 'message', 'colours'), 4000),
    name: clip(pick(b, 'name', 'full_name'), 120),
    email: clip(pick(b, 'email'), 160).toLowerCase(),
    phone: clip(pick(b, 'phone', 'contact', 'contact_number'), 40),
    company: clip(pick(b, 'company', 'brand'), 160),
    country: clip(b.country, 80),
    page_url: clip(b.page_url, 500),
    referrer: clip(b.referrer, 500),
    ip: clip((req.headers['x-forwarded-for'] || '').split(',')[0], 64),
    ip_country: clip(req.headers['x-vercel-ip-country'], 8),
    ip_city: clip(decodeURIComponent(req.headers['x-vercel-ip-city'] || ''), 80),
    user_agent: clip(req.headers['user-agent'], 300),
  };

  if (!q.name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(q.email)) {
    return res.status(400).json({ ok: false, error: 'Please enter your name and a valid email.' });
  }

  // Simple flood protection: max 8 queries from one IP in 10 minutes
  if (q.ip) {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await sb()
      .from('queries').select('id', { count: 'exact', head: true })
      .eq('ip', q.ip).gte('created_at', since);
    if ((count || 0) >= 8) {
      return res.status(429).json({ ok: false, error: 'Too many requests. Please try again in a few minutes.' });
    }
  }

  // 1) Save
  const { data: row, error: dbErr } = await sb().from('queries').insert(q).select().single();
  if (dbErr) console.error('DB insert failed:', dbErr.message);
  const saved = row || { ...q, id: null, created_at: new Date().toISOString() };

  // 2) + 3) Push and email at the same time
  const [pushRes, mailRes] = await Promise.allSettled([sendPush(saved), sendEmails(saved)]);
  if (pushRes.status === 'rejected') console.error('Push failed:', pushRes.reason);
  if (mailRes.status === 'rejected') console.error('Email failed:', mailRes.reason);

  const emailOk = mailRes.status === 'fulfilled' && mailRes.value === true;
  const pushed = pushRes.status === 'fulfilled' ? pushRes.value : 0;

  if (row) {
    await sb().from('queries').update({ email_sent: emailOk, push_sent: pushed }).eq('id', row.id);
  }

  // Success only if the query is safely stored somewhere
  if (!row && !emailOk) {
    return res.status(500).json({ ok: false, error: 'Sorry, we could not send your query right now.' });
  }
  return res.status(200).json({ ok: true, id: row ? row.id : null });
};

// ---------------------------------------------------------------------
function sendPush(q) {
  return pushAll({
    title: `New ${kind(q.request_type)} – ${q.name}`,
    body: [q.product, q.quantity ? `${q.quantity} pcs` : '', q.country || q.ip_country].filter(Boolean).join(' · '),
    url: `/admin/${q.id ? '?q=' + q.id : ''}`,
    tag: q.id || String(Date.now()),
  });
}

// Sends one notification to every saved admin device (optionally one user only)
async function pushAll(message, onlyUserId) {
  const pub = env('VAPID_PUBLIC_KEY');
  const priv = env('VAPID_PRIVATE_KEY');
  if (!pub || !priv) return 0;
  webpush.setVapidDetails(env('VAPID_SUBJECT', 'mailto:mustafaimpex23@gmail.com'), pub, priv);

  let query = sb().from('push_subscriptions').select('*');
  if (onlyUserId) query = query.eq('user_id', onlyUserId);
  const { data: subs, error } = await query;
  if (error || !subs || !subs.length) return 0;

  const payload = JSON.stringify(message);

  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 24, urgency: 'high' }
        );
        sent++;
      } catch (e) {
        // phone uninstalled / permission removed -> clean up
        if (e.statusCode === 404 || e.statusCode === 410) {
          await sb().from('push_subscriptions').delete().eq('id', s.id);
        } else console.error('push error', e.statusCode, e.body);
      }
    })
  );
  return sent;
}

// ---------------------------------------------------------------------
async function sendEmails(q) {
  const user = env('GMAIL_USER');
  const pass = env('GMAIL_APP_PASSWORD').replace(/\s+/g, '');
  const to = env('NOTIFY_EMAILS', 'mustafaimpex23@gmail.com');
  if (!user || !pass) return false;

  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });

  const rows = [
    ['Request type', q.request_type],
    ['Box / design', q.product],
    ['Quantity', q.quantity],
    ['Box size', q.box_size],
    ['Details', q.details],
    ['Name', q.name],
    ['Email', q.email],
    ['Contact number', q.phone],
    ['Company / Brand', q.company],
    ['Country', q.country],
    ['Detected location', [q.ip_city, q.ip_country].filter(Boolean).join(', ')],
    ['Sent from page', q.page_url],
    ['Came from', q.referrer],
  ].filter(([, v]) => v !== '' && v != null);

  const table = rows
    .map(([k, v]) => `<tr><td style="padding:8px 12px;background:#f6f3ee;font-weight:600;width:160px;vertical-align:top">${esc(k)}</td><td style="padding:8px 12px;white-space:pre-wrap">${esc(v)}</td></tr>`)
    .join('');

  const waDigits = (q.phone || '').replace(/[^\d]/g, '');
  const panelLink = `${SITE_URL}/admin/${q.id ? '?q=' + q.id : ''}`;

  const teamHtml = `
  <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#222">
    <h2 style="margin:0 0 4px">New ${kind(q.request_type)} from the website</h2>
    <p style="margin:0 0 16px;color:#666">${esc(new Date(q.created_at).toUTCString())}</p>
    <table style="border-collapse:collapse;width:100%;border:1px solid #e6e0d6">${table}</table>
    <p style="margin:20px 0">
      <a href="${panelLink}" style="background:#1d1d1f;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open in admin panel</a>
      ${waDigits ? `&nbsp; <a href="https://wa.me/${waDigits}" style="background:#25d366;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">WhatsApp buyer</a>` : ''}
    </p>
    <p style="color:#888;font-size:12px">Reply to this email to answer the buyer directly.</p>
  </div>`;

  const subject = `New ${kind(q.request_type)} – ${q.product || 'Website'}${q.quantity ? ' – ' + q.quantity + ' pcs' : ''} – ${q.name}`;

  await transport.sendMail({
    from: `"${BRAND} Website" <${user}>`,
    to,
    replyTo: `"${q.name}" <${q.email}>`,
    subject,
    html: teamHtml,
  });

  // Automatic confirmation to the buyer (failure here doesn't fail the query)
  if (env('AUTO_REPLY', 'on') !== 'off') {
    const buyerHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#222;line-height:1.55">
      <p>Hi ${esc(q.name.split(' ')[0])},</p>
      <p>Thank you for contacting ${esc(BRAND)}. We have received your ${kind(q.request_type)}${q.product ? ' for <b>' + esc(q.product) + '</b>' : ''}${q.quantity ? ' (' + esc(q.quantity) + ' pcs)' : ''}.</p>
      <p>Our team will get back to you within 24 hours with pricing and next steps. If you have artwork, a logo or a reference photo, simply reply to this email and attach it.</p>
      <p>Kind regards,<br>${esc(BRAND)}<br>${esc(env('BRAND_PHONE', ''))}</p>
    </div>`;
    try {
      await transport.sendMail({
        from: `"${BRAND}" <${user}>`,
        to: q.email,
        replyTo: env('REPLY_TO', user),
        subject: `We received your ${kind(q.request_type)} – ${BRAND}`,
        html: buyerHtml,
      });
    } catch (e) {
      console.error('Auto-reply failed:', e.message);
    }
  }
  return true;
}

module.exports.pushAll = pushAll;
module.exports.sb = sb;
