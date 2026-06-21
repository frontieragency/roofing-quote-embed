// Instant-quote tool (lite layout). Reads window.QUOTE_CONFIG (injected per
// client) and renders a two-mode flow: an instant price RANGE for standardized,
// dimension-driven services, and a fast-callback INTAKE for diagnostic/custom
// work. Either way it captures a qualified lead and fires it by email on submit.
(function () {
  var cfg = window.QUOTE_CONFIG;
  var root = document.getElementById('wcQuote');
  if (!cfg || !root) return;
  var disclaimer = root.getAttribute('data-disclaimer') || '';

  var state = { step: 1, svc: null, mode: null, values: {} };

  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function money(n) { return '$' + n.toLocaleString('en-US'); }

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
    // Multipliers (material, glass, type) scale the whole per-unit cost — base AND
    // the size-driven part — then flat add-ons, then quantity. (When a service has
    // no per_sqft/dimensions, area is 0 and this reduces to base*mult+add, so
    // dimension-less services are unaffected.)
    var mid = ((base + (svc.per_sqft || 0) * area) * mult + add) * count;
    var spread = cfg.spread || 0.18, r = cfg.roundTo || 50;
    var round = function (x) { return Math.round(x / r) * r; };
    return { low: Math.max(r, round(mid * (1 - spread))), high: round(mid * (1 + spread)) };
  }

  // ---- step renderers ----
  function render() {
    root.innerHTML = '';
    root.appendChild(el('<div class="wc-q__steps"><span class="' + (state.step >= 1 ? 'on' : '') + '">1 Service</span><span class="' + (state.step >= 2 ? 'on' : '') + '">2 Details</span><span class="' + (state.step >= 3 ? 'on' : '') + '">3 Contact</span></div>'));
    if (state.step === 1) renderServices();
    else if (state.step === 2) renderDetails();
    else if (state.step === 3) renderContact();
    else if (state.step === 4) renderResult();
  }

  function renderServices() {
    var wrap = el('<div class="wc-q__panel"><h2 class="wc-h2">What can we quote for you?</h2><div class="wc-q__grid"></div></div>');
    var grid = wrap.querySelector('.wc-q__grid');
    (cfg.instant || []).forEach(function (s) {
      var b = el('<button class="wc-q__svc" type="button"><span class="wc-q__svc-name">' + s.name + '</span><span class="wc-q__svc-tag">Instant estimate</span></button>');
      b.onclick = function () { state.svc = s; state.mode = 'instant'; state.values = {}; state.step = 2; render(); };
      grid.appendChild(b);
    });
    (cfg.intake || []).forEach(function (s) {
      var b = el('<button class="wc-q__svc" type="button"><span class="wc-q__svc-name">' + s.name + '</span><span class="wc-q__svc-tag wc-q__svc-tag--alt">Fast callback</span></button>');
      b.onclick = function () { state.svc = s; state.mode = 'intake'; state.values = {}; state.step = 2; render(); };
      grid.appendChild(b);
    });
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

  function renderDetails() {
    var s = state.svc;
    var wrap;
    if (state.mode === 'instant') {
      var note = s.note ? '<p class="wc-q__hint">' + s.note + '</p>' : '';
      wrap = el('<div class="wc-q__panel"><p class="wc-q__back">&larr; Change service</p><h2 class="wc-h2">' + s.name + '</h2>' + note + '<div class="wc-q__fields"></div></div>');
      var fields = wrap.querySelector('.wc-q__fields');
      (s.fields || []).forEach(function (f) { fields.appendChild(el(field(f))); });
      // seed defaults for selects
      (s.fields || []).forEach(function (f) { if (f.type === 'select' && f.options && f.options[0]) state.values[f.key] = f.options[0].value; });
    } else {
      wrap = el('<div class="wc-q__panel"><p class="wc-q__back">&larr; Change service</p><h2 class="wc-h2">' + s.name + '</h2><label class="wc-q__field"><span>Tell us what you need</span><textarea data-key="description" rows="4" placeholder="A few details — what&rsquo;s broken, the location, rough size, anything helpful."></textarea></label></div>');
    }
    var next = el('<button class="wc-btn wc-btn--accent wc-btn--lg" type="button">Continue</button>');
    next.onclick = function () {
      // capture
      wrap.querySelectorAll('[data-key]').forEach(function (i) { state.values[i.getAttribute('data-key')] = i.value; });
      // validate required number fields for instant
      if (state.mode === 'instant') {
        var missing = (s.fields || []).some(function (f) { return f.type === 'number' && !(parseFloat(state.values[f.key]) > 0); });
        if (missing) { alert('Please fill in the measurements so we can estimate.'); return; }
      }
      state.step = 3; render();
    };
    wrap.appendChild(next);
    wrap.querySelector('.wc-q__back').onclick = function () { state.step = 1; render(); };
    root.appendChild(wrap);
  }

  function renderContact() {
    var heading = state.mode === 'instant' ? 'Almost there — where do we send your estimate?' : 'Where should we reach you?';
    var wrap = el('<div class="wc-q__panel"><p class="wc-q__back">&larr; Back</p><h2 class="wc-h2">' + heading + '</h2>' +
      '<div class="wc-q__fields">' +
      '<label class="wc-q__field"><span>Name</span><input data-key="name" type="text" required /></label>' +
      '<label class="wc-q__field"><span>Phone</span><input data-key="phone" type="tel" required /></label>' +
      '<label class="wc-q__field"><span>Email</span><input data-key="email" type="email" required /></label>' +
      '<label class="wc-q__field"><span>ZIP code</span><input data-key="zip" type="text" /></label>' +
      '<label class="wc-q__field"><span>Timeline</span><select data-key="timeline"><option>As soon as possible</option><option>Within a few weeks</option><option>Just planning / budgeting</option></select></label>' +
      '</div></div>');
    var submit = el('<button class="wc-btn wc-btn--accent wc-btn--lg wc-btn--block" type="button">' + (state.mode === 'instant' ? 'See my estimate' : 'Send my request') + '</button>');
    submit.onclick = function () {
      wrap.querySelectorAll('[data-key]').forEach(function (i) { state.values[i.getAttribute('data-key')] = i.value; });
      if (!state.values.name || !state.values.phone || !state.values.email) { alert('Please add your name, phone, and email.'); return; }
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
      ZIP: v.zip || '', Timeline: v.timeline || ''
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
    // Preview / demo mode: no endpoint configured -> show the success UI but send
    // nothing (lets a prospect test the flow without wiring/activating a form).
    if (!cfg.ajax) { done(); return; }
    fetch(cfg.ajax, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
      .then(function () { done(); }).catch(function () { done(); });
  }

  function renderResult() {
    var s = state.svc, v = state.values;
    var inner;
    if (state.mode === 'instant') {
      var r = computeRange(s);
      inner = '<p class="wc-kicker">Your estimate</p>' +
        '<div class="wc-q__range">' + money(r.low) + ' – ' + money(r.high) + '</div>' +
        '<p class="wc-q__sub">for ' + s.name.toLowerCase() + '. ' + disclaimer + '</p>' +
        '<p class="wc-q__sent">Our team has received your instant quote request — expect a call or text shortly to confirm and book a free measurement.</p>';
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
