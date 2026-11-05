// POST /api/track – counts website visits for the Analytics page in the admin panel.
// No cookies and no personal data: a random visit id, the page, where the visitor
// came from (Facebook, Google…), their country and device, and how long they stayed.
const { createClient } = require('@supabase/supabase-js');
const { cleanSupabaseUrl, cleanKey } = require('./_lib/data.js');

let _sb;
const sb = () => (_sb ||= createClient(cleanSupabaseUrl(process.env.SUPABASE_URL), cleanKey(process.env.SUPABASE_ANON_KEY), { auth: { persistSession: false } }));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|pingdom|monitor|curl|wget|python|vercel/i;

function source(ref, q, host) {
  const u = (q.utm_source || '').toLowerCase();
  if (q.fbclid || /facebook|^fb$|meta/.test(u)) return 'Facebook';
  if (/instagram|^ig$/.test(u)) return 'Instagram';
  if (q.gclid || /google/.test(u)) return 'Google';
  if (u) return u.charAt(0).toUpperCase() + u.slice(1, 40);
  if (!ref) return 'Direct';
  let h = '';
  try { h = new URL(ref).hostname.replace(/^www\./, '').toLowerCase(); } catch { return 'Direct'; }
  if (!h || h === host) return 'Direct';
  const known = [['facebook', 'Facebook'], ['fb.', 'Facebook'], ['instagram', 'Instagram'], ['google', 'Google'], ['bing', 'Bing'],
    ['yahoo', 'Yahoo'], ['duckduckgo', 'DuckDuckGo'], ['pinterest', 'Pinterest'], ['linkedin', 'LinkedIn'], ['lnkd.in', 'LinkedIn'],
    ['whatsapp', 'WhatsApp'], ['wa.me', 'WhatsApp'], ['t.co', 'X / Twitter'], ['twitter', 'X / Twitter'], ['tiktok', 'TikTok'],
    ['youtube', 'YouTube'], ['chatgpt', 'ChatGPT'], ['openai', 'ChatGPT'], ['hotfrog', 'Hotfrog'], ['europages', 'Europages']];
  const k = known.find(([s]) => h.includes(s));
  return k ? k[1] : h.slice(0, 60);
}

function device(ua) {
  if (/ipad|tablet/i.test(ua)) return 'Tablet';
  if (/mobi|android|iphone/i.test(ua)) return 'Mobile';
  return 'Desktop';
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  try {
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
    b = b || {};
    const ua = String(req.headers['user-agent'] || '');
    if (!UUID.test(b.id || '') || BOT.test(ua)) { res.statusCode = 204; return res.end(); }
    if (b.t === 'ping') {
      await sb().rpc('track_ping', { p_id: b.id, p_dur: Math.round(+b.dur || 0) });
    } else {
      const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').replace(/^www\./, '').toLowerCase();
      const q = b.q || {};
      await sb().rpc('track_view', {
        p_id: b.id, p_sid: String(b.sid || b.id), p_path: String(b.path || '/'),
        p_source: source(String(b.ref || ''), q, host), p_referrer: String(b.ref || '').slice(0, 300),
        p_campaign: String(q.utm_campaign || '').slice(0, 120),
        p_country: String(req.headers['x-vercel-ip-country'] || '').toUpperCase() || null,
        p_device: device(ua),
      });
    }
  } catch (e) { console.error('track', e.message); }
  res.statusCode = 204; res.end();
};
