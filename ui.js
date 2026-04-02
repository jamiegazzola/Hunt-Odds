let compareProvince = 'BC';

function renderComparePage() {
  const page = document.getElementById('comparePage');
  if (!page) return;
  page.innerHTML = `
    <div class="saved-wrap">
      <div class="saved-header">
        <div>
          <h2 class="saved-title">Compare Draws</h2>
          <p class="saved-sub">Side-by-side comparison of your saved hunts.</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button id="cmpBtnBC" onclick="setCompareProvince('BC')"
            style="padding:8px 18px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:2px solid ${compareProvince==='BC'?'var(--accent)':'var(--border)'};background:${compareProvince==='BC'?'var(--accent)':'var(--bg-card)'};color:${compareProvince==='BC'?'#fff':'var(--text-secondary)'}">
            🏔 BC
          </button>
          <button id="cmpBtnAB" onclick="setCompareProvince('AB')"
            style="padding:8px 18px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:2px solid ${compareProvince==='AB'?'var(--accent)':'var(--border)'};background:${compareProvince==='AB'?'var(--accent)':'var(--bg-card)'};color:${compareProvince==='AB'?'#fff':'var(--text-secondary)'}">
            🌾 Alberta
          </button>
        </div>
      </div>
      <div id="compareContent">${buildCompareContent()}</div>
    </div>`;
}

function setCompareProvince(prov) {
  compareProvince = prov;
  renderComparePage();
}

function buildCompareContent() {
  if (compareProvince === 'BC') {
    const saved = savedDraws || [];
    if (saved.length === 0) return '<div class="saved-empty"><div class="saved-empty-icon">☆</div><div class="saved-empty-title">No saved BC draws</div><p class="saved-empty-sub">Star draws on the BC Draw Odds page to save them here.</p></div>';
    return `<div class="cards-grid">${saved.map((r,i) => {
      const cls=oddsClass(r['%']), pct=fmt(r['%']);
      const fr=computeHarvestAvg(r.yearly_fill_rates), frFmt_=fr!==null?fr+'%':null, frCls_=fr!==null?(fr>=50?'fill-high':fr>=25?'fill-mid':'fill-low'):'fill-none';
      return `<div class="card ${cls}">
        <div class="card-header">
          <div>
            <div class="card-species">${r.Species}</div>
            <div class="card-class">${r.Class}</div>
            ${fr!=null?`<span class="fill-badge ${frCls_}"><span class="fill-pct">${frFmt_}</span><span class="fill-sub">&nbsp;success rate</span></span>`:''}
          </div>
          <div class="odds-badge"><div class="odds-pct">${pct}</div><div class="odds-ratio">${r.Odds}</div></div>
        </div>
      </div>`;
    }).join('')}</div>`;
  } else {
    if (abSavedDraws.length === 0) return '<div class="saved-empty"><div class="saved-empty-icon">☆</div><div class="saved-empty-title">No saved Alberta draws</div><p class="saved-empty-sub">Tap the ★ on any Alberta draw card to save it here.</p></div>';
    return `<div class="cards-grid">${abSavedDraws.map((c) => {
      const displayOdds = c.personalOdds !== null ? c.personalOdds : c.latestOdds;
      const cls = abOddsClass(displayOdds);
      const savedHistAvg = computeABHarvestAvg(c.species, c.wmu);
      const harvestFmt = savedHistAvg !== null ? savedHistAvg + '%' : null;
      const harvestCls = savedHistAvg !== null ? (savedHistAvg >= 50 ? 'fill-high' : savedHistAvg >= 25 ? 'fill-mid' : 'fill-low') : null;
      const abClassLabel = (() => {
        const d = (c.draw || '').toLowerCase();
        if (d.includes('antlerless')) return 'Antlerless';
        if (d.includes('antlered')) return 'Antlered';
        return 'Any';
      })();
      return `<div class="card ${cls}" style="position:relative">
        <button class="star-btn starred" onclick="abRemoveSaved('${c._key}')" title="Remove">★</button>
        <div class="card-header">
          <div style="flex:1;min-width:0">
            <div class="card-species">${c.species}</div>
            <div class="card-class">${abClassLabel}&nbsp;·&nbsp;WMU ${c.wmu}</div>
            ${harvestFmt ? `<span class="fill-badge ${harvestCls}"><span class="fill-pct">${harvestFmt}</span><span class="fill-sub">&nbsp;Harvest Success Rate</span></span>` : '<span class="fill-badge fill-none"><span class="fill-sub">No Harvest Data</span></span>'}
          </div>
          <div class="odds-badge" style="flex-shrink:0">
            <div class="odds-pct">${abFmt(displayOdds)}</div>
            <div class="odds-ratio">${c.latestYear}</div>
          </div>
        </div>
        <div class="card-info">
          <div class="ci"><div class="ci-label">Draw</div><div class="ci-val hl">${c.draw}</div></div>
          <div class="ci"><div class="ci-label">WMU</div><div class="ci-val">${c.wmu}</div></div>
          ${c.season && c.season !== '1' ? `<div class="ci"><div class="ci-label">Season</div><div class="ci-val">${c.season}</div></div>` : ''}
          ${c.minPtsToDraw !== null ? `<div class="ci"><div class="ci-label">Min Pts</div><div class="ci-val">${c.minPtsToDraw} pts</div></div>` : ''}
        </div>
      </div>`;
    }).join('')}</div>`;
  }
}

function initHomePage() {
  if (AB_DATA.length > 0) {
    const abDrawCount = document.getElementById('abHomeDrawCount');
    const cards = buildABCards();
    if (abDrawCount) abDrawCount.textContent = cards.length.toLocaleString();
  }
}

function abSetProfileFilter(mode, btn) {
  abProfileFilter = mode;
  document.querySelectorAll('#abDrawsPage .chips-wrap .chip').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  abApplyFilters();
}
