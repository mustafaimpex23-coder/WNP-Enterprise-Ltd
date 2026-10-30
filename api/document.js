// POST /api/document – emails a quotation / job card / invoice PDF to the
// customer from your Gmail, with the PDF attached. Admins only.
const nodemailer = require('nodemailer');
const { sb } = require('./quote.js');

const env = (k, d = '') => (process.env[k] || d).trim();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function currentAdmin(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await sb().auth.getUser(token);
  if (!data || !data.user) return null;
  const { data: a } = await sb().from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
  return a ? data.user : null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const me = await currentAdmin(req);
  if (!me) return res.status(403).json({ ok: false, error: 'Only admins can send documents.' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};
  const to = String(b.to || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return res.status(400).json({ ok: false, error: 'The customer email is not valid.' });
  if (!b.pdf || String(b.pdf).length > 6_000_000) return res.status(400).json({ ok: false, error: 'The PDF is missing or too large.' });

  const user = env('GMAIL_USER');
  const pass = env('GMAIL_APP_PASSWORD').replace(/\s+/g, '');
  if (!user || !pass) return res.status(400).json({ ok: false, error: 'Email is not set up yet (add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel). Use Share or PDF instead.' });

  const company = String(b.company || 'WNP Enterprise Ltd').slice(0, 120);
  const label = String(b.label || 'Document').slice(0, 40);
  const number = String(b.number || '').slice(0, 60);
  const first = String(b.name || '').split(' ')[0] || 'there';
  try {
    const t = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    await t.sendMail({
      from: `"${company}" <${user}>`,
      to,
      replyTo: user,
      subject: `${label} ${number} – ${company}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#222;line-height:1.55">
        <p>Hi ${esc(first)},</p>
        <p>Please find attached your ${esc(label.toLowerCase())} <b>${esc(number)}</b>.</p>
        <p>If you have any questions, just reply to this email or message us on WhatsApp.</p>
        <p>Kind regards,<br>${esc(company)}</p></div>`,
      attachments: [{ filename: String(b.filename || 'document.pdf').replace(/[^\w.-]+/g, '-'), content: Buffer.from(String(b.pdf), 'base64'), contentType: 'application/pdf' }],
    });
    if (b.id) await sb().from('documents').update({ sent_at: new Date().toISOString() }).eq('id', b.id);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('document email failed', e.message);
    return res.status(500).json({ ok: false, error: 'Could not send the email: ' + e.message });
  }
};
