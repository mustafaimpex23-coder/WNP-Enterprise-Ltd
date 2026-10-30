// /api/review
//   { action: "request", query_id }  (admins only) -> makes a one-time review
//        link for a won order, emails it to the buyer if Gmail is set up,
//        and returns the link so it can also be sent on WhatsApp.
//   { action: "submit", token, rating, text, name, brand, country }  (public)
//        -> saves the review as hidden until an admin approves it.
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { sb, pushAll } = require('./quote.js');

const env = (k, d = '') => (process.env[k] || d).trim();
const SITE_URL = env('SITE_URL', 'https://wnpenterprise.vercel.app').replace(/\/$/, '');
const BRAND = env('BRAND_NAME', 'WNP Enterprise');
const clip = (v, n) => (v == null ? '' : String(v).trim().slice(0, n));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function currentAdmin(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await sb().auth.getUser(token);
  if (!data || !data.user) return null;
  const { data: a } = await sb().from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
  return a ? data.user : null;
}

async function productSlugFor(text) {
  if (!text) return null;
  const { data } = await sb().from('products').select('slug, name');
  const t = String(text).toLowerCase();
  const hit = (data || []).filter((p) => t.startsWith(p.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0];
  return hit ? hit.slug : null;
}

async function emailBuyer(q, link) {
  const user = env('GMAIL_USER');
  const pass = env('GMAIL_APP_PASSWORD').replace(/\s+/g, '');
  if (!user || !pass || !q.email) return false;
  const t = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  const first = String(q.name || '').split(' ')[0] || 'there';
  await t.sendMail({
    from: `"${BRAND}" <${user}>`,
    to: q.email,
    subject: `How were your boxes? – ${BRAND}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#222;line-height:1.55">
      <p>Hi ${esc(first)},</p>
      <p>Thank you for your order${q.product ? ' of <b>' + esc(q.product) + '</b>' : ''}. We hope your boxes arrived looking great.</p>
      <p>Could you spare one minute to tell other brands what you thought? It really helps a small business like ours.</p>
      <p style="margin:24px 0"><a href="${link}" style="background:#b8935a;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Leave a review</a></p>
      <p>Thank you,<br>${esc(BRAND)}</p></div>`,
  });
  return true;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};

  try {
    if (b.action === 'request') {
      const me = await currentAdmin(req);
      if (!me) return res.status(403).json({ ok: false, error: 'Only admins can send review requests.' });
      const { data: q } = await sb().from('queries').select('*').eq('id', b.query_id).maybeSingle();
      if (!q) return res.status(404).json({ ok: false, error: 'Query not found.' });
      const token = crypto.randomBytes(18).toString('base64url');
      const product_slug = await productSlugFor(q.product);
      const { error } = await sb().from('review_requests').insert({ token, query_id: q.id, name: q.name, email: q.email, product: q.product, product_slug });
      if (error) return res.status(500).json({ ok: false, error: error.message.includes('review_requests') ? 'Run the database update (update-2-multipage.sql) first.' : error.message });
      const link = `${SITE_URL}/review/${token}`;
      let emailed = false;
      try { emailed = await emailBuyer(q, link); } catch (e) { console.error('review email failed', e.message); }
      return res.status(200).json({ ok: true, link, emailed });
    }

    if (b.action === 'submit') {
      if (clip(b.website, 100)) return res.status(200).json({ ok: true }); // bot
      const token = clip(b.token, 64);
      const { data: r } = await sb().from('review_requests').select('*').eq('token', token).maybeSingle();
      if (!r) return res.status(400).json({ ok: false, error: 'This review link is not valid. Please ask us for a new one.' });
      if (r.used_at) return res.status(400).json({ ok: false, error: 'A review was already sent with this link. Thank you!' });
      const text = clip(b.text, 2000), name = clip(b.name, 120);
      if (!text || !name) return res.status(400).json({ ok: false, error: 'Please write your review and your name.' });
      const rating = Math.max(1, Math.min(5, parseInt(b.rating, 10) || 5));
      const { error } = await sb().from('reviews').insert({
        name, text, rating, brand: clip(b.brand, 120), country: clip(b.country, 80),
        product_slug: r.product_slug, source: 'customer', query_id: r.query_id, is_published: false,
      });
      if (error) return res.status(500).json({ ok: false, error: 'Could not save your review. Please try again.' });
      await sb().from('review_requests').update({ used_at: new Date().toISOString() }).eq('token', token);
      try { await pushAll({ title: `New review from ${name} – ${'★'.repeat(rating)}`, body: 'Approve it in the admin panel to show it on the website.', url: '/admin/#content', tag: 'review-' + token }); } catch {}
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (e) {
    console.error('review api error', e);
    return res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
};
