let _drawDetailData = null; // { type: 'BC'|'AB', data: r|c }

function openDrawDetail(i) {
  const r = filtered[i];
  if (!r) return;
  _drawDetailData = { type: 'BC', data: r };
  renderDrawDetailPage();
  showPage('drawDetail');
}

function openDrawDetailByKey(code, mu) {
  const r = DATA.find(x => x.Code === code && x.MU === mu);
  if (!r) return;
  _drawDetailData = { type: 'BC', data: r };
  renderDrawDetailPage();
  showPage('drawDetail');
}

function openABDrawDetail(i) {
  const c = abLastFilteredCards[i];
  if (!c) return;
  _drawDetailData = { type: 'AB', data: c };
  renderDrawDetailPage();
  showPage('drawDetail');
}

function renderDrawDetailPage() {
  const page = document.getElementById('drawDetailPage');
  if (!page || !_drawDetailData) return;
  const { type, data: d } = _drawDetailData;

  let html = `<div class="draw-detail-wrap">
    <div class="draw-detail-back">
      <button onclick="showPage('${type==='BC'?'draws':'abDraws'}')" class="dd-back-btn">← Back to draws</button>
    </div>`;

  if (type === 'BC') {
    const r = d;
    const cls = oddsClass(r['%']), pct = fmt(r['%']);
    const fr = computeHarvestAvg(r.yearly_fill_rates);
    const frFmt = fr !== null ? fr + '%' : '—';
    const frCls = fr !== null ? (fr >= 50 ? 'fill-high' : fr >= 25 ? 'fill-mid' : 'fill-low') : 'fill-none';

    // odds chart
    const allEntries = Object.entries(r.yearly_draw_odds||{}).sort((a,b)=>+a[0]-+b[0]).slice(-10).filter(e=>isFinite(parseFloat(e[1]))&&parseFloat(e[1])>0&&parseFloat(e[1])<=100);
    const nYrs = allEntries.length;
    const wavg10 = nYrs >= 2 ? Math.min(100,+(allEntries.reduce((s,e)=>s+parseFloat(e[1]),0)/nYrs).toFixed(1)) : null;
    const oddsChartHtml = nYrs >= 2 ? buildOddsLineChart(Object.fromEntries(allEntries),'dd0',wavg10) : '';
    const harvestChartHtml = fr!=null && Object.keys(r.yearly_fill_rates||{}).length>2
      ? buildGreenBarChart(Object.fromEntries(Object.entries(r.yearly_fill_rates||{}).map(([y,v])=>[y,parseFloat(v)*100])),'ddbc0')
      : '';

    html += `
      <div class="dd-hero ${cls}">
        <div class="dd-hero-left">
          <div class="dd-species">${r.Species}</div>
          <div class="dd-class">${r.Class}${r.Zone?' · Zone '+r.Zone:''}</div>
          <div class="dd-area">${r.Area} · MU ${r.MU} · ${r.MU_General} — ${r.MU_Name}</div>
        </div>
        <div class="dd-hero-right">
          <div class="dd-odds-big ${cls}">${pct}</div>
          <div class="dd-odds-sub">Draw Odds</div>
          <div class="dd-odds-ratio">${r.Odds}</div>
        </div>
      </div>
      <div class="dd-grid">
        <div class="dd-card">
          <div class="dd-card-title">Hunt Details</div>
          <div class="dd-rows">
            <div class="dd-row"><span class="dd-lbl">Draw Code</span><span class="dd-val">${r.Code}</span></div>
            <div class="dd-row"><span class="dd-lbl">Season</span><span class="dd-val">${r.Season||'—'}</span></div>
            <div class="dd-row"><span class="dd-lbl">Tags Available</span><span class="dd-val">${r.Tags}</span></div>
            <div class="dd-row"><span class="dd-lbl">Zone</span><span class="dd-val">${r.Zone||'—'}</span></div>
            <div class="dd-row"><span class="dd-lbl">Drive</span><span class="dd-val">${r.Drive||'—'}</span></div>
            ${r.Notes?`<div class="dd-row dd-note">📝 ${r.Notes}</div>`:''}
          </div>
        </div>
        <div class="dd-card">
          <div class="dd-card-title">Success Data</div>
          <div class="dd-rows">
            <div class="dd-row"><span class="dd-lbl">Harvest Success (10yr avg)</span><span class="dd-val ${frCls}-text">${frFmt}</span></div>
            ${r.fill_rate_alltime!=null?`<div class="dd-row"><span class="dd-lbl">All-time Success</span><span class="dd-val">${fmtFill(r.fill_rate_alltime)} <span style="font-size:11px;color:var(--text-muted)">(${r.fill_rate_years} yrs)</span></div>`:''}
            ${r.fill_rate_3yr?`<div class="dd-row"><span class="dd-lbl">3-yr avg Success</span><span class="dd-val">${fmtFill(r.fill_rate_3yr)}</span></div>`:''}
          </div>
        </div>
      </div>
      ${oddsChartHtml ? `<div class="dd-chart-section"><div class="dd-card-title">Draw Odds History</div>${oddsChartHtml}<div class="chart-label" style="margin-top:6px">Draw odds % by year (${nYrs<10?nYrs+' yrs':'last 10'}) · <span style="color:#4a7fd4">- - -</span> ${wavg10}% avg</div></div>` : ''}
      ${harvestChartHtml ? `<div class="dd-chart-section"><div class="dd-card-title">Harvest Success History</div>${harvestChartHtml}<div class="chart-label" style="margin-top:6px">Last 10 years · <span style="color:#4ade80">AVG ${frFmt}</span></div></div>` : ''}
      ${r.writeup ? (() => {
        const cleanText = t => (t||'').replace(/\u2014/g,'-').replace(/\u2013/g,'-').replace(/\u2018|\u2019/g,"'").replace(/\u201C|\u201D/g,'"');
        const parts = r.writeup.split('|||');
        const terrain = cleanText(parts[0]), access = cleanText(parts[1]);
        return `<div class="dd-card dd-writeup">
          <div class="dd-card-title">✦ Terrain &amp; Access</div>
          ${terrain?`<div class="dd-wu-section"><div class="dd-wu-label">Terrain &amp; conditions</div><div class="dd-wu-body">${terrain}</div></div>`:''}
          ${access?`<div class="dd-wu-section"><div class="dd-wu-label">Access &amp; what to expect</div><div class="dd-wu-body">${access}</div></div>`:''}
        </div>`;
      })() : ''}`;

  } else {
    // AB draw
    const c = d;
    const displayOdds = c.personalOdds !== null ? c.personalOdds : c.latestOdds;
    const cls = abOddsClass(displayOdds);
    const histAvg = computeABHarvestAvgCached(c.species, c.wmu);
    const histAvgFmt = histAvg !== null ? histAvg+'%' : '—';
    const histAvgCls = histAvg !== null ? (histAvg>=50?'fill-high':histAvg>=25?'fill-mid':'fill-low') : 'fill-none';
    const nYrs = c.histYears.length;
    const oddsChartHtml = nYrs >= 2 ? buildOddsLineChart(c.yearlyOddsObj,'ddab0',c.avgOdds) : '';

    const s = (c.species||'').toLowerCase();
    function histChartDD(histData, labelId) {
      if (!histData) return '';
      const entries = Object.entries(histData).sort((a,b)=>+a[0]-+b[0]);
      if (entries.length < 2) return '';
      const avg = Math.round(entries.reduce((s,[,v])=>s+v,0)/entries.length);
      return `<div class="dd-chart-section"><div class="dd-card-title">Harvest Success History</div>${buildGreenBarChart(Object.fromEntries(entries), labelId)}<div class="chart-label" style="margin-top:6px">Last 10 years · <span style="color:#4ade80">AVG ${avg}%</span></div></div>`;
    }
    const harvestChart = s==='elk'?histChartDD(AB_ELK_HISTORY?.[c.wmu],'ddelk0'):
      s==='moose'?histChartDD(AB_MOOSE_HISTORY?.[c.wmu],'ddmoose0'):
      ['mule deer','muledeer','mule_deer'].includes(s)?histChartDD(AB_MULEDEER_HISTORY?.[c.wmu],'ddmule0'):
      ['antelope','pronghorn','pronghorn antelope'].includes(s)?histChartDD(AB_ANTELOPE_HISTORY?.[c.wmu],'ddant0'):
      ['white-tailed deer','white tailed deer','whitetail','whitetailed deer','white-tail'].includes(s)?histChartDD(AB_WTDEER_HISTORY?.[c.wmu],'ddwt0'):'';

    const catDef = AB_PRIORITY_CATS.find(x=>x.key===c.priorityKey);
    const catLabel = catDef ? catDef.label : '';

    html += `
      <div class="dd-hero ${cls}">
        <div class="dd-hero-left">
          <div class="dd-species">${c.species}</div>
          <div class="dd-class">${c.draw} · WMU ${c.wmu}</div>
          <div class="dd-area">${c.latestYear} data · ${c.numYears} year${c.numYears!==1?'s':''} of history</div>
        </div>
        <div class="dd-hero-right">
          <div class="dd-odds-big ${cls}">${abFmt(displayOdds)}</div>
          <div class="dd-odds-sub">${c.personalOdds!==null?c.userPts+' pt odds':'Draw Odds'}</div>
        </div>
      </div>
      <div class="dd-grid">
        <div class="dd-card">
          <div class="dd-card-title">Hunt Details</div>
          <div class="dd-rows">
            <div class="dd-row"><span class="dd-lbl">Draw Code</span><span class="dd-val">${c.draw}</span></div>
            <div class="dd-row"><span class="dd-lbl">WMU</span><span class="dd-val">${c.wmu}</span></div>
            ${c.season&&c.season!=='1'?`<div class="dd-row"><span class="dd-lbl">Season</span><span class="dd-val">${c.season}</span></div>`:''}
            <div class="dd-row"><span class="dd-lbl">Quota (${c.latestYear})</span><span class="dd-val">${c.quota}</span></div>
            ${c.minPtsToDraw!==null?`<div class="dd-row"><span class="dd-lbl">Min Points to Draw</span><span class="dd-val">${c.minPtsToDraw} pts</span></div>`:''}
            ${catLabel?`<div class="dd-row"><span class="dd-lbl">Priority Category</span><span class="dd-val">${catLabel}</span></div>`:''}
          </div>
        </div>
        <div class="dd-card">
          <div class="dd-card-title">Success &amp; Odds</div>
          <div class="dd-rows">
            <div class="dd-row"><span class="dd-lbl">Latest Odds (${c.latestYear})</span><span class="dd-val">${abFmt(c.latestOdds)}</span></div>
            <div class="dd-row"><span class="dd-lbl">Historical Avg Odds</span><span class="dd-val">${abFmt(c.avgOdds)}</span></div>
            <div class="dd-row"><span class="dd-lbl">Harvest Success (10yr avg)</span><span class="dd-val ${histAvgCls}-text">${histAvgFmt}</span></div>
            ${c.harvestSuccess!==null?`<div class="dd-row"><span class="dd-lbl">2024 Special Licence Success</span><span class="dd-val" style="color:${c.harvestSuccess>=50?'#4ade80':c.harvestSuccess>=25?'#facc15':'#f87171'}">${abFmt(c.harvestSuccess)}</span></div>`:''}
          </div>
        </div>
      </div>
      ${oddsChartHtml?`<div class="dd-chart-section"><div class="dd-card-title">Draw Odds History</div>${oddsChartHtml}<div class="chart-label" style="margin-top:6px">Odds by year · <span style="color:#4a7fd4">- - -</span> ${abFmt(c.avgOdds)} avg</div></div>`:''}
      ${harvestChart}
      ${c.ptBreakdown.length>0?`<div class="dd-card" style="margin-top:16px">
        <div class="dd-card-title">Point Level Breakdown — ${c.latestYear}</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px">
          <thead><tr style="border-bottom:1px solid var(--border)">
            <th style="text-align:left;color:var(--text-muted);padding:6px 8px;font-weight:600">Points</th>
            <th style="text-align:right;color:var(--text-muted);padding:6px 8px;font-weight:600">Applied</th>
            <th style="text-align:right;color:var(--text-muted);padding:6px 8px;font-weight:600">Drew</th>
            <th style="text-align:right;color:var(--text-muted);padding:6px 8px;font-weight:600">Odds</th>
          </tr></thead>
          <tbody>${c.ptBreakdown.map(row=>{
            const isUser=!isNaN(c.userPts)&&row.pointBalance===c.userPts;
            return `<tr style="${isUser?'background:rgba(74,222,128,.1)':''}">
              <td style="padding:6px 8px;color:${isUser?'#4ade80':'var(--text-primary)'};font-weight:${isUser?'700':'400'}">${row.pointBalance}${isUser?' ★':''}</td>
              <td style="text-align:right;padding:6px 8px;color:var(--text-secondary)">${row.totalApplicants.toLocaleString()}</td>
              <td style="text-align:right;padding:6px 8px;color:var(--text-secondary)">${row.drawApplicants.toLocaleString()}</td>
              <td style="text-align:right;padding:6px 8px;font-weight:700;color:${row.pctDrawn>=20?'#4ade80':row.pctDrawn>=5?'#facc15':'#f87171'}">${abFmt(row.pctDrawn)}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>`:''}`;
  }

  html += `</div>`;
  page.innerHTML = html;
}

function toggleSidebar() {
  const inner = document.getElementById('sidebarInner');
  const arrow = document.getElementById('sidebarArrow');
  inner.classList.toggle('open');
  arrow.classList.toggle('open');
}

// AB sidebar mobile toggle
function toggleAbSidebar() {
  const inner = document.getElementById('abSidebarInner');
  const arrow = document.getElementById('abSidebarArrow');
  if (inner) inner.classList.toggle('open');
  if (arrow) arrow.classList.toggle('open');
}

// Show mobile toggles on small screens
function checkMobile() {
  const isMobile = window.innerWidth <= 768;

  // BC draws sidebar
  const toggle = document.getElementById('sidebarToggle');
  const inner = document.getElementById('sidebarInner');
  if (toggle) toggle.style.display = isMobile ? 'flex' : 'none';
  if (inner && !isMobile) inner.classList.add('open');

  // AB draws sidebar
  const abToggle = document.getElementById('abSidebarToggle');
  const abInner = document.getElementById('abSidebarInner');
  if (abToggle) abToggle.style.display = isMobile ? 'flex' : 'none';
  if (abInner && !isMobile) abInner.classList.add('open');

  // Map sidebar toggle button
  const mapToggleBtn = document.getElementById('mapSidebarToggleBtn');
  const mapBody = document.getElementById('mapSidebarBody');
  if (mapToggleBtn) {
    mapToggleBtn.style.display = isMobile ? 'block' : 'none';
    if (!isMobile && mapBody) mapBody.classList.add('open');
  }
}
window.addEventListener('resize', checkMobile);
checkMobile();

// Hamburger nav menu
function toggleNavMenu() {
  const btn = document.getElementById('navHamburger');
  const menu = document.getElementById('navMobileMenu');
  if (!btn || !menu) return;
  btn.classList.toggle('open');
  menu.classList.toggle('open');
}
function closeNavMenu() {
  const btn = document.getElementById('navHamburger');
  const menu = document.getElementById('navMobileMenu');
  if (btn) btn.classList.remove('open');
  if (menu) menu.classList.remove('open');
}
// Close nav menu when clicking outside
document.addEventListener('click', function(e) {
  const menu = document.getElementById('navMobileMenu');
  const btn = document.getElementById('navHamburger');
  if (menu && menu.classList.contains('open')) {
    if (!menu.contains(e.target) && !btn.contains(e.target)) closeNavMenu();
  }
});

// Map sidebar toggle
function toggleMapSidebar() {
  const body = document.getElementById('mapSidebarBody');
  const btn = document.getElementById('mapSidebarToggleBtn');
  if (!body) return;
  body.classList.toggle('open');
  if (btn) btn.textContent = body.classList.contains('open') ? 'Filters ▲' : 'Filters ▼';
}





// [fp vars moved to top]

