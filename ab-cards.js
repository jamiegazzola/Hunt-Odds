// ── BUILD AGGREGATED CARDS ──
function buildABCards() {
  if (_abAllCardsCache) return _abAllCardsCache;
  const groups = {};
  for (const r of AB_DATA) {
    const key = r.species + '||' + r.wmu + '||' + r.draw;
    if (!groups[key]) groups[key] = { species:r.species, wmu:r.wmu, draw:r.draw, rows:[] };
    groups[key].rows.push(r);
  }

  // Only show draws active in the most recent year present in the dataset
  let globalMaxYear = 0;
  for (const r of AB_DATA) { if (r.year > globalMaxYear) globalMaxYear = r.year; }

  const result = Object.values(groups).map(g => {
    // Only show draws active in the most recent year of the dataset with a real quota
    const hasRecentQuota = g.rows.some(r => r.year === globalMaxYear && r.quota > 0);
    if (!hasRecentQuota) return null;
    const priorityKey = getAbPriorityKey(g.draw, g.species);
    const userPts = (abProfile && priorityKey) ? parseInt(abProfile.priorities[priorityKey]) : NaN;

    // Aggregate per year
    const byYear = {};
    for (const r of g.rows) {
      if (!byYear[r.year]) byYear[r.year] = { drawn:0, total:0, quota:r.quota, season:r.season, rows:[] };
      byYear[r.year].drawn += r.drawApplicants;
      byYear[r.year].total += r.totalApplicants;
      if (r.quota > byYear[r.year].quota) byYear[r.year].quota = r.quota;
      if (r.season && r.season !== '1') byYear[r.year].season = r.season;
      byYear[r.year].rows.push(r);
    }

    const years = Object.keys(byYear).map(Number).sort((a,b) => b-a);
    const latestYear = globalMaxYear; // always show current year only
    const latestAgg = byYear[latestYear] || byYear[years[0]]; // fallback shouldn't happen after filter
    const latestOdds = latestAgg.total > 0 ? (latestAgg.drawn / latestAgg.total * 100) : 0;

    // Historical odds by year (aggregate)
    const histYears = years.map(y => ({
      year: y,
      odds: byYear[y].total > 0 ? (byYear[y].drawn / byYear[y].total * 100) : 0,
      drawn: byYear[y].drawn,
      total: byYear[y].total,
      quota: byYear[y].quota,
    })).sort((a,b) => a.year - b.year);

    // Weighted avg success (all years)
    const wavg = histYears.length > 0 ? histYears.reduce((s,h) => s + h.odds, 0) / histYears.length : 0;

    // Min points to draw in latest year
    const drawnRows = latestAgg.rows.filter(r => r.drawApplicants > 0).sort((a,b) => a.pointBalance - b.pointBalance);
    const minPtsToDraw = drawnRows.length > 0 ? drawnRows[0].pointBalance : null;

    // Personalized odds at user's point level
    let personalOdds = null;
    let personalRow = null;
    if (!isNaN(userPts) && userPts >= 0) {
      const exact = latestAgg.rows.find(r => r.pointBalance === userPts);
      if (exact) { personalOdds = exact.pctDrawn; personalRow = exact; }
      else {
        // Find best row at or below user's points that had draws
        const below = latestAgg.rows.filter(r => r.pointBalance <= userPts && r.drawApplicants > 0)
          .sort((a,b) => b.pointBalance - a.pointBalance);
        if (below.length > 0) { personalOdds = below[0].pctDrawn; personalRow = below[0]; }
        else personalOdds = 0;
      }
    }

    // Threshold comparison
    let thresholdStatus = 'no_data';
    if (minPtsToDraw !== null && !isNaN(userPts) && userPts >= 0) {
      if (userPts > minPtsToDraw) thresholdStatus = 'above';
      else if (userPts === minPtsToDraw) thresholdStatus = 'at';
      else thresholdStatus = 'below';
    } else if (minPtsToDraw !== null && isNaN(userPts)) {
      thresholdStatus = 'no_profile';
    }

    // Point breakdown for latest year (for expanded card table)
    // Group by pointBalance to merge duplicate rows at same pt level
    const ptMap = {};
    for (const r of latestAgg.rows) {
      if (r.totalApplicants <= 0 && r.drawApplicants <= 0) continue;
      if (!ptMap[r.pointBalance]) ptMap[r.pointBalance] = { pointBalance: r.pointBalance, totalApplicants: 0, drawApplicants: 0 };
      ptMap[r.pointBalance].totalApplicants += r.totalApplicants;
      ptMap[r.pointBalance].drawApplicants += r.drawApplicants;
    }
    const ptBreakdown = Object.values(ptMap)
      .map(r => ({ ...r, pctDrawn: r.totalApplicants > 0 ? (r.drawApplicants / r.totalApplicants * 100) : 0 }))
      .sort((a,b) => b.pointBalance - a.pointBalance);

    // Yearly odds object for line chart { '2022': 10.5, '2023': 8.2, ... }
    const yearlyOddsObj = {};
    histYears.forEach(h => { yearlyOddsObj[h.year] = h.odds; });

    const successRate = latestOdds / 100;
    const harvestKey = `${g.species}||${g.draw}||${g.wmu}`;
    const harvestRec = (AB_HARVEST && harvestKey in AB_HARVEST) ? AB_HARVEST[harvestKey] : null;
    const harvestSuccess = harvestRec !== null ? harvestRec.pct : null;
    const harvestParticipants = harvestRec !== null ? harvestRec.participants : null;

    return {
      species: g.species, wmu: g.wmu, draw: g.draw,
      season: latestAgg.season, quota: latestAgg.quota,
      latestYear, latestOdds, personalOdds, personalRow,
      avgOdds: wavg, histYears, yearlyOddsObj,
      minPtsToDraw, ptBreakdown,
      thresholdStatus, priorityKey, userPts,
      numYears: years.length,
      harvestSuccess, harvestParticipants,
    };
  }).filter(Boolean);
  _abAllCardsCache = result;
  return result;
}

