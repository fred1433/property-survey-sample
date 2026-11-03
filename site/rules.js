/* Survey rules. Pure functions, no network, no model calls.
   Input: the sample listings CSV (assumed column layout) and a tenant request.
   Output: one result per distinct offer: meets / confirm / excluded, with reasons built from the current values. */
(function (root) {
  'use strict';

  const REQUEST = {
    label: 'Example tenant (fictional)',
    use: 'Warehouse and light assembly',
    minSF: 8000,
    maxSF: 12000,
    submarket: 'Southwest',
    minDH: 1,
    minGL: 1,
    availableBy: '2027-03-01',
    prepared: '2026-11-03',
  };
  const BUDGET = { min: 10000, max: 20000, step: 500, initial: 16000 };

  /* ---------- formatting ---------- */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function fmtInt(n) { return Math.round(n).toLocaleString('en-US'); }
  function money(n) { return '$' + fmtInt(n); }
  function rate(n) { return '$' + n.toFixed(2); }
  function fmtDate(iso, long) {
    if (!iso) return '';
    if (/^now$/i.test(iso)) return 'Now';
    const [y, m, d] = iso.split('-').map(Number);
    return (long ? LONG_MONTHS : MONTHS)[m - 1] + ' ' + d + ', ' + y;
  }
  function pct(part, whole) { return Math.round((part / whole) * 100); }

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    const rows = []; let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    const head = rows.shift().map(h => h.trim());
    return rows
      .filter(r => r.some(v => v.trim() !== ''))
      .map((r, i) => {
        const o = { row: i + 1 };
        head.forEach((h, j) => { o[h] = (r[j] == null ? '' : r[j]).trim(); });
        return o;
      });
  }

  const COMPARED = ['Building', 'Suite', 'Submarket', 'Space SF', 'Office SF', 'Lease Type', 'Sublease Expires', 'Use Restriction',
    'Asking Rent', 'Rent Basis', 'Expenses', 'Expenses Basis', 'Available', 'Dock-High Doors', 'Grade-Level Doors',
    'Clear Height (ft)', 'Power', 'Warehouse Cooling', 'Sprinklers', 'Yard / Parking', 'Year Built', 'Zoning (as listed)', 'Listing Broker'];

  function numOrNull(v) {
    if (v == null || v === '') return null;
    const n = Number(String(v).replace(/[$,]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  /* Read the rent of one row. A period is converted only when the row states it. */
  function readRent(r) {
    const raw = r['Asking Rent'], basis = r['Rent Basis'] || '';
    const regime = (basis.match(/NNN|Modified Gross|Gross/) || [null])[0];
    const v = numOrNull(raw);
    if (v == null) return { missing: true, raw: raw || 'blank' };
    if (/\/SF\/mo/.test(basis)) return { perMonth: v, regime, quoted: null };
    if (/\/SF\/yr/.test(basis)) return { perMonth: Math.round((v / 12) * 10000) / 10000, regime, quoted: rate(v) + '/SF/yr ' + (regime || '') };
    return { periodUnknown: true, raw };
  }

  /* ---------- grouping: exact repeats, same space on different terms, conflicting rows ---------- */
  function buildOffers(rows) {
    const groups = new Map();
    for (const r of rows) {
      const key = [r['Building'], r['Suite'], r['Space SF'], r['Lease Type'], r['Use Restriction']].join('|');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    const offers = [];
    for (const list of groups.values()) {
      const signatures = new Map();
      for (const r of list) {
        const sig = COMPARED.map(c => r[c]).join('\u0001') + '\u0001' + r['Source Date'];
        if (!signatures.has(sig)) signatures.set(sig, []);
        signatures.get(sig).push(r);
      }
      const variants = [...signatures.values()].map(v => v[0]);
      const base = variants[0];
      const conflicts = [];
      if (variants.length > 1) {
        for (const c of COMPARED) {
          const vals = [...new Set(variants.map(v => v[c]))];
          if (vals.length > 1) conflicts.push({ field: c, rows: variants.map(v => ({ row: v.row, value: v[c], date: v['Source Date'] })) });
        }
      }
      const repeats = [...signatures.values()].filter(v => v.length > 1).map(v => v.map(x => x.row));
      offers.push(makeOffer(base, list.map(r => r.row), variants, conflicts, repeats));
    }
    // Same suite offered on other terms (e.g. storage only): link them, keep them distinct.
    for (const o of offers) {
      o.siblings = offers.filter(p => p !== o && p.building === o.building && p.suite === o.suite);
      o.buildingMates = offers.filter(p => p !== o && p.building === o.building && p.suite !== o.suite);
    }
    return offers;
  }

  function makeOffer(r, rows, variants, conflicts, repeats) {
    const rents = variants.map(readRent);
    const sf = numOrNull(r['Space SF']);
    const office = numOrNull(r['Office SF']);
    const exp = numOrNull(r['Expenses']);
    const dh = numOrNull(r['Dock-High Doors']);
    const gl = numOrNull(r['Grade-Level Doors']);
    const letter = (r['Building'].match(/Building (\w+)$/) || [null, '?'])[1];
    const o = {
      id: rows.join('-'),
      rows, repeats, conflicts, variants,
      building: r['Building'], suite: r['Suite'], letter,
      name: r['Building'] + ', Suite ' + r['Suite'],
      submarket: r['Submarket'], sf, office,
      officePct: sf && office != null ? pct(office, sf) : null,
      lease: r['Lease Type'], subleaseTo: r['Sublease Expires'] || null,
      useRestriction: r['Use Restriction'] || null,
      rents, expenses: exp, expensesBasis: r['Expenses Basis'],
      available: r['Available'], dh, gl,
      clear: numOrNull(r['Clear Height (ft)']), power: r['Power'], cooling: r['Warehouse Cooling'],
      sprinklers: r['Sprinklers'], yard: r['Yard / Parking'], yearBuilt: r['Year Built'],
      zoning: r['Zoning (as listed)'], broker: r['Listing Broker'],
      sourceDates: variants.map(v => v['Source Date']),
    };
    o.costs = costOptions(o);
    return o;
  }

  /* Estimated monthly base rent + stated expenses, one value per quoted rent. Nothing missing becomes zero. */
  function costOptions(o) {
    if (o.sf == null || o.expenses == null) return [];
    const out = [];
    for (const rt of o.rents) {
      if (rt.perMonth == null) return [];
      const base = Math.round(o.sf * rt.perMonth * 100) / 100;
      const exp = Math.round(o.sf * o.expenses * 100) / 100;
      out.push({ rentPerMonth: rt.perMonth, quoted: rt.quoted, regime: rt.regime, base, exp, monthly: base + exp, annual: (base + exp) * 12 });
    }
    return out;
  }

  function loading(o) {
    const d = o.dh == null ? '? DH' : o.dh + ' DH';
    const g = o.gl == null ? '? GL' : o.gl + ' GL';
    return d + ' / ' + g;
  }

  /* ---------- evaluation against the request and the current budget ---------- */
  function evaluate(o, budget, req, all) {
    const fails = [], unknowns = [], notes = [];
    if (o.submarket !== req.submarket) fails.push('In ' + o.submarket + '; the request requires ' + req.submarket + '.');
    if (o.sf != null && o.sf < req.minSF) {
      let t = fmtInt(o.sf) + ' SF is below the ' + fmtInt(req.minSF) + ' SF minimum.';
      const mates = o.buildingMates.filter(m => m.sf != null && m.sf < req.minSF);
      if (mates.length) t += ' Suites ' + [o.suite, ...mates.map(m => m.suite)].sort().join(' and ') + ' are listed separately and are not added together.';
      fails.push(t);
    }
    if (o.sf != null && o.sf > req.maxSF) fails.push(fmtInt(o.sf) + ' SF is above the ' + fmtInt(req.maxSF) + ' SF maximum.');
    if (o.useRestriction) {
      let t = 'Offered for "' + o.useRestriction.toLowerCase() + '"; the request is for ' + req.use.toLowerCase() + ' use.';
      const other = o.siblings.filter(s => !s.useRestriction);
      if (other.length) t += ' Kept apart from the ' + other[0].lease.toLowerCase() + ' offer on the same suite (row ' + other[0].rows[0] + ').';
      fails.push(t);
    }
    if (o.dh == null) unknowns.push('Dock-high door count is blank in the source row; not assumed present or absent.');
    else if (o.dh < req.minDH) fails.push('No dock-high door (' + loading(o) + '); the request needs at least ' + req.minDH + '.');
    if (o.gl == null) unknowns.push('Grade-level door count is blank in the source row; not assumed present or absent.');
    else if (o.gl < req.minGL) fails.push('No grade-level door (' + loading(o) + '); the request needs at least ' + req.minGL + '.');
    if (!/^now$/i.test(o.available) && o.available > req.availableBy) fails.push('Available ' + fmtDate(o.available) + ', after the ' + fmtDate(req.availableBy) + ' deadline.');

    for (const rt of o.rents) {
      if (rt.missing) unknowns.push('Asking rent is "' + rt.raw + '", so the monthly cost cannot be checked against the budget. It is not counted as $0.');
      if (rt.periodUnknown) unknowns.push('Rent of ' + rt.raw + ' has no stated period; not converted.');
    }
    if (o.expenses == null) unknowns.push('Expenses are blank in the source row; the monthly cost is incomplete.');
    const rentConflict = o.conflicts.find(c => c.field === 'Asking Rent');
    if (rentConflict) {
      unknowns.push('Rows ' + rentConflict.rows.map(x => x.row).join(' and ') + ' quote ' +
        rentConflict.rows.map(x => rate(Number(x.value)) + ' (' + fmtDate(x.date) + ')').join(' and ') +
        ' per SF per month for the same offer. The newer figure is not assumed to be right.');
    }
    const otherConflicts = o.conflicts.filter(c => c.field !== 'Asking Rent');
    for (const c of otherConflicts) unknowns.push('Rows ' + c.rows.map(x => x.row).join(' and ') + ' disagree on ' + c.field.toLowerCase() + '.');

    // Budget: a known cost above the budget excludes; with two quoted rents, only if both are above.
    let budgetLine = null;
    if (o.costs.length) {
      const lo = Math.min(...o.costs.map(c => c.monthly)), hi = Math.max(...o.costs.map(c => c.monthly));
      if (lo > budget) {
        fails.push(o.costs.length > 1
          ? 'Estimated ' + money(lo) + ' or ' + money(hi) + ' a month; over the ' + money(budget) + ' budget at either quoted rent.'
          : 'Estimated ' + money(lo) + ' a month, ' + money(lo - budget) + ' over the ' + money(budget) + ' budget.');
      } else if (o.costs.length > 1) {
        budgetLine = 'Estimated ' + money(lo) + ' or ' + money(hi) + ' a month: ' + (hi <= budget ? 'within budget at either rent.' : 'within budget only at the lower rent.');
      } else {
        budgetLine = 'Estimated ' + money(lo) + ' a month, within the ' + money(budget) + ' budget.';
      }
    }

    let status = fails.length ? 'excluded' : unknowns.length ? 'confirm' : 'meets';
    const cost = o.costs.length === 1 ? o.costs[0] : null;

    // Reserves kept with a presented space.
    if (o.lease === 'Sublease') notes.push('Sublease through ' + fmtDate(o.subleaseTo) + ', as listed.');
    for (const c of o.costs) if (c.quoted) notes.push('Rent listed as ' + c.quoted.trim() + '; shown as ' + rate(c.rentPerMonth) + '/SF/mo because the listing states the period.');
    for (const rep of o.repeats) notes.push('Listed ' + (rep.length === 2 ? 'twice' : rep.length + ' times') + ' in the source file with identical terms (rows ' + rep.join(' and ') + '); counted once.');
    for (const s of o.siblings) if (s.useRestriction) notes.push('The same suite is also offered as "' + s.useRestriction.toLowerCase() + '" at a lower rent (row ' + s.rows[0] + '). That offer does not fit the stated use and is excluded.');
    notes.push('Availability as stated in a source dated ' + fmtDate(o.sourceDates[0]) + '; not confirmed with the listing broker.');
    notes.push('Zoning as listed: ' + o.zoning + '. Whether the tenant’s use is permitted has not been checked.');

    let sentence;
    if (status === 'meets') {
      const margin = budget - cost.monthly;
      sentence = 'Meets the stated size, submarket, use, loading and availability requirements; estimated monthly base rent + stated expenses is ' +
        money(cost.monthly) + (margin === 0 ? ', exactly the ' + money(budget) + ' budget.' : ', ' + money(margin) + ' under the ' + money(budget) + ' budget.');
    } else if (status === 'confirm') {
      sentence = unknowns.join(' ') + (budgetLine ? ' ' + budgetLine : '');
    } else {
      sentence = fails.join(' ');
    }
    // Short form for the printed lists: the first reason, first sentence, plus the budget line for spaces to confirm.
    const first = t => (t || '').split(/(?<=\.)\s/)[0];
    const compact = t => first(t)
      .replace(/^Estimated (\$[\d,]+) a month, (\$[\d,]+) over the \$[\d,]+ budget\.$/, '$1 a month, $2 over budget.')
      .replace(/^Estimated (\$[\d,]+) or (\$[\d,]+) a month; over the \$[\d,]+ budget at either quoted rent\.$/, '$1 or $2 a month, over budget at either quoted rent.')
      .replace(/^In (.+); the request requires (.+)\.$/, 'In $1, outside $2.');
    const short = status === 'excluded' ? compact(fails[0]) : status === 'confirm' ? first(unknowns[0]) + (budgetLine ? ' ' + budgetLine : '') : sentence;
    return { offer: o, status, fails, unknowns, notes, budgetLine, cost, sentence, short, margin: cost ? budget - cost.monthly : null };
  }

  function run(rows, budget, req) {
    req = req || REQUEST;
    const offers = buildOffers(rows);
    const results = offers.map(o => evaluate(o, budget, req, offers));
    const meets = results.filter(r => r.status === 'meets').sort((a, b) => a.cost.monthly - b.cost.monthly || a.offer.rows[0] - b.offer.rows[0]);
    meets.forEach((r, i) => { r.rank = i + 1; });
    const confirm = results.filter(r => r.status === 'confirm');
    const excluded = results.filter(r => r.status === 'excluded');
    // Lowest-cost space that passes every check except the budget (for the empty state).
    const nearMiss = results
      .filter(r => r.status === 'excluded' && r.fails.length === 1 && !r.unknowns.length && r.cost && /budget/.test(r.fails[0]))
      .sort((a, b) => a.cost.monthly - b.cost.monthly)[0] || null;
    return { budget, req, rows, offers, results, meets, confirm, excluded, nearMiss, pages: 2 + meets.length };
  }

  const api = { REQUEST, BUDGET, parseCSV, run, money, rate, fmtInt, fmtDate, loading };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SurveyRules = api;
})(this);
