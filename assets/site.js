/* Luxora Packaging – website script: menu, photo galleries, quote & review forms, cookies */
(function () {
  var body = document.body;
  var MIN = parseInt(body.getAttribute('data-min'), 10) || 50;
  var WA = body.getAttribute('data-wa') || '447394499329';
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function waLink(t) { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(t); }

  /* ---------- menu ---------- */
  var mb = $('.menu-btn'), menu = $('#menu');
  if (mb && menu) mb.addEventListener('click', function () {
    var open = menu.classList.toggle('open'); mb.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  $$('nav .dd > button').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var dd = b.parentNode, open = !dd.classList.contains('open');
      $$('nav .dd').forEach(function (x) { x.classList.remove('open'); });
      if (open) dd.classList.add('open');
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  document.addEventListener('click', function () { $$('nav .dd').forEach(function (x) { x.classList.remove('open'); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $$('nav .dd').forEach(function (x) { x.classList.remove('open'); }); });

  /* ---------- photo switching (product page + designs) ---------- */
  function swap(target, src, alt) {
    var img = target.querySelector('img'); if (!img) return;
    var pic = img.closest('picture');
    var fresh = document.createElement('img');
    fresh.src = src; fresh.alt = alt || img.alt; fresh.decoding = 'async';
    if (pic) pic.replaceWith(fresh); else img.replaceWith(fresh);
  }
  $$('.thumbs').forEach(function (t) {
    var main = $('.pp-gallery .main');
    $$('button', t).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('button', t).forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on');
        swap(main, b.getAttribute('data-src'), b.getAttribute('data-alt'));
      });
    });
  });
  $$('.design .mini').forEach(function (t) {
    var box = t.parentNode.querySelector('.ph-box');
    $$('button', t).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('button', t).forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on');
        swap(box, b.getAttribute('data-src'), b.getAttribute('data-alt'));
      });
    });
  });
  /* ---------- tap a box photo to see it full size ---------- */
  function bigSrc(img) {
    var pic = img.closest('picture'), best = img.currentSrc || img.src;
    if (pic) { var ss = pic.querySelector('source'); if (ss && ss.srcset) { var parts = ss.srcset.split(',').map(function (x) { return x.trim().split(/\s+/); }); parts.sort(function (a, b) { return parseInt(b[1] || 0, 10) - parseInt(a[1] || 0, 10); }); best = parts[0][0]; } }
    return best;
  }
  var lb = document.createElement('div');
  lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Photo viewer');
  lb.innerHTML = '<button class="lb-x" type="button" aria-label="Close photo">&times;</button><img alt=""><p class="lb-cap"></p>';
  document.body.appendChild(lb);
  var lastFocus = null;
  function openLb(img) {
    var big = lb.querySelector('img'); big.src = bigSrc(img); big.alt = img.alt || '';
    lb.querySelector('.lb-cap').textContent = img.alt || '';
    lastFocus = document.activeElement; lb.classList.add('on'); document.body.classList.add('lock'); lb.querySelector('.lb-x').focus();
  }
  function closeLb() { lb.classList.remove('on'); document.body.classList.remove('lock'); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  lb.addEventListener('click', function (e) { if (e.target !== lb.querySelector('img')) closeLb(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && lb.classList.contains('on')) closeLb(); });
  $$('.design .ph-box, .pp-gallery .main').forEach(function (box) {
    box.setAttribute('tabindex', '0'); box.setAttribute('role', 'button'); box.setAttribute('aria-label', 'View photo full size');
    function go(e) { var img = box.querySelector('img'); if (!img || (e.target.closest && e.target.closest('a,button'))) return; openLb(img); }
    box.addEventListener('click', go);
    box.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); } });
  });

  // Photos with a very different shape from their slot are shown whole, not cropped
  function fitCheck(img) {
    var box = img.closest('.ph-box'); if (!box || !img.naturalWidth) return;
    var slot = box.clientWidth / box.clientHeight || 1, ratio = img.naturalWidth / img.naturalHeight;
    if (Math.abs(ratio / slot - 1) > 0.15) box.classList.add('fit');
  }
  $$('.ph-box img').forEach(function (img) { if (img.complete) fitCheck(img); else img.addEventListener('load', function () { fitCheck(img); }); });

  /* ---------- real videos: play while on screen, pause when scrolled away ---------- */
  var vids = $$('video[data-auto]');
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (vids.length) {
    if (still || !('IntersectionObserver' in window)) vids.forEach(function (v) { v.controls = true; });
    else {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { var v = e.target; if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () { v.controls = true; }); } else v.pause(); });
      }, { threshold: 0.35 });
      vids.forEach(function (v) { io.observe(v); });
    }
  }

  /* ---------- quote / sample / enquiry forms ---------- */
  function val(f, n) { var el = f.elements[n]; return el ? String(el.value || '').trim() : ''; }
  function typeOf(f) {
    var r = f.querySelector('input[name=request_type]:checked') || f.querySelector('input[name=request_type]');
    return r ? r.value : (f.getAttribute('data-type') || 'order');
  }
  function setupQty(f) {
    var t = typeOf(f), q = f.elements.quantity;
    var label = $('.js-qty-label', f), hint = $('.js-qty-hint', f), btn = f.querySelector('button[type=submit]');
    if (t === 'sample') {
      q.min = 1; q.max = 5; if (!q.value || +q.value > 5) q.value = 1; q.placeholder = '1 – 5';
      if (label) label.textContent = 'Number of samples *'; if (hint) hint.textContent = 'Up to 5 sample pieces.';
      if (btn) btn.textContent = 'Request sample price';
    } else {
      q.min = MIN; q.removeAttribute('max'); if (q.value && +q.value < MIN) q.value = ''; q.placeholder = 'Minimum ' + MIN;
      if (label) label.textContent = 'Quantity *'; if (hint) hint.textContent = 'Minimum ' + MIN + ' pieces.';
      if (btn) btn.textContent = t === 'enquiry' ? 'Send enquiry' : 'Send quote request';
    }
  }
  function sizeText(f) {
    var l = parseFloat(val(f, 'size_l')), w = parseFloat(val(f, 'size_w')), h = parseFloat(val(f, 'size_h'));
    var u = val(f, 'size_unit') || 'cm';
    var nums = [l, w, h].filter(function (x) { return x > 0; });
    if (!nums.length) return '';
    var r = function (x, d) { var k = Math.pow(10, d); return Math.round(x * k) / k; };
    var toMm = { mm: 1, cm: 10, in: 25.4 }[u] || 10;
    var main = nums.map(function (x) { return r(x, 2); }).join(' × ') + ' ' + u;
    // always show the other system too: inches for metric sizes, millimetres for inches
    var other = u === 'in'
      ? nums.map(function (x) { return Math.round(x * toMm); }).join(' × ') + ' mm'
      : nums.map(function (x) { return r(x * toMm / 25.4, 2); }).join(' × ') + ' in';
    return main + ' (' + other + ')';
  }
  function post(url, data) {
    function once() {
      return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            if (!r.ok || !j.ok) { var e = new Error(j.error || 'Something went wrong. Please try again.'); e.server = true; throw e; }
            return j;
          });
        });
    }
    return once().catch(function (e) {
      if (e.server) throw e;
      return new Promise(function (res) { setTimeout(res, 1500); }).then(once);
    });
  }
  function showError(note, e) {
    note.className = 'form-note bad js-note';
    note.textContent = (e && e.server ? e.message : 'Could not send – please check your internet and try again.') + ' ';
    var a = document.createElement('a'); a.href = waLink('Hi Luxora Packaging, I would like a quote for custom boxes.');
    a.target = '_blank'; a.rel = 'noopener'; a.style.textDecoration = 'underline'; a.textContent = 'Message us on WhatsApp instead.';
    note.appendChild(a);
  }

  $$('form.js-quote').forEach(function (f) {
    setupQty(f);
    $$('input[name=request_type]', f).forEach(function (r) { r.addEventListener('change', function () { setupQty(f); }); });
    var params = new URLSearchParams(location.search);
    if (params.get('type') === 'sample') { var s = f.querySelector('input[name=request_type][value=sample]'); if (s) { s.checked = true; setupQty(f); } }

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = f.querySelector('button[type=submit]'); if (btn.disabled) return;
      var note = $('.js-note', f), err = $('.js-qty-err', f);
      note.className = 'form-note js-note'; note.textContent = 'Minimum order ' + MIN + ' pieces · We reply within 24 hours';
      if (err) err.style.display = 'none';
      var t = typeOf(f);
      var need = ['name', 'email'].concat(t === 'enquiry' ? [] : ['country']);
      for (var i = 0; i < need.length; i++) {
        var el = f.elements[need[i]], v = String(el.value || '').trim();
        if (!v || (need[i] === 'email' && !/^\S+@\S+\.\S+$/.test(v))) {
          el.focus(); note.className = 'form-note bad js-note';
          note.textContent = t === 'enquiry' ? 'Please fill in your name and a valid email.' : 'Please fill in your name, a valid email and country.';
          return;
        }
      }
      var q = parseInt(val(f, 'quantity'), 10);
      if (t === 'sample' ? !(q >= 1 && q <= 5) : !(q >= MIN)) {
        if (err) { err.textContent = t === 'sample' ? 'Please enter 1 to 5 samples.' : 'Minimum order is ' + MIN + ' pieces.'; err.style.display = 'block'; }
        f.elements.quantity.focus(); return;
      }
      var data = {
        request_type: t, product: val(f, 'product'), quantity: q,
        name: val(f, 'name'), email: val(f, 'email'), phone: val(f, 'phone'), company: val(f, 'company'),
        country: val(f, 'country'), box_size: sizeText(f), details: val(f, 'details'), website: val(f, 'website'),
        page_url: location.href, referrer: document.referrer || ''
      };
      var old = btn.textContent; btn.disabled = true; btn.textContent = 'Sending…';
      post('/api/quote', data).then(function () {
        f.style.display = 'none';
        var done = f.parentNode.querySelector('.form-done'); if (done) { done.classList.add('on'); done.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        if (window.gtag) window.gtag('event', 'generate_lead', { request_type: t });
      }).catch(function (e2) { showError(note, e2); })
        .then(function () { btn.disabled = false; btn.textContent = old; });
    });
  });

  /* ---------- review form ---------- */
  $$('form.js-review').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = f.querySelector('button[type=submit]'); if (btn.disabled) return;
      var note = $('.js-note', f);
      var r = f.querySelector('input[name=rating]:checked');
      if (!val(f, 'text') || !val(f, 'name')) { note.className = 'form-note bad js-note'; note.textContent = 'Please write your review and your name.'; return; }
      btn.disabled = true; btn.textContent = 'Sending…';
      post('/api/review', { action: 'submit', token: f.getAttribute('data-token'), rating: r ? +r.value : 5,
        text: val(f, 'text'), name: val(f, 'name'), brand: val(f, 'brand'), country: val(f, 'country'), website: val(f, 'website') })
        .then(function () { f.style.display = 'none'; f.parentNode.querySelector('.form-done').classList.add('on'); })
        .catch(function (e2) { note.className = 'form-note bad js-note'; note.textContent = e2.server ? e2.message : 'Could not send – please try again.'; })
        .then(function () { btn.disabled = false; btn.textContent = 'Send review'; });
    });
  });

  /* ---------- cookies + Google Analytics (only after "Accept") ---------- */
  var GA = body.getAttribute('data-ga');
  // The Google tag is in the page head with cookies switched off (Consent Mode); "Accept" switches them on
  function loadGA() {
    if (!GA || !window.gtag) return;
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
  }
  if (GA) {
    var choice = null; try { choice = localStorage.getItem('wnp_cookies'); } catch (e) {}
    var bar = $('#cookie');
    if (choice === 'yes') loadGA();
    else if (!choice && bar) bar.classList.add('on');
    $$('[data-cookie]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-cookie');
        try { localStorage.setItem('wnp_cookies', v); } catch (e) {}
        if (bar) bar.classList.remove('on');
        if (v === 'yes') loadGA();
      });
    });
  }
})();