// ── CARD RENDERING ──
function abOddsClass(pct) {
  if (pct >= 20) return 'green';
  if (pct >= 5)  return 'yellow';
  return 'red';
}
function abFmt(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return (v >= 10 ? Math.round(v) : v.toFixed(1)) + '%';
}

let abExpandedCards = new Set();

function abToggleCard(idx) {
  const el = document.getElementById('ab-expand-' + idx);
  const btn = document.getElementById('ab-expbtn-' + idx);
  if (!el) return;
  const open = el.classList.contains('open');
  if (open) { el.classList.remove('open'); if (btn) btn.textContent = '▾ Show details'; }
  else {
    // Fill expand content lazily the first time it opens
    const c = abLastFilteredCards[idx];
    if (c) abFillExpandContent(idx, c);
    el.classList.add('open'); if (btn) btn.textContent = '▴ Hide details';
  }
}

function abRenderCards(cards) {
  const grid = document.getElementById('abCardsGrid');
  if (!grid) return;
  const countEl = document.getElementById('abCountDisplay');
  if (countEl) countEl.textContent = cards.length.toLocaleString();

  // Inject view toggle button into topbar if not present
  if (!document.getElementById('abViewToggleBtn')) {
    const topbar = document.querySelector('.draws-topbar');
    if (topbar) {
      const btn = document.createElement('button');
      btn.id = 'abViewToggleBtn';
      btn.title = 'Switch to list view';
      btn.onclick = abToggleView;
      btn.style.cssText = 'display:flex;align-items:center;gap:5px;padding:7px 12px;background:var(--bg-secondary);border:1.5px solid var(--border);border-radius:8px;color:var(--text-secondary);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:color .15s,border-color .15s';
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg> List`;
      btn.onmouseenter = () => { btn.style.color = 'var(--text-primary)'; btn.style.borderColor = 'var(--text-muted)'; };
      btn.onmouseleave = () => { btn.style.color = 'var(--text-secondary)'; btn.style.borderColor = 'var(--border)'; };
      topbar.appendChild(btn);
    }
  }

  if (cards.length === 0) {
    grid.innerHTML = '<div class="empty"><div class="empty-title">No draws match your filters</div><p>Try adjusting species, WMU, or odds.</p></div>';
    return;
  }

  // ── Build card shell HTML (no expand content — rendered lazily on open) ──
  function buildAbCardShell(c, i) {
    const displayOdds = c.personalOdds !== null ? c.personalOdds : c.latestOdds;
    const cls = abOddsClass(displayOdds);
    const isPersonal = c.personalOdds !== null;

    const histAvg = computeABHarvestAvgCached(c.species, c.wmu);
    const histAvgFmt = histAvg !== null ? histAvg + '%' : null;
    const histAvgCls = histAvg !== null ? (histAvg >= 50 ? 'fill-high' : histAvg >= 25 ? 'fill-mid' : 'fill-low') : null;
    const harvestBadgeVisible = histAvgFmt !== null
      ? `<span class="fill-badge ${histAvgCls}"><span class="fill-pct">${histAvgFmt}</span><span class="fill-sub">&nbsp;Harvest Success Rate</span></span>`
      : `<span class="fill-badge fill-none"><span class="fill-sub">No Harvest Data</span></span>`;

    const threshBadge = (() => {
      if (!abProfile) return '';
      const colors = { above:'#4ade80', at:'#facc15', below:'#f87171', no_data:'#6b7a8d', no_profile:'#6b7a8d' };
      const labels = { above:'Above Point Threshold', at:'At Point Threshold', below:'Below Point Threshold', no_data:'No threshold data', no_profile:'Set your pts' };
      const col = colors[c.thresholdStatus] || '#6b7a8d';
      const lbl = labels[c.thresholdStatus] || '';
      return `<span style="font-size:10px;font-weight:600;color:${col};margin-top:3px;display:block">${lbl}</span>`;
    })();

    const abClassLabel = (() => {
      const d = (c.draw || '').toLowerCase();
      if (d.includes('antlerless')) return 'Antlerless';
      if (d.includes('antlered')) return 'Antlered';
      return 'Any';
    })();

    return `<div class="card ${cls}" style="position:relative;cursor:pointer" data-abidx="${i}" onclick="abToggleCard(${i})">
  <button class="star-btn ${abIsStarred(c) ? 'starred' : ''}" data-abidx="${i}" onclick="event.stopPropagation();abToggleStar(${i})" title="Save draw" style="${abIsStarred(c) ? '' : 'opacity:.55'}">★</button>
  <div class="card-header">
    <div style="flex:1;min-width:0">
      <div class="card-species">${c.species}</div>
      <div class="card-class">${abClassLabel}&nbsp;·&nbsp;WMU ${c.wmu}</div>
      ${harvestBadgeVisible}
      ${threshBadge}
    </div>
    <div class="odds-badge" style="flex-shrink:0">
      <div class="odds-pct">${abFmt(displayOdds)}</div>
      <div class="odds-ratio">${isPersonal ? `${c.userPts} pt${c.userPts === 1 ? '' : 's'} odds` : c.latestYear}</div>
    </div>
  </div>
  <div class="card-info">
    <div class="ci"><div class="ci-label">Draw</div><div class="ci-val hl">${c.draw}</div></div>
    <div class="ci"><div class="ci-label">WMU</div><div class="ci-val">${c.wmu}</div></div>
    ${c.season && c.season !== '1' ? `<div class="ci"><div class="ci-label">Season</div><div class="ci-val">${c.season}</div></div>` : ''}
    ${c.minPtsToDraw !== null ? `<div class="ci"><div class="ci-label">Min Pts (${c.latestYear})</div><div class="ci-val">${c.minPtsToDraw} pts</div></div>` : ''}
  </div>
  <button class="expand-toggle" id="ab-expbtn-${i}" onclick="event.stopPropagation();abToggleCard(${i})">▾ Show details</button>
  <button class="dd-open-btn" onclick="event.stopPropagation();openABDrawDetail(${i})">View Full Page →</button>
  <div class="card-expand" id="ab-expand-${i}"><div class="ab-expand-placeholder" style="padding:12px;color:var(--text-muted);font-size:12px">Loading details…</div></div>
</div>`;
  }

  // ── Chunked render — paint first 30 cards immediately, rest in batches ──
  const CHUNK = 30;
  const first = cards.slice(0, CHUNK);
  grid.innerHTML = first.map((c, i) => buildAbCardShell(c, i)).join('');

  if (cards.length > CHUNK) {
    let offset = CHUNK;
    function renderNextChunk() {
      if (offset >= cards.length) return;
      const batch = cards.slice(offset, offset + CHUNK);
      const frag = document.createDocumentFragment();
      const tmp = document.createElement('div');
      tmp.innerHTML = batch.map((c, j) => buildAbCardShell(c, offset + j)).join('');
      while (tmp.firstChild) frag.appendChild(tmp.firstChild);
      grid.appendChild(frag);
      offset += CHUNK;
      if (offset < cards.length) requestAnimationFrame(renderNextChunk);
    }
    requestAnimationFrame(renderNextChunk);
  }

  // Re-apply current view mode after re-render
  if (abViewMode === 'list') {
    grid.style.gridTemplateColumns = '1fr';
    // In list mode expand all cards lazily
    requestAnimationFrame(() => {
      cards.forEach((c, i) => {
        const el = document.getElementById('ab-expand-' + i);
        if (el) {
          el.classList.add('open');
          abFillExpandContent(i, c);
        }
        const b = document.getElementById('ab-expbtn-' + i);
        if (b) b.textContent = '▴ Hide details';
      });
    });
  }
}

// ── Lazy expand content — only built when a card is actually opened ──
function abFillExpandContent(idx, c) {
  const el = document.getElementById('ab-expand-' + idx);
  if (!el || el.dataset.filled) return; // already filled
  el.dataset.filled = '1';

  const harvestFmt = c.harvestSuccess !== null
    ? (c.harvestSuccess >= 10 ? Math.round(c.harvestSuccess) : c.harvestSuccess.toFixed(1)) + '%' : null;

  const ptTable = c.ptBreakdown.length > 0 ? `
    <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
      <div class="chart-label" style="margin-bottom:8px">Point level breakdown — ${c.latestYear}</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="border-bottom:1px solid var(--border)">
          <th style="text-align:left;color:var(--text-muted);padding:4px 6px;font-weight:600">Pts</th>
          <th style="text-align:right;color:var(--text-muted);padding:4px 6px;font-weight:600">Applied</th>
          <th style="text-align:right;color:var(--text-muted);padding:4px 6px;font-weight:600">Drew</th>
          <th style="text-align:right;color:var(--text-muted);padding:4px 6px;font-weight:600">Odds</th>
        </tr></thead>
        <tbody>${c.ptBreakdown.map(r => {
          const isUser = !isNaN(c.userPts) && r.pointBalance === c.userPts;
          return `<tr style="${isUser?'background:rgba(74,222,128,.1)':''}">
            <td style="padding:5px 6px;color:${isUser?'#4ade80':'var(--text-primary)'};font-weight:${isUser?'700':'400'}">${r.pointBalance}${isUser?' ★':''}</td>
            <td style="text-align:right;padding:5px 6px;color:var(--text-secondary)">${r.totalApplicants.toLocaleString()}</td>
            <td style="text-align:right;padding:5px 6px;color:var(--text-secondary)">${r.drawApplicants.toLocaleString()}</td>
            <td style="text-align:right;padding:5px 6px;font-weight:600;color:${r.pctDrawn>=20?'#4ade80':r.pctDrawn>=5?'#facc15':'#f87171'}">${abFmt(r.pctDrawn)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>` : '';

  const nYrs = c.histYears.length;
  const oddsChart = nYrs >= 2 ? `
    <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
      ${buildOddsLineChart(c.yearlyOddsObj, 'ab'+idx, c.avgOdds)}
      <div class="chart-label">Draw odds % by year · <span style="color:#4a7fd4">- - -</span> ${abFmt(c.avgOdds)} weighted avg</div>
    </div>` : '';

  function histChart(histData, labelId) {
    if (!histData) return '';
    const entries = Object.entries(histData).sort((a,b) => +a[0] - +b[0]);
    if (entries.length < 2) return '';
    const avg = Math.round(entries.reduce((s,[,v])=>s+v,0)/entries.length);
    const oddsObj = Object.fromEntries(entries);
    return `<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
      ${buildGreenBarChart(oddsObj, labelId)}
      <div class="chart-label">Last 10 years of harvest data · <span style="color:#4ade80">AVG ${avg}%</span></div>
    </div>`;
  }

  const s = (c.species||'').toLowerCase();
  const elkH = s === 'elk' ? histChart(AB_ELK_HISTORY?.[c.wmu], 'elkh'+idx) : '';
  const mooseH = s === 'moose' ? histChart(AB_MOOSE_HISTORY?.[c.wmu], 'moosehist'+idx) : '';
  const muleDeerH = ['mule deer','muledeer','mule_deer'].includes(s) ? histChart(AB_MULEDEER_HISTORY?.[c.wmu], 'muledeerhist'+idx) : '';
  const antelopeH = ['antelope','pronghorn','pronghorn antelope'].includes(s) ? histChart(AB_ANTELOPE_HISTORY?.[c.wmu], 'antelopehist'+idx) : '';
  const wtDeerH = ['white-tailed deer','white tailed deer','whitetail','whitetailed deer','white-tail'].includes(s) ? histChart(AB_WTDEER_HISTORY?.[c.wmu], 'wtdeerhist'+idx) : '';
  const bisonH = (() => {
    if (!s.includes('bison') || !AB_BISON_HISTORY || AB_BISON_HISTORY.length < 2) return '';
    const avg = Math.round(AB_BISON_HISTORY.reduce((a,r)=>a+r.pct,0)/AB_BISON_HISTORY.length);
    const oddsObj = Object.fromEntries(AB_BISON_HISTORY.map(r=>[r.season, r.pct]));
    return `<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
      ${buildGreenBarChart(oddsObj, 'bisonhist'+idx)}
      <div class="chart-label">Last 10 years of harvest data (open seasons) · <span style="color:#4ade80">AVG ${avg}%</span></div>
    </div>`;
  })();

  const catDef = AB_PRIORITY_CATS.find(x => x.key === c.priorityKey);
  const catLabel = catDef ? catDef.label : 'Category not mapped';
  const userPtsLabel = abProfile && c.priorityKey
    ? (!isNaN(c.userPts) && c.userPts >= 0
      ? `<div class="ei"><div class="ei-label">Your Priority (${catLabel})</div><div class="ei-val" style="color:#4ade80">${c.userPts} pts</div></div>`
      : `<div class="ei"><div class="ei-label">Your Priority</div><div class="ei-val" style="color:var(--text-muted)">Not set — <a href="#" onclick="event.stopPropagation();event.preventDefault();showPage('abProfile')" style="color:#4a7fd4">edit profile</a></div></div>`)
    : '';
  const minPtsLabel = c.minPtsToDraw !== null
    ? `<div class="ei"><div class="ei-label">Min pts to draw (${c.latestYear})</div><div class="ei-val">${c.minPtsToDraw} pts</div></div>` : '';
  const seasonLine = c.season && c.season !== '1'
    ? `<div class="ei"><div class="ei-label">Season</div><div class="ei-val">${c.season}</div></div>` : '';

  el.innerHTML = `
    <div class="expand-grid">
      <div class="ei"><div class="ei-label">Draw Code</div><div class="ei-val">${c.draw}</div></div>
      <div class="ei"><div class="ei-label">WMU</div><div class="ei-val">${c.wmu}</div></div>
      <div class="ei"><div class="ei-label">Latest Odds (${c.latestYear})</div><div class="ei-val">${abFmt(c.latestOdds)}</div></div>
      <div class="ei"><div class="ei-label">Quota (${c.latestYear})</div><div class="ei-val">${c.quota}</div></div>
      ${seasonLine}${minPtsLabel}
      ${c.harvestSuccess !== null ? `<div class="ei"><div class="ei-label">2024 Special Licence Harvest Success Rate</div><div class="ei-val" style="color:${c.harvestSuccess>=50?'#4ade80':c.harvestSuccess>=25?'#facc15':'#f87171'}">${harvestFmt}${c.harvestParticipants ? ` <span style="font-size:10px;font-weight:400;color:var(--text-muted)">(${c.harvestParticipants.toLocaleString()} tags)</span>` : ''}</div></div>` : ''}
      ${userPtsLabel}
    </div>
    ${oddsChart}${elkH}${mooseH}${muleDeerH}${antelopeH}${wtDeerH}${bisonH}${ptTable}`;
}


// ── AB APPLY FILTERS ──
function abApplyFilters() {
  if (AB_DATA.length === 0) return;
  const cards = buildABCards();
  const thresh = AB_ODDS_STEPS[abMinOdds] || 0;

  let results = cards.filter(c => {
    if (abSelSpecies.size > 0 && !abSelSpecies.has(c.species)) return false;
    if (abSelWMU.size > 0 && !abSelWMU.has(c.wmu)) return false;
    if (abSelClass.size > 0) {
      const d = (c.draw || '').toLowerCase();
      const match = [...abSelClass].some(cl => {
        if (cl === 'Antlered') return d.includes('antlered') && !d.includes('antlerless');
        if (cl === 'Antlerless') return d.includes('antlerless');
        if (cl === 'Any') return !d.includes('antlered') && !d.includes('antlerless');
        return false;
      });
      if (!match) return false;
    }
    const odds = c.personalOdds !== null ? c.personalOdds : c.latestOdds;
    if (odds < thresh) return false;
    if (abMinHarvest > 0) {
      const hv = computeABHarvestAvgCached(c.species, c.wmu);
      if (hv === null || hv < abMinHarvest) return false;
    }
    if (abProfileFilter === 'has_profile' && isNaN(c.userPts)) return false;
    if (abProfileFilter === 'above_threshold' && c.thresholdStatus !== 'above') return false;
    if (abProfileFilter === 'below_threshold' && c.thresholdStatus !== 'below') return false;
    return true;
  });

  if (abSortMode === 'odds') results.sort((a,b) => {
    const ao = a.personalOdds !== null ? a.personalOdds : a.latestOdds;
    const bo = b.personalOdds !== null ? b.personalOdds : b.latestOdds;
    return bo - ao;
  });
  else if (abSortMode === 'harvest') results.sort((a,b) => (b.harvestSuccess??-1)-(a.harvestSuccess??-1));
  else if (abSortMode === 'season') results.sort((a,b) => {
    function ss(s){if(!s||s==='1')return 9999;const m=s.match(/([A-Za-z]+)\s+(\d+)/);if(!m)return 9999;const mo={Aug:1,Sep:2,Oct:3,Nov:4,Dec:5,Jan:6,Feb:7,Mar:8,Apr:9,May:10,Jun:11,Jul:12};return (mo[m[1].substring(0,3)]||13)*100+parseInt(m[2]);}
    return ss(a.season)-ss(b.season);
  });
  else if (abSortMode === 'points') results.sort((a,b)=>(a.minPtsToDraw??9999)-(b.minPtsToDraw??9999));

  abLastFilteredCards = results;
  abRenderCards(results);
  abBuildClassChips();
  abBuildSidebarChips();
  abBuildWMUList();
  abUpdateOddsDisplay();
}

function abBuildClassChips() {
  const wrap = document.getElementById('abClassChips');
  if (!wrap) return;
  wrap.innerHTML = ['Antlered','Antlerless','Any'].map(c =>
    `<button class="chip ${abSelClass.has(c)?'active':''}" onclick="event.stopPropagation();abToggleClass('${c}')">${c}</button>`
  ).join('');
  const cl = document.getElementById('abClearClass');
  if (cl) cl.classList.toggle('visible', abSelClass.size > 0);
}
function abToggleClass(c) {
  abSelClass.has(c) ? abSelClass.delete(c) : abSelClass.add(c);
  abApplyFilters();
}

function abBuildSidebarChips() {
  const wrap = document.getElementById('abSpeciesChips');
  if (!wrap) return;
  const all = [...new Set(AB_DATA.map(r => r.species))].sort();
  wrap.innerHTML = all.map(s =>
    `<button class="chip ${abSelSpecies.has(s)?'active':''}" onclick="event.stopPropagation();abToggleSpecies('${s}')">${s}</button>`
  ).join('');
}
function abToggleSpecies(s) {
  abSelSpecies.has(s) ? abSelSpecies.delete(s) : abSelSpecies.add(s);
  abApplyFilters();
}
function abBuildWMUList() {
  const list = document.getElementById('abWMUList');
  if (!list) return;
  const wmus = [...new Set(AB_DATA.map(r => r.wmu))].sort((a,b)=>parseInt(a)-parseInt(b));
  const sel = abSelWMU.size === 1 ? [...abSelWMU][0] : '';

  // Map toggle button + panel injected above the dropdown
  // Preserve open state if map was already open before this re-render
  const panelWasOpen = abMapOpen;
  const mapPanelHtml = `
    <button id="abMapToggleBtn" onclick="abToggleMap()"
      style="width:100%;padding:8px 10px;margin-bottom:8px;background:${panelWasOpen ? 'rgba(74,222,128,.18)' : 'rgba(74,222,128,.08)'};border:1.5px solid rgba(74,222,128,.25);border-radius:8px;color:#4ade80;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:background .15s">
      ${panelWasOpen
        ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Close Map`
        : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg> Filter by Map`
      }
    </button>
    <div id="abMapPanel" style="display:${panelWasOpen ? 'block' : 'none'};margin-bottom:10px">
      <div id="abLeafletMap" style="height:320px;border-radius:10px;overflow:hidden;border:1.5px solid var(--border);position:relative;transition:outline .15s"><div id="abMapScrollHint" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:1000;opacity:0;transition:opacity .3s"><div style="background:rgba(0,0,0,.72);color:#fff;font-size:12px;font-weight:600;padding:7px 14px;border-radius:20px">Pinch or scroll to zoom</div></div></div>
      <div id="abMapChips" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;min-height:18px">
        <span style="font-size:11px;color:var(--text-muted)">Click zones to filter</span>
      </div>
    </div>`;

  list.innerHTML = mapPanelHtml + `<select onchange="abSelectWMU(this.value)"
    style="width:100%;padding:8px 10px;background:var(--bg-primary);border:1.5px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;cursor:pointer;margin-top:4px">
    <option value="">All WMUs</option>
    ${wmus.map(w=>`<option value="${w}" ${w===sel?'selected':''}>${w}</option>`).join('')}
  </select>`;

  // If map was open before re-render, re-init Leaflet into the fresh container
  if (panelWasOpen) {
    const container = document.getElementById('abLeafletMap');
    if (container && !container._leaflet_id) {
      // Container was replaced — must re-init Leaflet
      abMapInitialized = false;
      abLeafletMapInstance = null;
      abWmuGeoLayer = null;
      abInitLeafletMap();
    } else {
      setTimeout(() => abLeafletMapInstance && abLeafletMapInstance.invalidateSize(), 150);
    }
    abUpdateMapChips();
  }
}
function abSelectWMU(w) {
  abSelWMU.clear();
  if (w) abSelWMU.add(w);
  abUpdateMapStyles();
  abApplyFilters();
}
function abToggleWMU(w) {
  abSelWMU.has(w) ? abSelWMU.delete(w) : abSelWMU.add(w);
  abUpdateMapStyles();
  abApplyFilters();
}
function abOnSlider(v) {
  abMinOdds = parseInt(v);
  abUpdateOddsDisplay();
  abApplyFilters();
}
function abUpdateOddsDisplay() {
  const val = AB_ODDS_STEPS[abMinOdds]||0;
  const d=document.getElementById('abOddsDisplay'),u=document.getElementById('abOddsUnit'),s=document.getElementById('abOddsSubLabel');
  if(d) d.textContent = val===0?'Any':val+'%';
  if(u) u.textContent = val>0?'+':'';
  if(s) s.textContent = val===0?'All draws':'Min '+val+'% odds';
}

function abToggleView() {
  abViewMode = abViewMode === 'grid' ? 'list' : 'grid';
  const grid = document.getElementById('abCardsGrid');
  const btn = document.getElementById('abViewToggleBtn');
  if (!grid) return;

  if (abViewMode === 'list') {
    grid.style.gridTemplateColumns = '1fr';
    if (btn) {
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> Grid`;
      btn.title = 'Switch to grid view';
    }
    // Auto-expand all cards
    document.querySelectorAll('#abCardsGrid .card-expand').forEach((el, i) => {
      el.classList.add('open');
      const c = abLastFilteredCards[i];
      if (c) abFillExpandContent(i, c);
      const btn2 = document.getElementById('ab-expbtn-' + i);
      if (btn2) btn2.textContent = '▴ Hide details';
    });
  } else {
    grid.style.gridTemplateColumns = '';
    if (btn) {
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg> List`;
      btn.title = 'Switch to list view';
    }
    // Collapse all cards
    document.querySelectorAll('#abCardsGrid .card-expand').forEach((el, i) => {
      el.classList.remove('open');
      const btn2 = document.getElementById('ab-expbtn-' + i);
      if (btn2) btn2.textContent = '▾ Show details';
    });
  }
}

function abSetSort(mode) {
  abSortMode = mode;
  ['odds','harvest','season','points'].forEach(m => {
    const btn = document.getElementById('abSort'+m.charAt(0).toUpperCase()+m.slice(1)+'Btn');
    if(btn) btn.classList.toggle('active', m===mode);
  });
  abApplyFilters();
}
function abSidebarClearFilter(type) {
  if(type==='species') abSelSpecies.clear();
  if(type==='class') { abSelClass.clear(); abBuildClassChips(); }
  if(type==='wmu') { abSelWMU.clear(); abBuildWMUList(); }
  abApplyFilters();
}
function abResetAll() {
  abSelSpecies.clear(); abSelWMU.clear(); abMinOdds=0; abMinHarvest=0; abProfileFilter='all';
  const sl=document.getElementById('abOddsSlider'); if(sl) sl.value=0;
  abApplyFilters();
}

// ── PROFILE BANNER ──
function renderAbProfileBanner() {
  const el = document.getElementById('abProfileBanner');
  if (!el) return;
  if (!abProfile) {
    el.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:rgba(74,111,212,.12);border-bottom:1px solid rgba(74,111,212,.2)">
      <span style="font-size:12px;color:#7aa3f5">⚠ No Alberta profile set — results show aggregate odds</span>
      <button onclick="showPage('abProfile')" style="font-size:11px;font-weight:600;color:#4a7fd4;background:none;border:none;cursor:pointer;padding:4px 8px">Set Up Profile →</button>
    </div>`;
  } else {
    const catCount = AB_PRIORITY_CATS.filter(c => {
      const v = parseInt(abProfile.priorities[c.key]);
      return !isNaN(v) && v > 0;
    }).length;
    const resLabels = { ab_resident:'AB Resident', non_resident_canadian:'Non-resident Canadian', non_resident_alien:'Non-resident Alien' };
    const res = resLabels[abProfile.residencyStatus] || abProfile.residencyStatus;
    const host = abProfile.hasHost ? 'Host: Yes' : 'Host: No';
    el.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:rgba(74,222,128,.07);border-bottom:1px solid rgba(74,222,128,.15)">
      <span style="font-size:12px;color:#4ade80;font-weight:500">✓ ${res} · ${host} · ${catCount} categories set</span>
      <button onclick="showPage('abProfile')" style="font-size:11px;font-weight:600;color:#4ade80;background:none;border:none;cursor:pointer;padding:4px 8px">Edit Profile</button>
    </div>`;
  }
}
