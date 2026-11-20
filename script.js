/* UnifyIQ demo — vanilla JS, no build step */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- Hero counters ---------- */
  $$('[data-count]').forEach(el => {
    const end = +el.dataset.count, suf = el.dataset.suffix || '';
    const t0 = performance.now();
    (function tick(t) {
      const p = Math.min((t - t0) / 1200, 1);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + (p === 1 ? suf : '');
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  });

  /* ---------- Pipeline ---------- */
  const PIPE = [
    ['Supplier feeds', 'Hotels & Sightseeing APIs', 'Existing supplier APIs are used as-is — no supplier-side changes are required.'],
    ['Ingest & normalize', 'names, geo, rooms, policies', 'Names, coordinates, room types and cancellation policies are normalised into one schema. If unsure, we fall back to raw supplier data.'],
    ['Candidate blocking', 'geo-hash + text keys', 'Geo-hash cells and text keys cut the comparison space from millions of pairs to a few nearby candidates.'],
    ['Match & classify', 'rules + embeddings + LLM', 'Rules and text/image embeddings decide most pairs. An LLM is called only for low-confidence pairs to control cost.'],
    ['Canonical catalog', 'golden IDs, enriched', 'One golden ID per property/experience, enriched with the best descriptions and images from every supplier.'],
    ['Offer + Rank API', 'best offer, ranked list', 'Serves the best offer per product and a learning-to-rank ordered list, precomputed and cached for low latency.']
  ];
  const pipe = $('#pipe'), pd = $('#pipeDetail');
  PIPE.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'pn' + (i === 0 ? ' active' : '');
    b.innerHTML = `<b>${p[0]}</b><small>${p[1]}</small>`;
    b.onclick = () => { $$('.pn').forEach(x => x.classList.remove('active')); b.classList.add('active'); pd.textContent = p[2]; };
    pipe.appendChild(b);
  });
  pd.textContent = PIPE[0][2];

  /* ---------- Tabs ---------- */
  $$('#mergeTabs .tab').forEach(t => t.onclick = () => {
    $$('#mergeTabs .tab').forEach(x => x.classList.toggle('active', x === t));
    $('#tab-hotels').classList.toggle('hidden', t.dataset.tab !== 'hotels');
    $('#tab-sights').classList.toggle('hidden', t.dataset.tab !== 'sights');
  });

  /* ---------- Engine 1: Hotels ---------- */
  const RAW = [
    { id: 'a1', sup: 'Supplier A', name: 'Grand Hyatt Dubai', addr: 'Sheikh Rashid Rd, Umm Hurair 2, Dubai', geo: '25.2285, 55.3273' },
    { id: 'b1', sup: 'Supplier B', name: 'Hyatt Grand Dubai Hotel', addr: 'Al Wasl Rd, Umm Hurair, Dubai UAE', geo: '25.2287, 55.3270' },
    { id: 'c1', sup: 'Supplier C', name: 'GRAND HYATT DUBAI HTL', addr: 'Sheikh Rashid Rd, Dubai', geo: '25.2283, 55.3276' },
    { id: 'a2', sup: 'Supplier A', name: 'Hyatt Regency Dubai Creek Heights', addr: 'Oud Metha Rd, Dubai Healthcare City', geo: '25.2300, 55.3200' },
    { id: 'b2', sup: 'Supplier B', name: 'Hyatt Regency Creek Heights', addr: 'Oud Metha Road, Dubai', geo: '25.2301, 55.3199' }
  ];
  // [geo, name, address, image-hash] similarity, weights below
  const W = [0.30, 0.30, 0.20, 0.20];
  const PAIRS = [
    { a: 'a1', b: 'b1', s: [0.99, 0.88, 0.84, 0.96] },
    { a: 'a1', b: 'c1', s: [0.98, 0.82, 0.72, 0.91] },
    { a: 'a2', b: 'b2', s: [0.99, 0.91, 0.88, 0.94] },
    { a: 'a1', b: 'a2', s: [0.82, 0.45, 0.35, 0.25] }
  ];
  const conf = s => s.reduce((t, v, i) => t + v * W[i], 0);
  const verdict = c => c >= 0.85 ? ['auto-merge', 'ok'] : c >= 0.4 ? ['LLM check → distinct', 'warn'] : ['distinct', 'warn'];
  const nm = id => RAW.find(r => r.id === id).name;

  const rawBox = $('#rawHotels');
  function renderRaw() {
    rawBox.innerHTML = RAW.map(r => `<div class="raw" id="raw-${r.id}"><span class="sup">${r.sup}</span><h4>${r.name}</h4><p>${r.addr}</p><p class="geo">${r.geo}</p></div>`).join('');
  }
  renderRaw();

  let running = false;
  async function runMatch() {
    if (running) return; running = true;
    resetMatch(true);
    $('#runMatch').disabled = true;
    $('#matchState').textContent = 'Running…';
    const steps = $$('#matchSteps li'), pairsBox = $('#pairs');
    for (let i = 0; i < steps.length; i++) {
      steps.forEach((s, j) => { s.classList.toggle('on', j === i); s.classList.toggle('done', j < i); });
      if (i === 2) {
        pairsBox.innerHTML = PAIRS.map((p, k) => `<div class="pair" id="pair-${k}"><div class="pt"><span>${nm(p.a)} ↔ ${nm(p.b)}</span><span class="score">…</span></div>
          <div class="bars">${['Geo', 'Name', 'Address', 'Image'].map((l, j) => `<div class="bar"><small>${l} ${(p.s[j] * 100) | 0}%</small><div><i data-w="${p.s[j] * 100}"></i></div></div>`).join('')}</div></div>`).join('');
        await sleep(60);
        $$('.bar i', pairsBox).forEach(el => el.style.width = el.dataset.w + '%');
      }
      if (i === 3) {
        PAIRS.forEach((p, k) => {
          const c = conf(p.s), [v, cls] = verdict(c);
          $('.score', $('#pair-' + k)).innerHTML = `<span class="pill ${cls}">${c.toFixed(2)} · ${v}</span>`;
        });
      }
      if (i === 4) {
        ["a1","b1","c1"].forEach(id => $("#raw-"+id).classList.add("merged"));
        ["a2","b2"].forEach(id => $("#raw-"+id).classList.add("apart"));
        renderGolden();
      }
      await sleep(i === 2 ? 1600 : 1000);
    }
    steps.forEach(s => { s.classList.remove('on'); s.classList.add('done'); });
    $('#matchState').textContent = 'Done'; $('#runMatch').disabled = false; running = false;
  }

  const ROOMS = [
    { canon: 'Deluxe King · City View', m: [['A', 'Dlx Rm King CityVw'], ['B', 'Deluxe Room - 1 King Bed - City View'], ['C', 'DELUXE KG CV']] },
    { canon: 'Executive Suite · Club Lounge', m: [['A', 'Executive Suite Club Access'], ['B', 'Exec Ste w/ Lounge']] },
    { canon: 'Standard Twin · Garden View', m: [['A', 'Twin Std Garden'], ['C', 'Standard 2 Single Beds Garden View']] }
  ];
  function renderGolden() {
    $('#golden').classList.remove('hidden');
    $('#rooms').innerHTML = ROOMS.map(r => `<div class="room"><div class="l">${r.m.map(x => `<span>${x[0]}: ${x[1]}</span>`).join('')}</div><span class="arrow">→</span><div class="canon">${r.canon}</div></div>`).join('');
    $('#golden').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function resetMatch(keepBtn) {
    renderRaw();
    $$('#matchSteps li').forEach(s => s.classList.remove('on', 'done'));
    $('#pairs').innerHTML = ''; $('#golden').classList.add('hidden');
    $('#matchState').textContent = 'Idle';
    if (!keepBtn) { $('#runMatch').disabled = false; running = false; }
  }
  $('#runMatch').onclick = runMatch;
  $('#resetMatch').onclick = () => { if (!running) resetMatch(); };
  $('#unmerge').onclick = () => alert('Unmerge: golden ID GP-DXB-004217 is split back into its supplier listings; the correction is logged as training data.');

  /* ---------- Engine 1: Sightseeing fingerprints ---------- */
  const EXP = [
    { sup: 'Supplier A', title: 'At the Top, Burj Khalifa — Level 124', transfer: false, meals: 'None', dur: 90, access: 'Standard', level: '124', cancel: 24, base: true },
    { sup: 'Supplier B', title: 'Burj Khalifa Floor 124 Admission', transfer: false, meals: 'None', dur: 90, access: 'Standard', level: '124', cancel: 24 },
    { sup: 'Supplier C', title: 'At The Top Level 124 · Flexible', transfer: false, meals: 'None', dur: 100, access: 'Standard', level: '124', cancel: 48 },
    { sup: 'Supplier D', title: 'Level 124 + Return Hotel Transfer', transfer: true, meals: 'None', dur: 90, access: 'Standard', level: '124', cancel: 24 },
    { sup: 'Supplier B', title: 'Fast Track 124 & 125 + Breakfast', transfer: false, meals: 'Breakfast', dur: 120, access: 'Fast-track', level: '124+125', cancel: 24 },
    { sup: 'Supplier E', title: 'Level 124 — Non-refundable Promo', transfer: false, meals: 'None', dur: 90, access: 'Standard', level: '124', cancel: 0 }
  ];
  const FIELDS = [['transfer', 'Transfers'], ['meals', 'Meals'], ['dur', 'Duration'], ['access', 'Access'], ['level', 'Levels'], ['cancel', 'Free cancel']];
  const base = EXP[0];
  function diffs(e) {
    const mat = [], minor = [];
    if (e.transfer !== base.transfer) mat.push('transfer');
    if (e.meals !== base.meals) mat.push('meals');
    if (e.access !== base.access) mat.push('access');
    if (e.level !== base.level) mat.push('level');
    if ((e.cancel === 0) !== (base.cancel === 0)) mat.push('cancel');
    else if (e.cancel !== base.cancel) minor.push('cancel');
    if (e.dur !== base.dur) (Math.abs(e.dur - base.dur) > 20 ? mat : minor).push('dur');
    return { mat, minor };
  }
  const fmt = (k, e) => k === 'transfer' ? (e.transfer ? '<span class="yes">✓ Included</span>' : '<span class="no">—</span>')
    : k === 'dur' ? e.dur + ' min' : k === 'cancel' ? (e.cancel ? e.cancel + 'h before' : 'Non-refundable') : e[k];
  const label = e => e.base ? 'base' : (d => d.mat.length ? 'var' : d.minor.length ? 'equiv' : 'exact')(diffs(e));
  const LBL = { base: 'Base', exact: 'Exact', equiv: 'Equivalent', var: 'Variant' };
  $('#fpTable').innerHTML = `<tr><th>Offer</th>${FIELDS.map(f => `<th>${f[1]}</th>`).join('')}<th>Label</th></tr>` +
    EXP.map((e, i) => {
      const d = diffs(e), l = label(e);
      return `<tr class="click" data-i="${i}"><td><b>${e.title}</b><br><span class="muted small">${e.sup}</span></td>${FIELDS.map(([k]) => {
        const hit = d.mat.includes(k) || d.minor.includes(k);
        return `<td>${hit ? `<span class="diff">${fmt(k, e)}</span>` : fmt(k, e)}</td>`;
      }).join('')}<td><span class="tag ${l}">${LBL[l]}</span></td></tr>`;
    }).join('');
  const names = { transfer: 'transfers', meals: 'meals', access: 'access type', level: 'observation levels', cancel: 'cancellation', dur: 'duration' };
  function showFp(i) {
    $$('#fpTable tr.click').forEach(r => r.classList.toggle('sel', +r.dataset.i === i));
    const e = EXP[i], l = label(e), d = diffs(e);
    $('#fpDetail').innerHTML = l === 'base' ? '<b>Base fingerprint.</b> Every other offer is compared against this one.'
      : l === 'exact' ? '<b class="t-exact">Exact match.</b> Same fingerprint → merged into one product; suppliers compete on price and reliability.'
      : l === 'equiv' ? `<b class="t-equiv">Equivalent.</b> Only minor differences (${d.minor.map(k => names[k]).join(', ')}). Merged into one product with the difference shown as a note.`
      : `<b class="t-var">Variant.</b> Material difference in <b>${d.mat.map(k => names[k]).join(', ')}</b>. Kept as a separate option under the same product card, so what the traveller buys is never misrepresented.`;
  }
  $$('#fpTable tr.click').forEach(r => r.onclick = () => showFp(+r.dataset.i));
  showFp(3);

  /* ---------- Engine 2: Best offer ---------- */
  const OFF = [
    { sup: 'Supplier A', price: 842, fail: 0.010, pc: 0.02, ms: 420, left: 5, cancel: 48, pay: 'Prepaid' },
    { sup: 'Supplier B', price: 815, fail: 0.015, pc: 0.03, ms: 380, left: 2, cancel: 24, pay: 'Pay at hotel' },
    { sup: 'Supplier C', price: 798, fail: 0.060, pc: 0.12, ms: 1500, left: 9, cancel: 0, pay: 'Prepaid' },
    { sup: 'Supplier D', price: 829, fail: 0.020, pc: 0.04, ms: 700, left: 1, cancel: 72, pay: 'Prepaid' }
  ];
  const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
  OFF.forEach(o => o.rel = clamp(100 - o.fail * 400 - o.pc * 150 - o.ms / 60));
  const pmin = Math.min(...OFF.map(o => o.price)), pmax = Math.max(...OFF.map(o => o.price));
  OFF.forEach(o => {
    o.value = 0.5 * (pmax - o.price) / (pmax - pmin) + 0.3 * o.rel / 100 + 0.2 * Math.min(o.cancel / 72, 1);
  });
  let goal = 'value';
  function renderOffers() {
    const key = { value: o => -o.value, price: o => o.price, rel: o => -o.rel }[goal];
    const list = [...OFF].sort((a, b) => key(a) - key(b));
    const col = r => r > 75 ? 'var(--ok)' : r > 55 ? 'var(--warn)' : 'var(--bad)';
    $('#offerTable').innerHTML = `<tr><th>Supplier</th><th>Net price (2 nights)</th><th>Reliability</th><th>Availability</th><th>Cancellation</th><th>Payment</th><th>Value score</th></tr>` +
      list.map((o, i) => `<tr class="${i === 0 ? 'best' : ''}"><td><b>${o.sup}</b>${i === 0 ? `<span class="best-badge">${{ value: 'BEST VALUE', price: 'LOWEST PRICE', rel: 'MOST RELIABLE' }[goal]}</span>` : ''}</td>
        <td><span class="price">$${o.price}</span>${o.price > pmin ? `<br><span class="muted small">+$${o.price - pmin} vs cheapest</span>` : '<br><span class="muted small">cheapest</span>'}</td>
        <td><div class="rel"><div><i style="width:${o.rel}%;background:${col(o.rel)}"></i></div><b>${Math.round(o.rel)}</b></div><span class="muted small">${(o.fail * 100).toFixed(1)}% fail · ${(o.pc * 100).toFixed(0)}% price chg · ${o.ms}ms</span></td>
        <td>${o.left <= 2 ? `<span class="t-equiv">Only ${o.left} left</span>` : o.left + ' rooms'}</td>
        <td>${o.cancel ? `<span class="yes">Free until ${o.cancel}h</span>` : '<span class="t-var">Non-refundable</span>'}</td>
        <td>${o.pay}</td><td><b>${(o.value * 100).toFixed(0)}</b>/100</td></tr>`).join('');
  }
  $$('#goal button').forEach(b => b.onclick = () => {
    $$('#goal button').forEach(x => x.classList.toggle('active', x === b)); goal = b.dataset.g; renderOffers();
  });
  renderOffers();

  /* ---------- Engine 3: Ranking ---------- */
  const FEATS = [['relevance', 'Relevance'], ['price', 'Price competitiveness'], ['content', 'Content quality'], ['reviews', 'Reviews'], ['avail', 'Availability'], ['rel', 'Supplier reliability'], ['conv', 'Historical conversion']];
  const HOTELS = [
    { id: 'h1', name: 'Grand Hyatt Dubai', meta: '★5 · Umm Hurair', f: [92, 55, 95, 90, 70, 85, 88] },
    { id: 'h2', name: 'Marina Skyline Suites', meta: '★4 · Dubai Marina', f: [80, 85, 70, 78, 90, 60, 72] },
    { id: 'h3', name: 'Palm Breeze Resort', meta: '★5 · Palm Jumeirah', f: [88, 35, 90, 94, 55, 90, 80] },
    { id: 'h4', name: 'Deira Budget Inn', meta: '★3 · Deira', f: [70, 98, 45, 62, 95, 40, 66] },
    { id: 'h5', name: 'Creek Heights Regency', meta: '★4 · Oud Metha', f: [85, 62, 82, 82, 75, 78, 77] },
    { id: 'h6', name: 'Downtown Loft Stay', meta: '★4 · Downtown', f: [78, 70, 60, 70, 60, 55, 58] }
  ];
  const PRESETS = {
    legacy: [60, 10, 5, 15, 10, 0, 0],
    ltr: [20, 20, 10, 15, 10, 12, 13],
    price: [10, 45, 5, 10, 10, 10, 10]
  };
  let weights = [...PRESETS.ltr], version = 1, prevOrder = null;
  const score = (h, w) => h.f.reduce((t, v, i) => t + v * w[i], 0) / (w.reduce((a, b) => a + b, 0) || 1);
  const order = w => [...HOTELS].sort((a, b) => score(b, w) - score(a, w));
  const legacyTop = order(PRESETS.legacy).slice(0, 3).map(h => h.id);

  const slBox = $('#sliders');
  slBox.innerHTML = FEATS.map((f, i) => `<div class="sl"><div class="sl-top"><span>${f[1]}</span><b id="sv${i}"></b></div><input type="range" min="0" max="100" id="sr${i}"></div>`).join('');
  FEATS.forEach((_, i) => $('#sr' + i).oninput = e => { weights[i] = +e.target.value; $$('.presets .btn').forEach(b => b.classList.remove('active')); update(); });
  function syncSliders() { weights.forEach((w, i) => { $('#sr' + i).value = w; }); }

  const list = $('#rankList');
  HOTELS.forEach(h => {
    const el = document.createElement('div'); el.className = 'rk'; el.id = 'rk-' + h.id;
    el.innerHTML = `<div class="pos"></div><div><h4>${h.name}<span class="mv"></span></h4><div class="meta">${h.meta}</div><div class="mini">${h.f.map(v => `<i title="${v}"><b style="width:${v}%"></b></i>`).join('')}</div></div><div class="sc"><b></b><small>rank score</small></div>`;
    list.appendChild(el);
  });
  function update() {
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    weights.forEach((w, i) => $('#sv' + i).textContent = Math.round(w / total * 100) + '%');
    const o = order(weights);
    const first = {}; $$('.rk', list).forEach(el => first[el.id] = el.getBoundingClientRect().top);
    o.forEach(h => list.appendChild($('#rk-' + h.id)));
    o.forEach((h, i) => {
      const el = $('#rk-' + h.id);
      $('.pos', el).textContent = i + 1; $('.sc b', el).textContent = score(h, weights).toFixed(1);
      el.classList.toggle('top', i < 3);
      const mv = $('.mv', el), was = prevOrder ? prevOrder.indexOf(h.id) : i, d = was - i;
      mv.className = 'mv' + (d > 0 ? ' up' : d < 0 ? ' dn' : ''); mv.textContent = d > 0 ? '▲' + d : d < 0 ? '▼' + -d : '';
      const dy = first[el.id] - el.getBoundingClientRect().top;
      if (dy) { el.style.transition = 'none'; el.style.transform = `translateY(${dy}px)`; requestAnimationFrame(() => { el.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1)'; el.style.transform = ''; }); }
    });
    prevOrder = o.map(h => h.id);
    const ch = o.slice(0, 3).filter(h => !legacyTop.includes(h.id)).length;
    $('#abPill').textContent = `Top-3 changed vs. current: ${ch}`;
  }
  $$('.presets .btn').forEach(b => b.onclick = () => {
    $$('.presets .btn').forEach(x => x.classList.toggle('active', x === b));
    weights = [...PRESETS[b.dataset.p]]; syncSliders(); update();
  });
  $('#feedback').onclick = () => {
    const before = weights[6];
    weights[6] = Math.min(100, weights[6] + 5); weights[5] = Math.min(100, weights[5] + 2); weights[0] = Math.max(0, weights[0] - 3);
    version++; $('#modelVer').textContent = 'LTR v' + version;
    $('#fbLog').textContent = `Retrained v${version} on 1,000 simulated bookings: conversion weight ${before} → ${weights[6]}, reliability +2, relevance −3. Next step: A/B test vs. current ranking before rollout.`;
    $$('.presets .btn').forEach(b => b.classList.remove('active')); syncSliders(); update();
  };
  syncSliders(); update();

  /* ---------- Risks ---------- */
  const RISKS = [
    ['Wrong merges of distinct products', 'Confidence thresholds, Variant label, human review queue, easy unmerge.'],
    ['Inconsistent supplier data', 'Normalization layer; fall back to raw supplier data when unsure.'],
    ['Latency & LLM cost', 'Offline precompute, caching; LLM only for low-confidence pairs.'],
    ['Ranking cold start', 'Rule-based baseline first, ML added as data grows.'],
    ['Business & supplier buy-in', 'Shadow mode, A/B test, feature flag rollback, KPI dashboard.']
  ];
  $('#risks').innerHTML = RISKS.map(r => `<div class="risk"><button>${r[0]}</button><div><b>Mitigation:</b> ${r[1]}</div></div>`).join('');
  $$('.risk button').forEach(b => b.onclick = () => b.parentElement.classList.toggle('open'));
})();
