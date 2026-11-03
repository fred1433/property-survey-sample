/* Renders the survey sheets, the budget scale and the review table from rules.js.
   The same sheets are shown on screen and printed to PDF. */
(function () {
  'use strict';
  const S = window.SurveyRules;
  const { money, rate, fmtInt, fmtDate, loading } = S;
  const TITLE = 'Industrial space survey, Southwest Las Vegas';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let ROWS = null, state = null, prev = null;

  /* Illustrative pin slots inside the Southwest zone of the schematic. Not geocoded. */
  const PIN_SLOT = { A: [150, 252], B: [236, 292], C: [282, 214], D: [112, 300], E: [204, 214], F: [306, 286], K: [96, 248], L: [252, 250], M: [182, 312], N: [132, 236] };

  /* ---------- sheet chrome ---------- */
  function sheet(kind, n, total, budget, body, mid) {
    return `<article class="sheet ${kind}" aria-label="Survey page ${n} of ${total}">
      <header class="s-head"><span>${TITLE}</span><span class="num">Budget step ${money(budget)} a month</span></header>
      <div class="s-body">${body}</div>
      <footer class="s-foot"><span class="fict">Fictional listings, sample survey</span><span>${mid || 'Prepared ' + fmtDate(S.REQUEST.prepared)}</span><span class="num">Page ${n} of ${total}</span></footer>
    </article>`;
  }

  /* ---------- page 1: request, result, schematic map ---------- */
  function mapSVG(st) {
    const pins = st.meets.map(r => {
      const [x, y] = PIN_SLOT[r.offer.letter] || [200, 260];
      return `<g class="pin"><circle cx="${x}" cy="${y}" r="13"/><text x="${x}" y="${y + 4.5}">${r.rank}</text></g>`;
    }).join('');
    return `<svg class="map" viewBox="0 0 720 360" role="img" aria-label="Schematic of Las Vegas industrial submarkets with ${st.meets.length} numbered pins in Southwest">
      <defs><pattern id="hatchSW" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" class="hatch"/></pattern></defs>
      <path class="valley" d="M40 170 C 60 70, 200 20, 330 18 S 600 30, 640 110 S 710 250, 690 320 S 520 352, 360 348 S 60 340, 34 270 Z"/>
      <path class="zone" d="M300 32 L 520 30 L 566 112 L 432 134 L 326 112 Z"/>
      <text class="zlabel" x="438" y="78">North Las Vegas</text>
      <path class="zone" d="M384 168 L 506 162 L 528 236 L 402 248 Z"/>
      <text class="zlabel" x="455" y="210">Airport</text>
      <path class="zone" d="M506 252 L 664 232 L 690 322 L 528 340 Z"/>
      <text class="zlabel" x="600" y="296">Henderson</text>
      <path class="zone target" d="M58 192 L 336 166 L 364 250 L 336 334 L 92 336 L 46 262 Z"/>
      <path class="zone target-hatch" d="M58 192 L 336 166 L 364 250 L 336 334 L 92 336 L 46 262 Z" fill="url(#hatchSW)"/>
      <text class="zlabel target-label" x="74" y="214">Southwest, search area</text>
      <path class="road" d="M478 0 C 438 110, 392 176, 344 240 S 238 330, 206 360"/>
      <text class="rlabel" x="484" y="16">I-15</text>
      <path class="road" d="M30 226 C 120 300, 300 336, 428 306 S 610 262, 700 290"/>
      <text class="rlabel" x="636" y="262">I-215</text>
      ${pins}
    </svg>`;
  }

  function cover(st) {
    const q = st.req, n = st.meets.length;
    const repeats = st.offers.reduce((a, o) => a + o.repeats.reduce((b, r) => b + r.length - 1, 0), 0);
    const conflicted = st.offers.filter(o => o.conflicts.length);
    const pagesLine = n === 0 ? 'none at this budget' : n === 1 ? 'page 3' : 'pages 3 to ' + (2 + n);
    const body = `
      <div class="cover-title">
        <h2>Industrial space survey</h2>
        <p class="cover-sub">Southwest Las Vegas</p>
        <p class="cover-meta">Prepared ${fmtDate(q.prepared, true)} for an example tenant. Listings, buildings, brokers and figures are fictional.</p>
      </div>
      <div class="cover-cols">
        <section>
          <h3>The requirement</h3>
          <dl class="req">
            <dt>Use</dt><dd>${q.use}</dd>
            <dt>Size</dt><dd class="num">${fmtInt(q.minSF)} to ${fmtInt(q.maxSF)} SF in one space</dd>
            <dt>Submarket</dt><dd>${q.submarket}, required</dd>
            <dt>Loading</dt><dd>At least ${q.minDH} dock-high and ${q.minGL} grade-level door</dd>
            <dt>Available</dt><dd>By ${fmtDate(q.availableBy, true)}</dd>
            <dt>Budget</dt><dd><strong class="num">${money(st.budget)} a month</strong>, estimated base rent + stated expenses</dd>
            <dt>Lease</dt><dd>Direct or sublease</dd>
          </dl>
        </section>
        <section>
          <h3>What the file produced</h3>
          <ul class="result-list">
            <li><b class="num">${n}</b> ${n === 1 ? 'space meets' : 'spaces meet'} every requirement: ${pagesLine}</li>
            <li><b class="num">${st.confirm.length}</b> need${st.confirm.length === 1 ? 's' : ''} confirmation before they can be ranked: page 2</li>
            <li><b class="num">${st.excluded.length}</b> excluded, each with its reason: page 2</li>
            <li class="small">${st.rows.length} source rows became ${st.offers.length} distinct offers: ${repeats} exact repeat counted once, ${conflicted.length} offer with conflicting rows kept for review.</li>
          </ul>
        </section>
      </div>
      <figure class="map-fig">
        ${mapSVG(st)}
        <figcaption>Schematic of submarkets. Numbered pins match the ranking on page 2; pin positions are illustrative, so no distance or drive time should be read from them.</figcaption>
      </figure>`;
    return sheet('portrait', 1, st.pages, st.budget, body);
  }

  /* ---------- page 2: comparison matrix (landscape) ---------- */
  function rentCell(c) {
    return `${rate(c.rentPerMonth)}/SF/mo ${c.regime || ''}${c.quoted ? `<span class="sub">listed as ${esc(c.quoted.trim())}</span>` : ''}`;
  }
  function matrix(st) {
    const m = st.meets;
    let table;
    if (!m.length) {
      const nm = st.nearMiss;
      table = `<div class="empty"><p>No space meets every requirement at ${money(st.budget)} a month.</p>${nm ? `<p>The lowest estimated cost among spaces that pass every other check is ${money(nm.cost.monthly)} a month (${esc(nm.offer.name)}).</p>` : ''}</div>`;
    } else {
      const rowsDef = [
        ['Submarket', r => r.offer.submarket],
        ['Rentable area', r => `${fmtInt(r.offer.sf)} SF <span class="sub">${r.offer.officePct}% office</span>`],
        ['Lease', r => r.offer.lease === 'Sublease' ? `Sublease <span class="sub">to ${fmtDate(r.offer.subleaseTo)}</span>` : 'Direct'],
        ['Available', r => fmtDate(r.offer.available)],
        ['Asking base rent', r => rentCell(r.cost)],
        ['Stated expenses', r => `${rate(r.offer.expenses)}/SF/mo`],
        ['Est. monthly base rent + stated expenses', r => `<strong>${money(r.cost.monthly)}</strong>`, 'key'],
        ['Annualized at initial rate', r => money(r.cost.annual)],
        ['Under budget by', r => r.margin === 0 ? 'At budget' : money(r.margin)],
        ['Loading', r => loading(r.offer)],
        ['Clear height', r => r.offer.clear + ' ft'],
        ['Power', r => esc(r.offer.power)],
        ['Warehouse cooling', r => esc(r.offer.cooling)],
        ['Sprinklers', r => esc(r.offer.sprinklers)],
        ['Yard / parking', r => esc(r.offer.yard)],
        ['Year built', r => r.offer.yearBuilt],
        ['Zoning, as listed', r => esc(r.offer.zoning)],
        ['Listing broker', r => esc(r.offer.broker)],
        ['Source', r => `${r.offer.rows.length > 1 ? 'Rows' : 'Row'} ${r.offer.rows.join(' and ')}, dated ${fmtDate(r.offer.sourceDates[0])}`],
      ];
      table = `<table class="matrix cols-${m.length}">
        <thead><tr><th scope="col"><span class="sr">Criterion</span></th>${m.map(r => `<th scope="col"><span class="rank">${r.rank}</span>${esc(r.offer.building)}<span class="sub">Suite ${esc(r.offer.suite)}, page ${r.rank + 2}</span></th>`).join('')}</tr></thead>
        <tbody>${rowsDef.map(([label, f, cls]) => `<tr class="${cls || ''}"><th scope="row">${label}</th>${m.map(r => `<td class="num">${f(r)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`;
    }
    const short = r => esc(r.short);
    const body = `
      <div class="m-head">
        <h3>Spaces meeting every requirement, ranked by estimated monthly cost</h3>
        <p>Costs are base rent plus the expenses stated in the listing, per month, then annualized at the initial rate. Not included: utilities, improvements, escalations, anything the listing does not state.</p>
      </div>
      ${table}
      <div class="m-foot">
        <section><h4>To confirm before ranking (${st.confirm.length})</h4>
          <ul>${st.confirm.map(r => `<li><b>${esc(r.offer.name)}.</b> ${short(r)}</li>`).join('') || '<li>None.</li>'}</ul></section>
        <section><h4>Excluded (${st.excluded.length})</h4>
          <ul>${st.excluded.map(r => `<li><b>${esc(r.offer.name)}.</b> ${short(r)}</li>`).join('')}</ul></section>
      </div>`;
    return sheet('landscape', 2, st.pages, st.budget, body);
  }

  /* ---------- pages 3+: one per ranked space ---------- */
  function planSVG(o) {
    const X = 20, Y = 10, W = 600, H = 150;
    const ow = Math.max(56, Math.round(W * (o.office / o.sf)));
    const doors = [];
    const n = (o.dh || 0) + (o.gl || 0);
    const span = W - ow - 40, start = X + ow + 20;
    const gap = n > 1 ? span / (n - 1) : 0;
    let i = 0;
    for (let k = 0; k < (o.dh || 0); k++, i++) {
      const cx = n > 1 ? start + gap * i : start + span / 2;
      doors.push(`<rect class="dh" x="${cx - 12}" y="${Y + H - 2}" width="24" height="9"/><text class="dl" x="${cx}" y="${Y + H + 22}">DH</text>`);
    }
    for (let k = 0; k < (o.gl || 0); k++, i++) {
      const cx = n > 1 ? start + gap * i : start + span / 2;
      doors.push(`<rect class="gl" x="${cx - 17}" y="${Y + H - 3}" width="34" height="6"/><text class="dl" x="${cx}" y="${Y + H + 22}">GL</text>`);
    }
    const wx = X + ow + (W - ow) / 2;
    return `<svg class="plan" viewBox="0 0 640 218" role="img" aria-label="Schematic floor plan: ${o.officePct}% office, ${loading(o)}, ${o.clear} ft clear">
      <defs><pattern id="hatchO${o.letter}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" class="hatch"/></pattern></defs>
      <rect class="shell" x="${X}" y="${Y}" width="${W}" height="${H}"/>
      <rect class="office" x="${X}" y="${Y}" width="${ow}" height="${H}" fill="url(#hatchO${o.letter})"/>
      <line class="wall" x1="${X + ow}" y1="${Y}" x2="${X + ow}" y2="${Y + H}"/>
      <text class="pl" x="${X + ow / 2}" y="${Y + H / 2 - 4}">Office</text>
      <text class="pl small" x="${X + ow / 2}" y="${Y + H / 2 + 12}">${fmtInt(o.office)} SF</text>
      <text class="pl big" x="${wx}" y="${Y + H / 2 - 8}">Warehouse</text>
      <text class="pl" x="${wx}" y="${Y + H / 2 + 12}">${fmtInt(o.sf - o.office)} SF, ${o.clear} ft clear</text>
      ${doors.join('')}
      <rect class="yard" x="${X}" y="${Y + H + 32}" width="${W}" height="24"/>
      <text class="pl small" x="${X + W / 2}" y="${Y + H + 48}">${esc(o.yard)}</text>
    </svg>`;
  }

  function spacePage(st, r) {
    const o = r.offer, c = r.cost;
    const body = `
      <div class="sp-head">
        <span class="sp-rank num">${r.rank}</span>
        <div>
          <h3>${esc(o.name)}</h3>
          <p>${esc(o.submarket)} submarket, ${o.lease === 'Sublease' ? 'sublease' : 'direct lease'}, ${fmtInt(o.sf)} SF</p>
        </div>
      </div>
      <p class="verdict">${esc(r.sentence)}</p>
      <figure class="plan-fig">${planSVG(o)}<figcaption>Schematic, not to scale. Drawn from the listing fields: area, office share, doors, clear height, yard.</figcaption></figure>
      <div class="sp-grid">
        <table class="cost">
          <caption>Estimated monthly cost</caption>
          <tr><th scope="row">Base rent, ${c.regime || ''}</th><td class="num calc">${fmtInt(o.sf)} SF \u00d7 ${rate(c.rentPerMonth)}</td><td class="num">${money(c.base)}</td></tr>
          <tr><th scope="row">Stated expenses</th><td class="num calc">${fmtInt(o.sf)} SF \u00d7 ${rate(o.expenses)}</td><td class="num">${money(c.exp)}</td></tr>
          <tr class="sum"><th scope="row">Monthly, base + expenses</th><td></td><td class="num">${money(c.monthly)}</td></tr>
          <tr><th scope="row">Annualized at initial rate</th><td class="num calc">\u00d7 12</td><td class="num">${money(c.annual)}</td></tr>
          <tr><th scope="row">Budget step</th><td></td><td class="num">${money(st.budget)}</td></tr>
          <tr><th scope="row">Under budget by</th><td></td><td class="num">${r.margin === 0 ? 'At budget' : money(r.margin)}</td></tr>
        </table>
        <dl class="specs">
          <dt>Rentable area</dt><dd class="num">${fmtInt(o.sf)} SF (${o.officePct}% office)</dd>
          <dt>Lease</dt><dd>${o.lease === 'Sublease' ? 'Sublease to ' + fmtDate(o.subleaseTo) : 'Direct'}</dd>
          <dt>Available</dt><dd>${fmtDate(o.available)}</dd>
          <dt>Loading</dt><dd class="num">${loading(o)}</dd>
          <dt>Clear height</dt><dd class="num">${o.clear} ft</dd>
          <dt>Power</dt><dd class="num">${esc(o.power)}</dd>
          <dt>Warehouse cooling</dt><dd>${esc(o.cooling)}</dd>
          <dt>Sprinklers</dt><dd>${esc(o.sprinklers)}</dd>
          <dt>Yard / parking</dt><dd>${esc(o.yard)}</dd>
          <dt>Year built</dt><dd class="num">${o.yearBuilt}</dd>
          <dt>Zoning, as listed</dt><dd>${esc(o.zoning)}</dd>
        </dl>
      </div>
      <section class="reserves"><h4>Reserves</h4><ul>${r.notes.map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>
      <p class="trace">Source: sample-listings.csv, ${o.rows.length > 1 ? 'rows' : 'row'} ${o.rows.join(' and ')}, dated ${fmtDate(o.sourceDates[0])}. Listing broker: ${esc(o.broker)}.</p>`;
    return sheet('portrait', r.rank + 2, st.pages, st.budget, body, esc(o.name));
  }

  /* ---------- budget scale ---------- */
  function scaleTicks() {
    const { min, max, step } = S.BUDGET;
    let h = '';
    for (let v = min; v <= max; v += step) {
      const p = ((v - min) / (max - min)) * 100;
      const major = (v - min) % 2000 === 0;
      h += `<span class="tick${major ? ' major' : ''}" style="left:${p}%">${major ? `<i>$${v / 1000}k</i>` : ''}</span>`;
    }
    $('ticks').innerHTML = h;
  }

  function scaleMarks(st) {
    const { min, max } = S.BUDGET;
    const el = $('marks');
    const width = el.clientWidth || 600;
    const marks = [];
    for (const r of st.results) {
      const budgetOnly = r.status !== 'excluded' || (r.fails.length === 1 && /budget/.test(r.fails[0]));
      if (!budgetOnly || !r.offer.costs.length) continue;
      for (const c of r.offer.costs) {
        const over = c.monthly > st.budget;
        const cls = over ? 'out' : r.status === 'confirm' ? 'confirm' : 'in';
        marks.push({ v: c.monthly, letter: r.offer.letter, cls, name: r.offer.name });
      }
    }
    marks.sort((a, b) => a.v - b.v);
    const lanes = [];
    const minGap = 30;
    for (const m of marks) {
      m.x = ((m.v - min) / (max - min)) * width;
      let lane = lanes.findIndex(last => m.x - last >= minGap);
      if (lane === -1) { lane = lanes.length; lanes.push(m.x); } else lanes[lane] = m.x;
      m.lane = Math.min(lane, 3);
    }
    $('scale').style.setProperty('--lanes', Math.max(1, lanes.length));
    el.innerHTML = marks.map(m => `<span class="mark ${m.cls} lane-${m.lane}" style="left:${((m.v - min) / (max - min)) * 100}%" title="${esc(m.name)}: ${money(m.v)} a month"><b>${m.letter}</b></span>`).join('');
  }

  /* ---------- review table ---------- */
  function review(st) {
    const order = { meets: 0, confirm: 1, excluded: 2 };
    const list = [...st.results].sort((a, b) => order[a.status] - order[b.status] || (a.rank || 0) - (b.rank || 0) || a.offer.rows[0] - b.offer.rows[0]);
    const label = r => r.status === 'meets' ? `Meets, rank ${r.rank}` : r.status === 'confirm' ? 'To confirm' : 'Excluded';
    const cost = o => o.costs.length ? o.costs.map(c => money(c.monthly)).join(' or ') : (o.rents.some(x => x.missing) ? 'Rent on request' : 'Incomplete');
    $('review').innerHTML = `<thead><tr><th scope="col">Rows</th><th scope="col">Space</th><th scope="col" class="num">Est. monthly</th><th scope="col">Result</th><th scope="col">Why</th></tr></thead>
      <tbody>${list.map(r => `<tr class="st-${r.status}">
        <td class="num rows">${r.offer.rows.join(', ')}</td>
        <td><span class="sp">${esc(r.offer.name)}</span><span class="sub">${esc(r.offer.submarket)}, ${fmtInt(r.offer.sf)} SF${r.offer.useRestriction ? ', ' + esc(r.offer.useRestriction.toLowerCase()) : ''}</span></td>
        <td class="num">${cost(r.offer)}</td>
        <td><span class="chip ${r.status}">${label(r)}</span></td>
        <td class="why">${esc(r.sentence)}</td></tr>`).join('')}</tbody>`;
  }

  /* ---------- what changed since the last budget ---------- */
  function changeNote(st, before) {
    if (!before) return `${st.meets.length} of ${st.offers.length} offers meet every requirement at ${money(st.budget)}. Each letter on the scale is a space that passes every other check, placed at its estimated monthly cost.`;
    const was = new Map(before.results.map(r => [r.offer.id, r.status]));
    const ins = st.meets.filter(r => was.get(r.offer.id) !== 'meets');
    const outs = before.meets.filter(r => !st.meets.some(x => x.offer.id === r.offer.id));
    const parts = [];
    if (ins.length) parts.push(ins.map(r => `${r.offer.name} now meets, rank ${r.rank}`).join('; '));
    if (outs.length) parts.push(outs.map(r => `${r.offer.name} drops out (${money(r.cost.monthly)} a month)`).join('; '));
    if (!parts.length) parts.push(`same shortlist; margins under budget updated`);
    return `At ${money(st.budget)}: ${parts.join('; ')}. The survey now has ${st.pages} pages.`;
  }

  /* ---------- zoom of the sheets on screen ---------- */
  function fitSheets() {
    const desk = $('desk');
    const w = desk.clientWidth - parseFloat(getComputedStyle(desk).paddingLeft) - parseFloat(getComputedStyle(desk).paddingRight);
    const gap = 28;
    let z;
    if (w >= 1100) z = Math.min(0.8, (w - gap) / (816 + 1056));
    else z = null;
    desk.style.setProperty('--z', z || 1);
    desk.classList.toggle('narrow', !z);
    if (!z) {
      desk.style.setProperty('--zp', (w / 816).toFixed(4));
      desk.style.setProperty('--zl', (w / 1056).toFixed(4));
    }
  }

  function render(budget) {
    state = S.run(ROWS, budget);
    const st = state;
    $('budgetOut').textContent = money(budget);
    $('budget').value = budget;
    $('budget').setAttribute('aria-valuetext', money(budget) + ' a month');
    const pct = ((budget - S.BUDGET.min) / (S.BUDGET.max - S.BUDGET.min)) * 100;
    $('scale').style.setProperty('--pct-n', (pct / 100).toFixed(4));
    $('tally').innerHTML = `<span class="t in"><b class="num">${st.meets.length}</b> meet<span class="long">&nbsp;every requirement</span></span><span class="t confirm"><b class="num">${st.confirm.length}</b> to confirm</span><span class="t out"><b class="num">${st.excluded.length}</b> excluded</span>`;
    const pdf = $('pdf');
    pdf.href = `pdf/sample-survey-${budget}.pdf`;
    pdf.setAttribute('download', `sample-survey-${budget}.pdf`);
    pdf.innerHTML = `Download PDF <span>${st.pages} pages, US Letter</span>`;
    $('desk').innerHTML = cover(st) + matrix(st) + st.meets.map(r => spacePage(st, r)).join('');
    review(st);
    scaleMarks(st);
    $('change').textContent = changeNote(st, prev);
    prev = st;
    document.documentElement.dataset.pages = st.pages;
    const u = new URL(location.href);
    u.searchParams.set('budget', budget);
    history.replaceState(null, '', u);
  }

  function snap(v) {
    const { min, max, step } = S.BUDGET;
    return Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
  }

  async function init() {
    const text = await (await fetch('sample-listings.csv')).text();
    ROWS = S.parseCSV(text);
    const input = $('budget');
    input.min = S.BUDGET.min; input.max = S.BUDGET.max; input.step = S.BUDGET.step;
    const q = Number(new URLSearchParams(location.search).get('budget'));
    scaleTicks();
    fitSheets();
    render(q ? snap(q) : S.BUDGET.initial);
    input.addEventListener('input', () => render(snap(Number(input.value))));
    window.addEventListener('resize', () => { fitSheets(); scaleMarks(state); });
    window.SurveyState = () => ({
      budget: state.budget, pages: state.pages,
      meets: state.meets.map(r => ({ name: r.offer.name, rank: r.rank, monthly: r.cost.monthly, margin: r.margin })),
      confirm: state.confirm.map(r => r.offer.name),
      excluded: state.excluded.map(r => ({ name: r.offer.name, why: r.sentence })),
    });
    window.setBudget = b => render(snap(b));
    document.documentElement.dataset.ready = '1';
  }
  init();
})();
