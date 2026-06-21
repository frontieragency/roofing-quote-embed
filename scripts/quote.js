// Instant-quote tool (lite layout). Reads window.QUOTE_CONFIG (injected per
// client) and renders a two-mode flow: an instant price RANGE for standardized,
// dimension-driven services, and a fast-callback INTAKE for diagnostic/custom
// work. Flow: 1) pick service  2) contact  3) details -> estimate. Captures a
// qualified lead and fires it by email on the final submit.
(function () {
  var cfg = window.QUOTE_CONFIG;
  var root = document.getElementById('wcQuote');
  if (!cfg || !root) return;
  var disclaimer = root.getAttribute('data-disclaimer') || '';

  var state = { step: 1, svc: null, mode: null, values: {} };

  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function money(n) { return '$' + n.toLocaleString('en-US'); }

  // Phone helpers — live-format to "(123) 456-7890" and validate 10 digits.
  function phoneDigits(v) { return (v || '').replace(/\D/g, '').slice(0, 10); }
  function fmtPhone(v) {
    var d = phoneDigits(v);
    if (!d) return '';
    if (d.length < 4) return '(' + d;
    if (d.length < 7) return '(' + d.slice(0, 3) + ') ' + d.slice(3);
    return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
  }

  function computeRange(svc) {
    var base = svc.base || 0, mult = 1, add = 0, count = 1, w = 0, h = 0;
    (svc.fields || []).forEach(function (f) {
      var v = state.values[f.key];
      if (f.type === 'select') {
        var opt = (f.options || []).filter(function (o) { return o.value === v; })[0];
        if (opt) { if (opt.base) base += opt.base; if (opt.mult) mult *= opt.mult; if (opt.add) add += opt.add; }
      } else if (f.type === 'number') {
        var n = parseFloat(v) || 0;
        if (f.key === 'width') w = n; else if (f.key === 'height') h = n; else if (f.is_count) count = Math.max(1, n);
      }
    });
    var area = (w > 0 && h > 0) ? (w * h) / 144 : 0;
    var mid = ((base + (svc.per_sqft || 0) * area) * mult + add) * count;
    var spread = cfg.spread || 0.18, r = cfg.roundTo || 50;
    var round = function (x) { return Math.round(x / r) * r; };
    return { low: Math.max(r, round(mid * (1 - spread))), high: round(mid * (1 + spread)) };
  }

  // restore any previously-entered values into freshly-rendered inputs
  function restore(wrap) {
    wrap.querySelectorAll('[data-key]').forEach(function (i) {
      var k = i.getAttribute('data-key');
      if (state.values[k] != null && state.values[k] !== '') i.value = state.values[k];
    });
  }
  function capture(wrap) {
    wrap.querySelectorAll('[data-key]').forEach(function (i) { state.values[i.getAttribute('data-key')] = i.value.trim ? i.value.trim() : i.value; });
  }

  // ---- step renderers ----  (1 Service -> 2 Contact -> 3 Details -> result)
  function render() {
    root.innerHTML = '';
    root.appendChild(el('<div class="wc-q__steps">' +
      '<span class="' + (state.step >= 1 ? 'on' : '') + '">1 Service</span>' +
      '<span class="' + (state.step >= 2 ? 'on' : '') + '">2 Contact</span>' +
      '<span class="' + (state.step >= 3 ? 'on' : '') + '">3 Details</span></div>'));
    if (state.step === 1) renderServices();
    else if (state.step === 2) renderContact();
    else if (state.step === 3) renderDetails();
    else if (state.step === 4) renderResult();
  }

  function renderServices() {
    var wrap = el('<div class="wc-q__panel"><h2 class="wc-h2">What can we quote for you?</h2><div class="wc-q__grid"></div></div>');
    var grid = wrap.querySelector('.wc-q__grid');
    (cfg.instant || []).forEach(function (s) {
      var b = el('<button class="wc-q__svc" type="button"><span class="wc-q__svc-name">' + s.name + '</span><span class="wc-q__svc-tag">Instant estimate</span></button>');
      b.onclick = function () { state.svc = s; state.mode = 'instant'; state.step = 2; render(); };
      grid.appendChild(b);
    });
    (cfg.intake || []).forEach(function (s) {
      var b = el('<button class="wc-q__svc" type="button"><span class="wc-q__svc-name">' + s.name + '</span><span class="wc-q__svc-tag wc-q__svc-tag--alt">Fast callback</span></button>');
      b.onclick = function () { state.svc = s; state.mode = 'intake'; state.step = 2; render(); };
      grid.appendChild(b);
    });
    root.appendChild(wrap);
  }

  // STEP 2 — contact first (so the lead is captured before the estimate reveal)
  function renderContact() {
    var wrap = el('<div class="wc-q__panel"><p class="wc-q__back">&larr; Change service</p>' +
      '<h2 class="wc-h2">First &mdash; where should we send your estimate?</h2>' +
      '<p class="wc-q__hint">A couple of quick details next, then your price.</p>' +
      '<div class="wc-q__fields">' +
      '<label class="wc-q__field wc-q-field--full"><span>Your name</span><input data-key="name" type="text" autocomplete="name" required /></label>' +
      '<label class="wc-q__field"><span>Best number</span><input data-key="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(___) ___-____" required /></label>' +
      '<label class="wc-q__field"><span>City / ZIP</span><input data-key="zip" type="text" autocomplete="postal-code" required /></label>' +
      '<label class="wc-q__field wc-q-field--full"><span>Email</span><input data-key="email" type="email" autocomplete="email" required /></label>' +
      '</div></div>');
    restore(wrap);
    var ph = wrap.querySelector('[data-key="phone"]');
    if (ph) { ph.value = fmtPhone(ph.value); ph.addEventListener('input', function () { ph.value = fmtPhone(ph.value); }); }
    var next = el('<button class="wc-btn wc-btn--accent wc-btn--lg wc-btn--block" type="button">Continue</button>');
    next.onclick = function () {
      capture(wrap);
      if (!state.values.name || !state.values.email || !state.values.zip) { alert('Please fill in your name, city/ZIP, and email.'); return; }
      if (phoneDigits(state.values.phone).length !== 10) { alert('Please enter a valid 10-digit phone number.'); return; }
      state.step = 3; render();
    };
    wrap.appendChild(next);
    wrap.querySelector('.wc-q__back').onclick = function () { state.step = 1; render(); };
    root.appendChild(wrap);
  }

  function field(f) {
    var id = 'q_' + f.key;
    if (f.type === 'select') {
      var opts = (f.options || []).map(function (o) { return '<option value="' + o.value + '">' + o.label + '</option>'; }).join('');
      return '<label class="wc-q__field"><span>' + f.label + '</span><select id="' + id + '" data-key="' + f.key + '">' + opts + '</select></label>';
    }
    return '<label class="wc-q__field"><span>' + f.label + '</span><input id="' + id + '" data-key="' + f.key + '" type="number" inputmode="numeric" min="0" placeholder="' + (f.placeholder || '') + '" /></label>';
  }

  // STEP 3 — service details -> estimate.  All fields required.
  function renderDetails() {
    var s = state.svc, wrap;
    if (state.mode === 'instant') {
      var note = s.note ? '<p class="wc-q__hint">' + s.note + '</p>' : '';
      wrap = el('<div class="wc-q__panel"><p class="wc-q__back">&larr; Back</p><h2 class="wc-h2">' + s.name + '</h2>' + note + '<div class="wc-q__fields"></div></div>');
      var fields = wrap.querySelector('.wc-q__fields');
      (s.fields || []).forEach(function (f) { fields.appendChild(el(field(f))); });
      // seed select defaults only if not already chosen
      (s.fields || []).forEach(function (f) { if (f.type === 'select' && f.options && f.options[0] && !state.values[f.key]) state.values[f.key] = f.options[0].value; });
      restore(wrap);
    } else {
      wrap = el('<div class="wc-q__panel"><p class="wc-q__back">&larr; Back</p><h2 class="wc-h2">' + s.name + '</h2><label class="wc-q__field"><span>Tell us what you need</span><textarea data-key="description" rows="4" required placeholder="A few details &mdash; what&rsquo;s wrong, the location, rough size, anything helpful."></textarea></label></div>');
      restore(wrap);
    }
    var submit = el('<button class="wc-btn wc-btn--accent wc-btn--lg wc-btn--block" type="button">' + (state.mode === 'instant' ? 'See my estimate' : 'Send my request') + '</button>');
    submit.onclick = function () {
      capture(wrap);
      if (state.mode === 'instant') {
        // every detail field is required
        var missing = (s.fields || []).some(function (f) {
          var val = state.values[f.key];
          if (f.type === 'number') return !(parseFloat(val) > 0);
          return !val;
        });
        if (missing) { alert('Please answer all the questions so we can estimate.'); return; }
      } else if (!(state.values.description || '').trim()) {
        alert('Please tell us a little about what you need.'); return;
      }
      submit.disabled = true; submit.textContent = 'Sending…';
      fireLead(function () { state.step = 4; render(); });
    };
    wrap.appendChild(submit);
    wrap.appendChild(el('<p class="wc-q__fine">' + disclaimer + '</p>'));
    wrap.querySelector('.wc-q__back').onclick = function () { state.step = 2; render(); };
    root.appendChild(wrap);
  }

  function fireLead(done) {
    var v = state.values, s = state.svc;
    var payload = {
      _subject: 'New ' + (state.mode === 'instant' ? 'instant-quote' : 'callback') + ' lead — ' + s.name + ' (' + cfg.domain + ')',
      Service: s.name, Mode: state.mode, Name: v.name, Phone: v.phone, Email: v.email,
      ZIP: v.zip || ''
    };
    if (state.mode === 'instant') {
      var r = computeRange(s);
      payload.Estimate = money(r.low) + ' – ' + money(r.high);
      (s.fields || []).forEach(function (f) {
        var val = v[f.key]; if (!val) return;
        if (f.type === 'select') { var o = (f.options || []).filter(function (x) { return x.value === val; })[0]; val = o ? o.label : val; }
        payload[f.label] = val;
      });
    } else {
      payload.Details = v.description || '';
    }
    if (!cfg.ajax) { done(); return; }
    fetch(cfg.ajax, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
      .then(function () { done(); }).catch(function () { done(); });
  }

  function renderResult() {
    var s = state.svc, v = state.values, inner;
    if (state.mode === 'instant') {
      var r = computeRange(s);
      inner = '<p class="wc-kicker">Your estimate</p>' +
        '<div class="wc-q__range">' + money(r.low) + ' – ' + money(r.high) + '</div>' +
        '<p class="wc-q__sub">for ' + s.name.toLowerCase() + '. ' + disclaimer + '</p>' +
        '<p class="wc-q__sent">Our team has received your instant quote request — expect a call or text shortly to confirm and book a free inspection.</p>';
    } else {
      inner = '<p class="wc-kicker">Request received</p>' +
        '<div class="wc-q__range wc-q__range--sm">Thanks, ' + (v.name || '').split(' ')[0] + '!</div>' +
        '<p class="wc-q__sub">' + s.name + ' needs a quick look to price right. ' + cfg.business + ' has your details and will reach out fast with next steps.</p>';
    }
    var wrap = el('<div class="wc-q__panel wc-q__result">' + inner +
      '<div class="wc-q__actions"><a class="wc-btn wc-btn--accent wc-q__call" href="tel:' + (cfg.phoneRaw || '') + '">' + (cfg.phone ? 'Call ' + cfg.phone : 'Call us now') + '</a>' +
      '<button class="wc-btn wc-btn--outline" type="button">Start another</button></div></div>');
    wrap.querySelector('button').onclick = function () { state = { step: 1, svc: null, mode: null, values: {} }; render(); };
    root.appendChild(wrap);
  }

  render();
})();
