// Tiny, safe Markdown renderer for pages and blog posts written in the
// admin panel. Supports: ## / ### headings, paragraphs, **bold**, *italic*,
// [links](url), ![images](url), - bullet and 1. numbered lists, > quotes, ---,
// and simple | pipe | tables |.
// All text is HTML-escaped first, so nothing typed can break the page.

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function safeUrl(u) {
  u = String(u || '').trim();
  if (/^(https?:\/\/|\/|#|mailto:|tel:)/i.test(u)) return u;
  return '#';
}

function inline(text) {
  let s = esc(text);
  // images first, then links
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) =>
    `<img src="${esc(safeUrl(url.replace(/&amp;/g, '&')))}" alt="${alt}" loading="lazy" decoding="async">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    const href = safeUrl(url.replace(/&amp;/g, '&'));
    const ext = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${esc(href)}"${ext}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s;
}

function md(src) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [], list = null, quote = [], table = [];

  const cells = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const flushTable = () => {
    if (!table.length) return;
    const rows = table.filter((r) => !/^\|?\s*:?-{2,}/.test(r.trim()));
    const head = cells(rows[0]), body = rows.slice(1).map(cells);
    out.push('<div class="table-wrap"><table class="md-table"><thead><tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' +
      body.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
    table = [];
  };

  const flushPara = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.type}>` + list.items.map((i) => '<li>' + inline(i) + '</li>').join('') + `</${list.type}>`); list = null; } };
  const flushQuote = () => { if (quote.length) { out.push('<blockquote>' + inline(quote.join(' ')) + '</blockquote>'); quote = []; } };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); flushTable(); };

  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flushAll(); continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) { flushPara(); flushList(); flushQuote(); table.push(line); continue; }
    flushTable();
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      flushAll();
      const lvl = Math.min(4, Math.max(2, m[1].length)); // a single # still becomes h2 (the page has its own h1)
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flushAll(); out.push('<hr>'); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); quote.push(m[1]); continue; }
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      flushPara(); flushQuote();
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
      list.items.push(m[1]); continue;
    }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara(); flushQuote();
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
      list.items.push(m[1]); continue;
    }
    if (list && /^\s{2,}\S/.test(raw)) { list.items[list.items.length - 1] += ' ' + line.trim(); continue; }
    flushList(); flushQuote();
    para.push(line.trim());
  }
  flushAll();
  return out.join('\n');
}

// Plain text version (for descriptions / excerpts)
function plain(src, max) {
  const t = String(src || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!max || t.length <= max) return t;
  return t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

module.exports = { md, plain, esc };