// Show "Scroll for more" only while there is more of the menu to see
(function () {
  function check(m) {
    var hint = m.querySelector('.dd-more');
    if (!hint) return;
    var more = m.scrollHeight - m.clientHeight - m.scrollTop > 24;
    hint.style.visibility = more ? 'visible' : 'hidden';
  }
  document.querySelectorAll('nav .dd-menu').forEach(function (m) {
    m.addEventListener('scroll', function () { check(m); }, { passive: true });
    var dd = m.closest('.dd');
    if (dd) new MutationObserver(function () { check(m); }).observe(dd, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', function () { check(m); });
    check(m);
  });
})();

// Visit counter for the admin panel's Analytics page (no cookies, nothing personal)
(function () {
  try {
    if (location.hostname !== 'luxorapackaging.com' || localStorage.getItem('lx_admin') === '1' || navigator.webdriver) return;
  } catch (e) { return; }
  function uid() { return (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); })); }
  var sid; try { sid = sessionStorage.getItem('lx_sid') || uid(); sessionStorage.setItem('lx_sid', sid); } catch (e) { sid = uid(); }
  var id = uid(), shown = 0, since = document.hidden ? 0 : Date.now();
  var p = new URLSearchParams(location.search), q = {};
  ['utm_source', 'utm_campaign', 'fbclid', 'gclid'].forEach(function (k) { if (p.get(k)) q[k] = k.indexOf('clid') > 0 ? '1' : p.get(k).slice(0, 80); });
  function send(o) {
    var body = JSON.stringify(o);
    if (navigator.sendBeacon && navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))) return;
    fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
  }
  function secs() { return Math.round((shown + (since ? Date.now() - since : 0)) / 1000); }
  send({ id: id, sid: sid, path: location.pathname, ref: document.referrer, q: q });
  var timer = setInterval(function () { if (!document.hidden && secs() < 1800) send({ t: 'ping', id: id, dur: secs() }); }, 20000);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (since) { shown += Date.now() - since; since = 0; } send({ t: 'ping', id: id, dur: secs() }); }
    else since = Date.now();
  });
  window.addEventListener('pagehide', function () { clearInterval(timer); send({ t: 'ping', id: id, dur: secs() }); });
})();
/* Hide the floating WhatsApp button while someone is typing in a form, so it never covers a field */
(function () {
  var wa = document.querySelector('.wa-float'); if (!wa) return;
  document.addEventListener('focusin', function (e) { if (e.target.matches('input,select,textarea')) wa.classList.add('away'); });
  document.addEventListener('focusout', function () { setTimeout(function () { var a = document.activeElement; if (!a || !a.matches('input,select,textarea')) wa.classList.remove('away'); }, 150); });
})();
/* Sections fade in gently as they scroll into view */
(function () {
  if (!('IntersectionObserver' in window)) return;
  var els = document.querySelectorAll('main > section:not(.hero):not(.stats), body > section:not(.hero):not(.stats)');
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach(function (el) { var r = el.getBoundingClientRect(); if (r.top > innerHeight) { el.classList.add('rv'); io.observe(el); } });
})();

// 3D tilt on cards (mouse only; off for touch and reduced motion)
(function () {
  if (!window.matchMedia || !matchMedia('(hover:hover) and (pointer:fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.grid .card, .fin-grid .fin, .ind, .mk').forEach(function (el) {
    el.classList.add('tilt');
    el.addEventListener('mousemove', function (e) {
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      el.style.transform = 'perspective(900px) rotateY(' + (x * 10).toFixed(2) + 'deg) rotateX(' + (-y * 10).toFixed(2) + 'deg) translateY(-6px)';
    });
    el.addEventListener('mouseleave', function () { el.style.transform = ''; });
  });
})();
