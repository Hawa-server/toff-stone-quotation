/* Toff Stone Quotation: all the app's logic.
   - Keeps the quotation being typed ("st") and the company details ("biz") in localStorage, so nothing is lost
     if the app is closed.
   - Works out every amount in pesewas (whole numbers), so totals never pick up rounding errors.
   - Draws the item cards, the summary, the printable quotation sheet and the saved-quotations list. */
(function () {
  'use strict';

  /* ---------- storage ---------- */
  var KEY = 'tsq.current', BIZ = 'tsq.biz', CNT = 'tsq.counter', SAVED = 'tsq.saved';
  // Why try/catch: storage can be blocked (private mode, full disk); the app must still work, just without saving.
  function load(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  /* ---------- new blank records ---------- */
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var uid = 0;
  function newId() { uid += 1; return 'k' + Date.now().toString(36) + uid; }
  // A glass item is one kind of glass (e.g. 10mm clear). It goes to one or more places (Bathroom, Kitchen…),
  // and each place has one or more sizes, each with its own quantity and price.
  function blankSize() { return { id: newId(), w: '', h: '', qty: '1', rate: '' }; }
  function blankPlace() { return { id: newId(), ref: '', sizes: [blankSize()] }; }
  function blankItem() { return { id: newId(), desc: '', unit: 'mm', places: [blankPlace()] }; }
  function blankAcc() { return { id: newId(), code: '', desc: '', qty: '1', per: 'pcs', rate: '' }; }
  // The reference number comes from a counter that only goes up, so two quotations never share a number.
  function refNo() { var n = load(CNT) || 1; return 'Q/' + String(n).padStart(4, '0') + '-' + String(new Date().getFullYear()).slice(2); }
  var DEFAULT_TERMS = '1. Work begins only after the client confirms the order and the measurements.\n2. This quotation covers only the glass, accessories and work listed.\n3. The shade of glass may differ slightly from one batch to another.\n4. Measurements are checked on site before cutting.';
  function blankState() {
    return { no: refNo(), date: today(), valid: '7', client: { name: '', phone: '', email: '' },
      items: [blankItem()], accs: [], labour: '', disc: '', discType: 'pct', deposit: '' };
  }

  var DEFAULT_NAME = 'Toff Stone Ventures', OLD_NAME = 'Toff Stone Glass and Aluminium', DEFAULT_LOGO = 'icons/logo.png';
  var biz = Object.assign({ name: DEFAULT_NAME, phone: '', wa: '', email: '', location: '', logo: '', terms: DEFAULT_TERMS }, load(BIZ) || {});
  // The company name is filled in from the start; a blank one saved earlier falls back to it too.
  if (!biz.name || biz.name === OLD_NAME) biz.name = DEFAULT_NAME;
  // Older quotations are brought up to date: the first version kept one size per glass item (same glass and unit
  // are merged), the next kept a list of sizes each with its own place. Sizes for the same place are grouped.
  function addToPlace(g, ref, z) {
    var pl = g.places.find(function (x) { return x.ref === ref; });
    if (!pl) { pl = { id: newId(), ref: ref, sizes: [] }; g.places.push(pl); }
    pl.sizes.push({ id: newId(), w: z.w || '', h: z.h || '', qty: z.qty || '1', rate: z.rate || '' });
  }
  function fixGlass(s) {
    var out = [];
    (s.items || []).forEach(function (it) {
      if (it.places) { out.push(it); return; }
      var desc = it.desc || '', unit = it.unit || 'mm', g;
      if (it.sizes) {
        g = { id: it.id || newId(), desc: desc, unit: unit, places: [] }; out.push(g);
        it.sizes.forEach(function (z) { addToPlace(g, z.ref || '', z); });
        return;
      }
      g = out.find(function (x) { return x.desc === desc && x.unit === unit; });
      if (!g) { g = { id: it.id || newId(), desc: desc, unit: unit, places: [] }; out.push(g); }
      addToPlace(g, it.ref || '', it);
    });
    out.forEach(function (g) {
      if (!g.places.length) g.places.push(blankPlace());
      g.places.forEach(function (pl) { if (!pl.sizes.length) pl.sizes.push(blankSize()); });
    });
    s.items = out.length ? out : [blankItem()];
    return s;
  }
  var st = fixGlass(load(KEY) || blankState());
  if (!st.accs) st.accs = [];
  var view = 'edit';
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- money and measurements ---------- */
  // Typed amounts become pesewas (GH₵ 1.50 -> 150). Blank or invalid -> 0.
  function pes(v) { var n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) && n > 0 ? Math.round(n * 100) : 0; }
  function money(p) { var neg = p < 0; p = Math.abs(Math.round(p)); return (neg ? '− ' : '') + Math.floor(p / 100).toLocaleString('en-GH') + '.' + String(p % 100).padStart(2, '0'); }
  function cedi(p) { return 'GH₵ ' + money(p); }
  function r2(x) { return Math.round(x * 100) / 100; }
  function qty(o) { var q = parseFloat(o.qty); return q > 0 ? q : 0; }
  // Each glass size is priced from the owner's own estimate: price each × quantity. Sizes are for the client's information only.
  function sizeTotal(z) { return Math.round(pes(z.rate) * qty(z)); }
  function placeTotal(pl) { return sum(pl.sizes, sizeTotal); }
  function itemTotal(g) { return sum(g.places, placeTotal); }
  function usedSizes(pl) { return pl.sizes.filter(function (z) { return parseFloat(z.w) || parseFloat(z.h) || pes(z.rate); }); }
  function usedPlaces(g) { return g.places.filter(function (pl) { return pl.ref || usedSizes(pl).length; }); }
  function lineTotal(o) { return Math.round(pes(o.rate) * qty(o)); }
  function fmtN(x) { return r2(x).toLocaleString('en-GH', { maximumFractionDigits: 2 }); }
  function calcLine(z) { return pes(z.rate) ? fmtN(qty(z)) + ' × ' + cedi(pes(z.rate)) : ''; }
  function size(z, unit) { return parseFloat(z.w) && parseFloat(z.h) ? z.w + ' × ' + z.h + ' ' + unit : ''; }
  function sum(list, fn) { return list.reduce(function (s, x) { return s + fn(x); }, 0); }
  // Every total on screen, on the sheet and in WhatsApp comes from this one function.
  function totals() {
    var glass = sum(st.items, itemTotal), acc = sum(st.accs, lineTotal);
    var gross = glass + acc + pes(st.labour);
    var d = st.discType === 'pct' ? Math.round(gross * Math.min(100, parseFloat(st.disc) || 0) / 100) : Math.min(gross, pes(st.disc));
    var total = gross - d;
    return { glass: glass, acc: acc, gross: gross, disc: d, total: total, balance: total - pes(st.deposit) };
  }
  function discLabel() { return st.discType === 'pct' && parseFloat(st.disc) > 0 ? 'Discount (' + fmtN(parseFloat(st.disc)) + '%)' : 'Discount'; }
  function niceDate(s) { var d = new Date(s + 'T00:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  // Anything typed by the user is escaped before it goes into HTML, so a "<" in a name can't break the page.
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hasContent(s) { return !!(s.client.name || s.client.phone || s.items.some(function (g) { return g.desc || itemTotal(g); }) || s.accs.length); }

  /* ---------- glass: one card holding every glass item; each glass has places, each place has sizes ---------- */
  // Only structural changes (adding or removing a glass, place or size) redraw the card; typing just repaints amounts,
  // so the keyboard never loses focus.
  var UNITS = [['mm', 'mm'], ['cm', 'cm'], ['in', 'inches'], ['ft', 'feet']];
  function sizeRow(pl, z, j) {
    var p = 'g-' + z.id + '-';
    return '<div class="size" data-zid="' + z.id + '">' +
      '<label class="z-w" for="' + p + 'w"><span class="lbl">Width</span><input id="' + p + 'w" data-f="w" inputmode="decimal" placeholder="750"></label>' +
      '<label class="z-h" for="' + p + 'h"><span class="lbl">Height</span><input id="' + p + 'h" data-f="h" inputmode="decimal" placeholder="2100"></label>' +
      '<label class="z-qty" for="' + p + 'qty"><span class="lbl">Qty</span><input id="' + p + 'qty" data-f="qty" type="number" inputmode="numeric" min="1" step="1"></label>' +
      '<label class="z-rate" for="' + p + 'rate"><span class="lbl">Price each (GH₵)</span><input id="' + p + 'rate" data-f="rate" inputmode="decimal" placeholder="0.00"></label>' +
      '<span class="z-amt num" data-zamt></span>' +
      (pl.sizes.length > 1 ? '<button type="button" class="x-btn z-del" data-act="del-size" aria-label="Remove size ' + (j + 1) + '">×</button>' : '') +
      '</div>';
  }
  function placeBlock(g, pl, k) {
    var p = 'g-' + pl.id + '-';
    return '<div class="place" data-pid="' + pl.id + '">' +
      '<div class="p-head"><label for="' + p + 'ref">Where it goes<input id="' + p + 'ref" data-f="ref" placeholder="Bathroom"></label>' +
      (g.places.length > 1 ? '<button type="button" class="x-btn" data-act="del-place" aria-label="Remove place ' + (k + 1) + '">×</button>' : '') + '</div>' +
      '<div class="sizes">' + pl.sizes.map(function (z, j) { return sizeRow(pl, z, j); }).join('') + '</div>' +
      '<div class="p-foot"><button type="button" class="btn add-size" data-act="add-size">+ Add size</button><span class="g-sub" data-psub></span></div>' +
      '</div>';
  }
  function glassBlock(g, i) {
    var p = 'g-' + g.id + '-';
    return '<div class="glass" data-id="' + g.id + '">' +
      '<div class="card-head"><span class="tag"><b class="num">' + (i + 1) + '</b>Glass ' + (i + 1) + '</span>' +
      (st.items.length > 1 ? '<button type="button" class="btn danger" data-act="del-glass" aria-label="Remove glass ' + (i + 1) + '">Remove</button>' : '') + '</div>' +
      '<div class="g-top"><label for="' + p + 'desc">Description<input id="' + p + 'desc" data-f="desc" placeholder="10mm clear tempered glass"></label>' +
      '<label for="' + p + 'unit">Size unit<select id="' + p + 'unit" data-f="unit">' +
      UNITS.map(function (u) { return '<option value="' + u[0] + '">' + u[1] + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="places">' + g.places.map(function (pl, k) { return placeBlock(g, pl, k); }).join('') + '</div>' +
      '<div class="g-foot"><button type="button" class="btn add-size" data-act="add-place">+ Add where it goes</button><span class="g-sub" data-gsub></span></div>' +
      '</div>';
  }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function paintGlass(el, g) {
    g.places.forEach(function (pl) {
      var pel = el.querySelector('.place[data-pid="' + pl.id + '"]');
      pl.sizes.forEach(function (z) {
        pel.querySelector('.size[data-zid="' + z.id + '"] [data-zamt]').textContent = pes(z.rate) ? cedi(sizeTotal(z)) : '—';
      });
      pel.querySelector('[data-psub]').textContent = (pl.ref || 'This place') + ' · ' + cedi(placeTotal(pl));
    });
    el.querySelector('[data-gsub]').textContent = plural(usedPlaces(g).length, 'place') + ' · ' + plural(sum(g.places, function (pl) { return usedSizes(pl).length; }), 'size') + ' · ' + cedi(itemTotal(g));
  }
  function renderGlass(focusId) {
    var box = $('items');
    box.innerHTML = st.items.map(glassBlock).join('');
    st.items.forEach(function (g) {
      var el = box.querySelector('.glass[data-id="' + g.id + '"]');
      el.querySelector('[data-f="desc"]').value = g.desc; el.querySelector('[data-f="unit"]').value = g.unit;
      g.places.forEach(function (pl) {
        var pel = el.querySelector('.place[data-pid="' + pl.id + '"]');
        pel.querySelector('[data-f="ref"]').value = pl.ref;
        pl.sizes.forEach(function (z) {
          pel.querySelectorAll('.size[data-zid="' + z.id + '"] [data-f]').forEach(function (inp) { inp.value = z[inp.dataset.f] || ''; });
        });
      });
      paintGlass(el, g);
    });
    if (focusId) { var f = $(focusId); f.focus(); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }
  // Works out which glass, place and size a field or button belongs to.
  function locate(node) {
    var el = node.closest('.glass'), pel = node.closest('.place'), zel = node.closest('.size');
    var g = st.items.find(function (x) { return x.id === el.dataset.id; });
    var pl = pel && g.places.find(function (x) { return x.id === pel.dataset.pid; });
    var z = zel && pl.sizes.find(function (x) { return x.id === zel.dataset.zid; });
    return { el: el, g: g, pl: pl, z: z };
  }
  function updGlass(e) {
    var f = e.target.dataset.f; if (!f) return;
    var o = locate(e.target);
    (o.z || o.pl || o.g)[f] = e.target.value;
    paintGlass(o.el, o.g); refresh();
  }
  $('items').addEventListener('input', updGlass);
  $('items').addEventListener('change', updGlass);
  $('items').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var o = locate(b), act = b.dataset.act;
    if (act === 'add-size') {
      var z = blankSize(); o.pl.sizes.push(z);
      renderGlass('g-' + z.id + '-w'); $('live').textContent = 'Size ' + o.pl.sizes.length + ' added.';
    } else if (act === 'del-size') {
      o.pl.sizes = o.pl.sizes.filter(function (x) { return x !== o.z; });
      renderGlass(); $('live').textContent = 'Size removed.';
    } else if (act === 'add-place') {
      var pl = blankPlace(); o.g.places.push(pl);
      renderGlass('g-' + pl.id + '-ref'); $('live').textContent = 'Place ' + o.g.places.length + ' added.';
    } else if (act === 'del-place') {
      o.g.places = o.g.places.filter(function (x) { return x !== o.pl; });
      renderGlass(); $('live').textContent = 'Place removed.';
    } else if (act === 'del-glass') {
      st.items = st.items.filter(function (x) { return x !== o.g; });
      renderGlass(); $('live').textContent = 'Glass removed.';
    }
    refresh();
  });
  // A new glass keeps the unit of the one before, because a job is usually measured in one unit.
  $('addItem').addEventListener('click', function () {
    var prev = st.items[st.items.length - 1], g = blankItem();
    if (prev) g.unit = prev.unit;
    st.items.push(g); renderGlass('g-' + g.id + '-desc'); refresh();
    $('live').textContent = 'Glass ' + st.items.length + ' added.';
  });

  /* ---------- accessory cards ---------- */
  // Accessories are drawn as cards. Only the card being typed in is repainted, so the keyboard never loses focus.
  var LISTS = {
    accs: {
      box: 'accs', label: 'Accessory', make: blankAcc, removable: function () { return true; },
      html: function (o, i, p) {
        return '<label for="' + p + 'desc">Description<input id="' + p + 'desc" data-f="desc" placeholder="Glass hinge 180°"></label>' +
          '<label for="' + p + 'code">Code (optional)<input id="' + p + 'code" data-f="code" placeholder="BL 305"></label>' +
          '<div class="grid3"><label for="' + p + 'qty">Qty<input id="' + p + 'qty" data-f="qty" type="number" inputmode="numeric" min="1" step="1"></label>' +
          '<label for="' + p + 'per">Per<select id="' + p + 'per" data-f="per"><option value="pcs">pcs</option><option value="prs">pairs</option><option value="lgth">length</option><option value="set">set</option><option value="m">metre</option></select></label>' +
          '<label for="' + p + 'rate">Rate (GH₵)<input id="' + p + 'rate" data-f="rate" inputmode="decimal" placeholder="0.00"></label></div>';
      },
      paint: function (el, o) {
        el.querySelector('[data-calc]').textContent = pes(o.rate) ? fmtN(qty(o)) + ' ' + o.per + ' × ' + cedi(pes(o.rate)) : 'Enter the rate';
        el.querySelector('[data-amt]').textContent = cedi(lineTotal(o));
      }
    }
  };

  function makeCard(listName, o, i, isNew) {
    var L = LISTS[listName], el = document.createElement('article'), p = listName + '-' + o.id + '-';
    el.className = 'card' + (isNew ? ' new' : ''); el.dataset.id = o.id;
    el.innerHTML = '<div class="card-head"><span class="tag"><b class="num">' + (i + 1) + '</b>' + L.label + ' ' + (i + 1) + '</span>' +
      (L.removable() ? '<button type="button" class="btn danger" data-act="remove" aria-label="Remove ' + L.label.toLowerCase() + ' ' + (i + 1) + '">Remove</button>' : '') + '</div>' +
      L.html(o, i, p) + '<div class="line-total"><span class="calc" data-calc></span><span class="amt num" data-amt></span></div>';
    el.querySelectorAll('[data-f]').forEach(function (inp) { inp.value = o[inp.dataset.f] || ''; });
    L.paint(el, o);
    return el;
  }
  function renderList(listName, newId) {
    var box = $(LISTS[listName].box); box.innerHTML = '';
    st[listName].forEach(function (o, i) { box.appendChild(makeCard(listName, o, i, o.id === newId)); });
    if (listName === 'accs') $('noAcc').hidden = st.accs.length > 0;
  }
  function renderAllLists() { renderGlass(); renderList('accs'); }

  // One set of event handlers per list, listening on the list's container (cards come and go).
  Object.keys(LISTS).forEach(function (listName) {
    var L = LISTS[listName], box = $(L.box);
    function find(card) { return st[listName].find(function (x) { return x.id === card.dataset.id; }); }
    function upd(e) {
      var f = e.target.dataset.f; if (!f) return;
      var card = e.target.closest('.card'), o = find(card);
      o[f] = e.target.value; L.paint(card, o); refresh();
    }
    box.addEventListener('input', upd);
    box.addEventListener('change', upd);
    box.addEventListener('click', function (e) {
      var card = e.target.closest('.card'); if (!card) return;
      var o = find(card);
      if (e.target.closest('[data-act="remove"]')) {
        st[listName] = st[listName].filter(function (x) { return x.id !== o.id; });
        renderList(listName); refresh(); $('live').textContent = L.label + ' removed.';
      }
    });
  });
  // The "+ Add accessory" button: a new empty card, focused and scrolled into view.
  function addTo(listName) {
    var o = LISTS[listName].make();
    st[listName].push(o); renderList(listName, o.id); refresh();
    $('live').textContent = LISTS[listName].label + ' ' + st[listName].length + ' added.';
    var inp = $(listName + '-' + o.id + '-desc'); inp.focus(); inp.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  $('addAcc').addEventListener('click', function () { addTo('accs'); });

  /* ---------- summary ---------- */
  function renderSummary() {
    var t = totals(), rows = [['Glass', t.glass]];
    if (t.acc) rows.push(['Accessories', t.acc]);
    if (pes(st.labour)) rows.push(['Labour / fitting', pes(st.labour)]);
    if (t.disc) rows.push([discLabel(), -t.disc]);
    var h = rows.map(function (r) { return '<div class="sum-row"><span>' + r[0] + '</span><span class="num">' + cedi(r[1]) + '</span></div>'; }).join('');
    h += '<div class="sum-row total"><span>Total cost</span><span class="num">' + cedi(t.total) + '</span></div>';
    if (pes(st.deposit)) h += '<div class="sum-row"><span>Deposit paid</span><span class="num">' + cedi(-pes(st.deposit)) + '</span></div><div class="sum-row bal"><span>Balance to pay</span><span class="num">' + cedi(t.balance) + '</span></div>';
    $('summary').innerHTML = h;
  }

  /* ---------- WhatsApp text ---------- */
  // Ghana numbers typed as 024… become 23324… for WhatsApp links.
  function waNumber() { var d = (st.client.phone || '').replace(/\D/g, ''); if (!d) return ''; if (d.indexOf('233') === 0) return d; if (d[0] === '0') return '233' + d.slice(1); if (d.length === 9) return '233' + d; return d; }
  function filled(list, fn) { return list.filter(function (o) { return o.desc || fn(o); }); }
  function asText() {
    var t = totals(), L = [];
    L.push('*' + (biz.name || 'QUOTATION').toUpperCase() + '*');
    var c = [biz.phone && ('Tel: ' + biz.phone), biz.wa && ('WhatsApp: ' + biz.wa), biz.email].filter(Boolean).join(' · '); if (c) L.push(c);
    L.push(''); L.push('*QUOTATION* Ref ' + st.no + ' · ' + niceDate(st.date));
    if (st.client.name) L.push('Client: ' + st.client.name + (st.client.phone ? ' · ' + st.client.phone : ''));
    var g = filled(st.items, itemTotal);
    if (g.length) {
      L.push(''); L.push('*Glass*');
      g.forEach(function (gl, i) {
        L.push((i + 1) + '. ' + (gl.desc || 'Glass'));
        usedPlaces(gl).forEach(function (pl) {
          if (pl.ref) L.push('   _' + pl.ref + '_');
          usedSizes(pl).forEach(function (z) { L.push('   • ' + [size(z, gl.unit), calcLine(z)].filter(Boolean).join(' · ') + ' = ' + cedi(sizeTotal(z))); });
        });
      });
    }
    var a = filled(st.accs, lineTotal);
    if (a.length) { L.push(''); L.push('*Accessories*'); a.forEach(function (o, i) { L.push((i + 1) + '. ' + (o.desc || 'Accessory') + (o.code ? ' [' + o.code + ']' : '') + ': ' + fmtN(qty(o)) + ' ' + o.per + ' × ' + cedi(pes(o.rate)) + ' = ' + cedi(lineTotal(o))); }); }
    L.push('');
    if (pes(st.labour)) L.push('Labour / fitting: ' + cedi(pes(st.labour)));
    if (t.disc) { L.push('Total before discount: ' + cedi(t.gross)); L.push(discLabel() + ': ' + cedi(-t.disc)); }
    L.push('*TOTAL COST: ' + cedi(t.total) + '*');
    if (pes(st.deposit)) { L.push('Deposit paid: ' + cedi(pes(st.deposit))); L.push('*Balance: ' + cedi(t.balance) + '*'); }
    if (parseInt(st.valid, 10) > 0) { L.push(''); L.push('This quotation is valid for ' + parseInt(st.valid, 10) + ' days.'); }
    return L.join('\n');
  }
  function updateWa() { $('waBtn').href = 'https://wa.me/' + waNumber() + '?text=' + encodeURIComponent(asText()); }

  /* ---------- the quotation as a picture (for WhatsApp) ---------- */
  // The sheet is drawn into a PNG inside the browser (HTML in an SVG, painted on a canvas), so it works offline
  // with no library. Pictures show straight in the WhatsApp chat, unlike text or a PDF.
  function toDataUrl(url) {
    if (/^data:/.test(url)) return Promise.resolve(url);
    return fetch(url).then(function (r) { return r.blob(); }).then(function (b) {
      return new Promise(function (ok) { var rd = new FileReader(); rd.onload = function () { ok(rd.result); }; rd.readAsDataURL(b); });
    });
  }
  var cssText = null;
  function sheetPng() {
    renderSheet();
    return Promise.all([cssText || fetch('styles.css').then(function (r) { return r.text(); }), toDataUrl(biz.logo || DEFAULT_LOGO)]).then(function (res) {
      cssText = res[0];
      // Measure a full-size copy off screen (the real sheet may be hidden or shrunk to fit a phone).
      var s = $('sheet').cloneNode(true), box = document.createElement('div');
      s.removeAttribute('id'); s.style.transform = 'none';
      var logo = s.querySelector('.s-logo'); if (logo) logo.src = res[1];
      box.style.cssText = 'position:absolute;left:-10000px;top:0;width:700px';
      box.appendChild(s); document.body.appendChild(box);
      var w = 700, h = Math.ceil(s.offsetHeight);
      document.body.removeChild(box);
      var page = document.createElement('div'), css = document.createElement('style');
      css.textContent = res[0]; page.appendChild(css); page.appendChild(s);
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><foreignObject width="100%" height="100%">' +
        new XMLSerializer().serializeToString(page) + '</foreignObject></svg>';
      return new Promise(function (ok, fail) {
        var im = new Image();
        im.onload = function () {
          var k = 2, c = document.createElement('canvas'), g = c.getContext('2d'); // 2× so it stays sharp when zoomed in
          c.width = w * k; c.height = h * k;
          g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c.width, c.height); g.scale(k, k); g.drawImage(im, 0, 0);
          c.toBlob(function (b) { if (b) ok(b); else fail(new Error('No picture')); }, 'image/png');
        };
        im.onerror = fail;
        im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      });
    });
  }
  function picName() { return 'Quotation ' + st.no.replace(/\//g, '-') + (st.client.name ? ' ' + st.client.name : '') + '.png'; }
  function caption() {
    var t = totals();
    return 'Quotation ' + st.no + ' from ' + (biz.name || DEFAULT_NAME) + '. Total cost: ' + cedi(t.total) + (pes(st.deposit) ? ', balance to pay: ' + cedi(t.balance) : '') + '.';
  }
  function downloadPic(b) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = picName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }
  // Phones (and Windows/Mac Chrome) can hand the picture to WhatsApp through the share menu. Where that isn't
  // possible, the picture is saved and the client's chat is offered, to attach it there.
  $('waBtn').addEventListener('click', function (e) {
    var btn = this, label = btn.textContent;
    e.preventDefault(); btn.textContent = 'Preparing…'; $('waMsg').hidden = true;
    sheetPng().then(function (b) {
      var f = new File([b], picName(), { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        return navigator.share({ files: [f], text: caption() }).catch(function (err) { if (err.name !== 'AbortError') fallback(b); });
      }
      fallback(b);
    }, function () { window.open(btn.href, '_blank', 'noopener'); }).finally(function () { btn.textContent = label; });
    function fallback(b) {
      downloadPic(b);
      $('waMsg').innerHTML = 'The quotation picture has been saved to Downloads. <a href="' + esc(btn.href) + '" target="_blank" rel="noopener">Open the WhatsApp chat</a> and attach it.';
      $('waMsg').hidden = false;
    }
  });
  $('picBtn').addEventListener('click', function () {
    var btn = this; btn.disabled = true;
    sheetPng().then(downloadPic, function () { $('copyMsg').textContent = 'Could not make the picture. Use Print / Save PDF instead.'; }).finally(function () { btn.disabled = false; });
  });

  /* ---------- the quotation sheet ---------- */
  function renderSheet() {
    var t = totals();
    var head = '<div class="s-head"><div>' + '<img class="s-logo" src="' + (biz.logo || DEFAULT_LOGO) + '" alt="">' + '</div>' +
      '<div class="s-co"><strong>' + esc(biz.name || 'Your company name') + '</strong><br>' +
      [biz.phone && ('Telephone no: ' + esc(biz.phone)), biz.email && ('Email: ' + esc(biz.email)), biz.wa && ('WhatsApp: ' + esc(biz.wa)), biz.location && esc(biz.location)].filter(Boolean).join('<br>') + '</div></div>';
    var client = '<div class="s-client"><div><div><span class="k">NAME OF CLIENT:</span> <span class="v">' + esc(st.client.name) + '</span></div><div><span class="k">TEL:</span> <span class="v">' + esc(st.client.phone) + '</span></div><div><span class="k">EMAIL:</span> ' + esc(st.client.email) + '</div></div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end"><div><b>DATE :</b> ' + esc(niceDate(st.date)) + '</div><div class="s-ref">REF : ' + esc(st.no) + '</div></div></div>';

    var gl = filled(st.items, itemTotal);
    var units = Array.from(new Set(gl.map(function (i) { return i.unit; }))), uh = units.length === 1 ? ' ' + units[0] : '';
    // One group of rows per glass: the description is written once beside all of its sizes, and each place
    // (client's ref) once beside its own sizes.
    var gbodies = gl.map(function (g) {
      var rows = [];
      usedPlaces(g).forEach(function (pl) {
        var zs = usedSizes(pl); if (!zs.length) zs = [blankSize()];
        zs.forEach(function (z, j) { rows.push({ pl: pl, z: z, first: j === 0, span: zs.length }); });
      });
      if (!rows.length) rows.push({ pl: blankPlace(), z: blankSize(), first: true, span: 1 });
      return '<tbody>' + rows.map(function (r, i) {
        var z = r.z;
        return '<tr>' + (i ? '' : '<td rowspan="' + rows.length + '"><span class="desc">' + esc(g.desc || 'Glass') + '</span></td>') +
          (r.first ? '<td rowspan="' + r.span + '">' + esc(r.pl.ref) + '</td>' : '') + '<td class="c">' + esc(parseFloat(z.w) ? z.w : '') + '</td><td class="c">' + esc(parseFloat(z.h) ? z.h : '') + '</td><td class="c">' + fmtN(qty(z)) +
          '</td><td class="r">' + money(pes(z.rate)) + '</td><td class="r">' + money(sizeTotal(z)) + '</td></tr>';
      }).join('') + '</tbody>';
    }).join('');
    var glassT = '<div class="s-title">QUOTATION</div><table class="s-glass"><thead><tr><th>Description</th><th style="width:14%">Client\'s ref</th><th class="c" style="width:9%">Width (W)' + uh + '</th><th class="c" style="width:9%">Height (H)' + uh + '</th><th class="c" style="width:7%">Qty</th><th class="r" style="width:13%">Price each</th><th class="r" style="width:14%">Amount</th></tr></thead>' +
      (gbodies || '<tbody><tr><td colspan="7">&nbsp;</td></tr></tbody>') + '</table><div class="s-tot"><div><span>Sub total (glass)</span><span>' + money(t.glass) + '</span></div></div>';

    var ac = filled(st.accs, lineTotal);
    var accT = ac.length ? '<div class="s-sec">ACCESSORIES</div><table><thead><tr><th style="width:16%">Code</th><th>Description</th><th class="c" style="width:7%">Qty</th><th style="width:8%">Per</th><th class="r" style="width:12%">Rate</th><th class="r" style="width:13%">Amount</th></tr></thead><tbody>' +
      ac.map(function (o) { return '<tr><td>' + esc(o.code) + '</td><td><span class="desc">' + esc(o.desc || 'Accessory') + '</span></td><td class="c">' + fmtN(qty(o)) + '</td><td>' + esc(o.per.toUpperCase()) + '</td><td class="r">' + money(pes(o.rate)) + '</td><td class="r">' + money(lineTotal(o)) + '</td></tr>'; }).join('') +
      '</tbody></table><div class="s-tot"><div><span>Sub total (accessories)</span><span>' + money(t.acc) + '</span></div></div>' : '';

    var g = '<div class="s-grand">';
    if (pes(st.labour)) g += '<div><span>Labour / fitting</span><span>' + money(pes(st.labour)) + '</span></div>';
    if (t.disc) g += '<div><span>Grand total exc disc GH₵:</span><span>' + money(t.gross) + '</span></div><div><span>' + esc(discLabel()) + '</span><span>' + money(t.disc) + '</span></div>';
    g += '<div class="big"><span>Total cost GH₵:</span><span>' + money(t.total) + '</span></div>';
    if (pes(st.deposit)) g += '<div><span>Deposit paid</span><span>' + money(pes(st.deposit)) + '</span></div><div><span>Balance to pay GH₵:</span><span>' + money(t.balance) + '</span></div>';
    g += '</div>';
    var v = parseInt(st.valid, 10) > 0 ? '<div class="s-valid">This quotation is valid for ' + parseInt(st.valid, 10) + ' days</div>' : '';
    var terms = biz.terms ? '<div class="s-terms"><strong>TERMS &amp; CONDITIONS</strong>' + esc(biz.terms) + '</div>' : '';
    $('sheet').innerHTML = head + client + glassT + accT + g + v + terms;
    fitSheet();
  }
  // The sheet is designed 700px wide (like a page). On a phone it is shrunk to fit the screen,
  // so one screenshot shows the whole quotation.
  function fitSheet() {
    if (view !== 'sheet') return;
    var f = $('frame'), s = $('sheet'), k = Math.min(1, f.clientWidth / 700);
    s.style.transform = 'scale(' + k + ')'; f.style.height = Math.ceil(s.offsetHeight * k) + 'px';
  }
  window.addEventListener('resize', fitSheet);

  /* ---------- saved quotations ---------- */
  function savedList() { return load(SAVED) || []; }
  function isSaved() { var e = savedList().find(function (x) { return x.no === st.no; }); return !!e && JSON.stringify(e.data) === JSON.stringify(st); }
  function saveQuote() {
    var list = savedList().filter(function (x) { return x.no !== st.no; });
    list.unshift({ no: st.no, savedAt: new Date().toISOString(), client: st.client.name, date: st.date, total: totals().total, data: JSON.parse(JSON.stringify(st)) });
    if (save(SAVED, list)) { $('live').textContent = 'Quotation ' + st.no + ' saved.'; }
    else { $('live').textContent = 'Could not save: this device is out of storage.'; }
    refresh();
  }
  $('saveBtn').addEventListener('click', saveQuote);
  var pendingDelete = null;
  function renderSaved() {
    var q = ($('savedSearch').value || '').trim().toLowerCase();
    var list = savedList().filter(function (x) { return !q || (x.client || '').toLowerCase().indexOf(q) >= 0 || x.no.toLowerCase().indexOf(q) >= 0; });
    if (!list.length) { $('savedList').innerHTML = '<div class="empty">' + (q ? 'No saved quotation matches that search.' : 'No saved quotations yet. Tap Save quotation on the form to keep one here.') + '</div>'; return; }
    $('savedList').innerHTML = list.map(function (x) {
      var del = pendingDelete === x.no;
      return '<div class="saved-item"><div class="who">' + esc(x.client || 'No client name') + '</div><div class="amt num">' + cedi(x.total) + '</div>' +
        '<div class="meta">' + esc(x.no) + ' · ' + esc(niceDate(x.date)) + '</div><div></div>' +
        '<div class="row"><button type="button" class="btn danger" data-del="' + esc(x.no) + '">' + (del ? 'Tap again to delete' : 'Delete') + '</button><button type="button" class="btn small primary" data-open="' + esc(x.no) + '">Open</button></div></div>';
    }).join('');
  }
  $('savedSearch').addEventListener('input', renderSaved);
  $('savedList').addEventListener('click', function (e) {
    var o = e.target.closest('[data-open]'), d = e.target.closest('[data-del]');
    if (o) {
      var x = savedList().find(function (s) { return s.no === o.dataset.open; });
      if (x) { st = fixGlass(JSON.parse(JSON.stringify(x.data))); fillFixed(); renderAllLists(); setView('edit'); refresh(); }
    } else if (d) {
      // Deleting needs two taps, so one slip of the finger never loses a quotation.
      if (pendingDelete === d.dataset.del) { save(SAVED, savedList().filter(function (s) { return s.no !== d.dataset.del; })); pendingDelete = null; }
      else { pendingDelete = d.dataset.del; setTimeout(function () { pendingDelete = null; if (view === 'saved') renderSaved(); }, 4000); }
      renderSaved(); refresh();
    }
  });

  /* ---------- views ---------- */
  function setView(v) {
    view = v;
    $('editView').hidden = v !== 'edit'; $('sheetView').hidden = v !== 'sheet'; $('savedView').hidden = v !== 'saved';
    $('actions').hidden = v === 'saved';
    $('viewTitle').textContent = v === 'saved' ? 'Saved quotations' : 'Quotation';
    $('viewBtn').textContent = v === 'sheet' ? 'Back to edit' : 'View quotation';
    $('savedBtn').textContent = v === 'saved' ? 'Back' : 'Saved';
    if (v === 'sheet') renderSheet();
    if (v === 'saved') renderSaved();
    window.scrollTo(0, 0);
  }
  $('viewBtn').addEventListener('click', function () { setView(view === 'sheet' ? 'edit' : 'sheet'); });
  $('savedBtn').addEventListener('click', function () { setView(view === 'saved' ? 'edit' : 'saved'); });
  $('printBtn').addEventListener('click', function () { window.print(); });

  /* ---------- new quotation ---------- */
  $('newBtn').addEventListener('click', function () { $('confirmNew').hidden = false; $('doNew').focus(); });
  $('cancelNew').addEventListener('click', function () { $('confirmNew').hidden = true; });
  $('doNew').addEventListener('click', function () {
    // Move the counter on only if this quotation was actually used, so empty ones don't waste numbers.
    if (hasContent(st)) save(CNT, (load(CNT) || 1) + 1);
    st = blankState(); fillFixed(); renderAllLists(); setView('edit'); refresh();
    $('confirmNew').hidden = true; $('cName').focus();
  });

  /* ---------- company and simple fields ---------- */
  // The Toff Stone logo is built in; an uploaded picture replaces it until it is removed.
  function paintLogo() { $('logoPrev').innerHTML = '<img src="' + (biz.logo || DEFAULT_LOGO) + '" alt="Your logo">'; $('logoRemove').hidden = !biz.logo; }
  function fillFixed() {
    $('bizName').value = biz.name; $('bizPhone').value = biz.phone; $('bizWa').value = biz.wa; $('bizEmail').value = biz.email; $('bizLoc').value = biz.location; $('terms').value = biz.terms;
    $('cName').value = st.client.name; $('cPhone').value = st.client.phone; $('cEmail').value = st.client.email || ''; $('estDate').value = st.date; $('validDays').value = st.valid;
    ['labour', 'disc', 'deposit'].forEach(function (k) { $(k).value = st[k] || ''; });
    $('discType').value = st.discType || 'pct'; paintLogo();
  }
  [['bizName', function (v) { biz.name = v; }], ['bizPhone', function (v) { biz.phone = v; }], ['bizWa', function (v) { biz.wa = v; }], ['bizEmail', function (v) { biz.email = v; }], ['bizLoc', function (v) { biz.location = v; }], ['terms', function (v) { biz.terms = v; }],
   ['cName', function (v) { st.client.name = v; }], ['cPhone', function (v) { st.client.phone = v; }], ['cEmail', function (v) { st.client.email = v; }], ['estDate', function (v) { st.date = v; }], ['validDays', function (v) { st.valid = v; }],
   ['labour', function (v) { st.labour = v; }],['disc', function (v) { st.disc = v; }], ['deposit', function (v) { st.deposit = v; }], ['discType', function (v) { st.discType = v; }]
  ].forEach(function (p) {
    function h(e) { p[1](e.target.value); refresh(); }
    $(p[0]).addEventListener('input', h); $(p[0]).addEventListener('change', h);
  });
  // The logo is shrunk to at most 320px before saving, so it fits in the phone's storage.
  $('logoFile').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, 320 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        biz.logo = c.toDataURL('image/png'); paintLogo(); refresh();
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(f); e.target.value = '';
  });
  $('logoRemove').addEventListener('click', function () { biz.logo = ''; paintLogo(); refresh(); });

  /* ---------- copy as text ---------- */
  $('copyBtn').addEventListener('click', function () {
    var txt = asText(), fb = $('copyFallback');
    function fallback() { fb.hidden = false; fb.value = txt; fb.rows = 12; fb.focus(); fb.select(); $('copyMsg').textContent = 'Select all the text in the box and copy it.'; }
    try { navigator.clipboard.writeText(txt).then(function () { $('copyMsg').textContent = 'Copied. Paste it into any chat.'; }, fallback); } catch (e) { fallback(); }
  });

  /* ---------- refresh after every change ---------- */
  function refresh() {
    renderSummary(); updateWa();
    $('glassTotal').textContent = cedi(totals().glass);
    $('refLabel').textContent = st.no;
    $('savedTag').hidden = !isSaved();
    $('bizSummary').textContent = biz.name || 'Add your company details';
    save(KEY, st);
    if (!save(BIZ, biz) && biz.logo) $('live').textContent = 'The logo is too big to save on this device. Try a smaller picture.';
  }

  /* ---------- light / dark theme ---------- */
  // Follows the device's setting until the theme button is used; the choice is then remembered on this device.
  var THEME = 'tsq.theme', darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  function isDark() { var t = document.documentElement.dataset.theme; return t ? t === 'dark' : darkQuery.matches; }
  function paintThemeBtn() {
    var d = isDark();
    $('themeBtn').dataset.mode = d ? 'dark' : 'light';
    $('themeBtn').setAttribute('aria-label', d ? 'Switch to light theme' : 'Switch to dark theme');
  }
  $('themeBtn').addEventListener('click', function () {
    var t = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = t; save(THEME, t); paintThemeBtn();
  });
  if (darkQuery.addEventListener) darkQuery.addEventListener('change', paintThemeBtn);
  paintThemeBtn();

  /* ---------- install and offline ---------- */
  // The Install button shows whenever the app isn't already running installed. Chrome only sometimes offers a
  // direct install (beforeinstallprompt), and iPhones never do, so otherwise the button explains how to do it by hand.
  var installEvent = null;
  var installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  $('installBtn').hidden = installed;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvent = e; $('installBtn').hidden = false; });
  function installSteps() {
    var ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
      return 'Open this page in Safari, tap the Share button (the square with an arrow), then tap Add to Home Screen.';
    }
    if (/Android/.test(ua)) {
      return 'In Chrome, tap the ⋮ menu at the top right, then Install app (or Add to Home screen). If you opened this link from WhatsApp, first tap ⋮ → Open in Chrome.';
    }
    return 'In Chrome or Edge, click the install icon at the right end of the address bar, or open the browser menu and choose Install.';
  }
  $('installBtn').addEventListener('click', function () {
    if (installEvent) {
      try {
        installEvent.prompt();
        installEvent.userChoice.then(function (c) { if (c.outcome === 'accepted') $('installBtn').hidden = true; }).finally(function () { installEvent = null; });
        return;
      } catch (e) { installEvent = null; } // the browser refused the prompt: fall through to the instructions
    }
    $('installHelpTxt').textContent = installSteps(); $('installHelp').hidden = false; $('installHelpClose').focus();
  });
  $('installHelpClose').addEventListener('click', function () { $('installHelp').hidden = true; });
  window.addEventListener('appinstalled', function () { $('installBtn').hidden = true; $('installHelp').hidden = true; });
  // The service worker keeps a copy of the app on the device so it opens without internet.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  /* ---------- start ---------- */
  fillFixed(); renderAllLists(); refresh(); setView('edit');
  if (!biz.name) $('bizPanel').open = true;
})();
