const ODDS_STEPS = [0,1,2,5,10,20,50,75];
const MU_NAMES = {1:"Vancouver Island",2:"Lower Mainland",3:"Thompson",4:"Kootenay",5:"Cariboo",6:"Skeena",7:"Omineca / Peace",8:"Okanagan"};

// ── MAIN STATE ──
let selSpecies = new Set();
let selClass = new Set();
let selMUs = new Set();
let selMUsFull = new Set(); // full BC WMU IDs like '4-01' for map filter

// ── BC MAP STATE ──
let bcMapOpen = false;
let bcMapInitialized = false;
let bcLeafletMapInstance = null;
let bcWmuGeoLayer = null;
let bcWmuGeoJSON = null;
const BC_WMU_GEOJSON_URL = 'https://raw.githubusercontent.com/jamiegazzola/Hunt-Odds/main/data/bc_wmu.geojson';
let selMinOdds = 0;
let selMinHarvest = 0;
let sortMode = 'odds';
let filtered = [];

// ── FILTER PAGE STATE ──
let fpSelSpecies = new Set();
let fpSelClass = new Set();
let fpSelMUs = new Set();
let fpMinOdds = 0;
let fpMinHarvest = 0;
const FP_HARVEST_STEPS = [0,10,20,30,40,50,60,70];
let abFpMinHarvest = 0;

// ── SAVED DRAWS STATE ──
let savedDraws = JSON.parse(localStorage.getItem('huntodds_saved') || '[]');
let abSavedDraws = JSON.parse(localStorage.getItem('huntodds_ab_saved') || '[]');
let compareMode = false;
let compareSelected = new Set();


// ── PAGE NAV ──
function showPage(page) {
  const pages = ['homePage','filterPage','drawsPage','savedPage','mapPage',
                 'abProfilePage','abFilterPage','abDrawsPage','comparePage','drawDetailPage'];
  pages.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const map = {
    home:'homePage', filter:'filterPage', draws:'drawsPage',
    saved:'savedPage', map:'mapPage',
    abProfile:'abProfilePage', abFilter:'abFilterPage', abDraws:'abDrawsPage',
    compare:'comparePage', drawDetail:'drawDetailPage'
  };
  if (map[page]) { const el = document.getElementById(map[page]); if(el) el.style.display='block'; }

  // Desktop nav active states
  document.getElementById('navHome').classList.toggle('active', page==='home');
  const navBC = document.getElementById('navBC');
  if(navBC) navBC.classList.toggle('active', page==='filter'||page==='draws');
  const navMap = document.getElementById('navMap');
  if(navMap) navMap.classList.toggle('active', page==='map');
  const navAB = document.getElementById('navAlberta');
  if(navAB) navAB.classList.toggle('active', page==='abProfile'||page==='abFilter'||page==='abDraws');
  const navCmp = document.getElementById('navCompare');
  if(navCmp) navCmp.classList.toggle('active', page==='compare');
  document.getElementById('navSaved').classList.toggle('active', page==='saved');

  // Mobile nav active states
  const mNavHome = document.getElementById('mNavHome');
  const mNavBC = document.getElementById('mNavBC');
  const mNavAB = document.getElementById('mNavAlberta');
  const mNavSaved = document.getElementById('mNavSaved');
  if(mNavHome) mNavHome.classList.toggle('active', page==='home');
  if(mNavBC) mNavBC.classList.toggle('active', page==='filter'||page==='draws');
  const mNavMap = document.getElementById('mNavMap');
  if(mNavMap) mNavMap.classList.toggle('active', page==='map');
  if(mNavAB) mNavAB.classList.toggle('active', page==='abProfile'||page==='abFilter'||page==='abDraws');
  if(mNavSaved) mNavSaved.classList.toggle('active', page==='saved');

  // Close hamburger menu
  closeNavMenu();

  if (page==='filter') { fpBuildChips(); fpBuildClassChips(); fpBuildMU(); fpUpdateCta(); }
  if (page==='draws') { buildMUList(); buildSpeciesChips(); buildClassChips(); loadWriteups().then(()=>applyFilters()); applyFilters(); }
  if (page==='saved') renderSavedPage();
  if (page==='map') { fullMapInit(); setTimeout(() => checkMobile(), 50); }
  if (page==='abProfile') renderAbProfilePage();
  if (page==='abFilter') {
    Promise.all([loadABData(),loadABHarvest(),loadABElkHistory(),loadABMooseHistory(),loadABMuleDeerHistory(),loadABAntelopeHistory(),loadABWTDeerHistory(),loadABBisonHistory()]).then(()=>{
      abFpBuildChips(); abFpBuildClassChips(); abFpBuildWMU(); abFpUpdateCount();
    });
  }
  if (page==='abDraws') {
    Promise.all([loadABData(),loadABHarvest(),loadABElkHistory(),loadABMooseHistory(),loadABMuleDeerHistory(),loadABAntelopeHistory(),loadABWTDeerHistory(),loadABBisonHistory()]).then(()=>abApplyFilters());
    setTimeout(() => checkMobile(), 50);
  }
  if (page==='compare') renderComparePage();
  window.scrollTo(0,0);
}

function goToAlberta() {
  Promise.all([loadABData(),loadABHarvest(),loadABElkHistory(),loadABMooseHistory(),loadABMuleDeerHistory(),loadABAntelopeHistory(),loadABWTDeerHistory(),loadABBisonHistory()]).then(() => {
    showPage(abProfile ? 'abFilter' : 'abProfile');
  });
}


function filterBySpecies(s) {
  selSpecies.clear();
  selSpecies.add(s);
  showPage('draws');
  buildSpeciesChips();
  buildMUList();
  buildClassChips();
  applyFilters();
}


// ── FILTERS ──
function oddsClass(p) { return p >= 5 ? 'green' : p >= 1 ? 'yellow' : 'red'; }
function fmt(p) {
  if (isNaN(p)||p==null) return '?%';
  return (p>=10 ? Math.round(p) : p.toFixed(1)) + '%';
}
function fmtFill(f) {
  if (f==null||isNaN(f)) return null;
  return Math.round(f*100) + '%';
}
function fillClass(f) {
  if (f==null) return 'fill-none';
  if (f >= 0.70) return 'fill-high';
  if (f >= 0.40) return 'fill-mid';
  return 'fill-low';
}
function fillLabel(f) {
  if (f==null) return null;
  if (f >= 0.70) return 'High success';
  if (f >= 0.40) return 'Moderate';
  return 'Low success';
}
function buildMiniChart(yearlyData) {
  if (!yearlyData || Object.keys(yearlyData).length === 0) return '';
  const entries = Object.entries(yearlyData).sort((a,b)=>a[0]-b[0]).slice(-10);
  if (entries.length < 2) return '';
  const vals = entries.map(e => parseFloat(e[1]));
  const max = Math.max(...vals, 0.01);
  const bars = entries.map(([yr, val]) => {
    const h = Math.round((parseFloat(val)/max)*28);
    const pct = Math.round(parseFloat(val)*100);
    return `<div class="mc-bar" style="height:${h}px;background:#4ade80" title="${yr}: ${pct}%"></div>`;
  }).join('');
  return `<div class="mini-chart">${bars}</div>`;
}

function buildGreenBarChart(yearlyOdds, cardIndex) {
  if (!yearlyOdds || Object.keys(yearlyOdds).length === 0) return '';
  const entries = Object.entries(yearlyOdds).sort((a,b) => {
    return String(a[0]).slice(0,4).localeCompare(String(b[0]).slice(0,4));
  }).slice(-10);
  if (entries.length < 2) return '';

  const W = 280, H = 90, PAD_L = 8, PAD_R = 8, PAD_T = 6, PAD_B = 22;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const TIP_H = 34, TIP_W = 64;

  const vals = entries.map(e => parseFloat(e[1]));
  const maxV = Math.max(...vals, 0.01);
  const n = entries.length;
  const gap = 3;
  const barW = Math.max(4, Math.floor((plotW - gap * (n - 1)) / n));

  const bars = entries.map(([yr, v], i) => {
    const fv = parseFloat(v);
    const barH = Math.max(2, (fv / maxV) * plotH);
    const x = PAD_L + i * (barW + gap);
    const y = PAD_T + plotH - barH;
    const pct = fv % 1 < 0.05 ? Math.round(fv) + '' : fv.toFixed(1);
    const col = fv >= 50 ? '#4ade80' : fv >= 25 ? '#facc15' : '#f87171';
    const cx = x + barW / 2;
    const tipX = Math.min(Math.max(cx - TIP_W / 2, PAD_L), W - PAD_R - TIP_W);
    const tipY = PAD_T - TIP_H - 6;
    return '<g onmouseenter="var t=this.querySelector(\'.gbtip\');t.style.display=\'block\'" onmouseleave="var t=this.querySelector(\'.gbtip\');t.style.display=\'none\'" style="cursor:default">' +
      '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW + '" height="' + barH.toFixed(1) + '" rx="2" fill="' + col + '" opacity="0.85"/>' +
      '<rect x="' + x.toFixed(1) + '" y="' + PAD_T + '" width="' + barW + '" height="' + plotH + '" fill="transparent"/>' +
      '<g class="gbtip" style="display:none;pointer-events:none">' +
      '<rect x="' + tipX.toFixed(1) + '" y="' + tipY + '" width="' + TIP_W + '" height="' + TIP_H + '" rx="4" fill="#1e293b" stroke="' + col + '" stroke-width="1.2"/>' +
      '<text x="' + (tipX + TIP_W/2).toFixed(1) + '" y="' + (tipY + 13) + '" text-anchor="middle" font-size="9" font-weight="600" fill="#94a3b8" font-family="DM Sans,sans-serif">' + yr + '</text>' +
      '<text x="' + (tipX + TIP_W/2).toFixed(1) + '" y="' + (tipY + 27) + '" text-anchor="middle" font-size="12" font-weight="700" fill="' + col + '" font-family="DM Sans,sans-serif">' + pct + '%</text>' +
      '</g></g>';
  }).join('');

  const labelIdxs = new Set([0, n - 1]);
  if (n >= 5) labelIdxs.add(Math.floor(n / 2));
  const yearLabels = entries.map(([yr], idx) => {
    if (!labelIdxs.has(idx)) return '';
    const x = PAD_L + idx * (barW + gap) + barW / 2;
    return '<text x="' + x.toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle" fill="#6b7a8d" font-size="9" font-family="DM Sans,sans-serif">' + String(yr).slice(0,7) + '</text>';
  }).join('');

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible">' + bars + yearLabels + '</svg>';
}
// ── Compute 10yr harvest avg from bar chart data (single source of truth for badge) ──
function computeHarvestAvg(yearlyData) {
  if (!yearlyData) return null;
  const vals = Object.entries(yearlyData)
    .sort((a,b) => String(a[0]).slice(0,4).localeCompare(String(b[0]).slice(0,4)))
    .slice(-10)
    .map(e => parseFloat(e[1]))
    .filter(v => isFinite(v) && v >= 0);
  if (vals.length < 1) return null;
  const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
  // yearly_fill_rates stores decimals (0.29 = 29%); AB history stores percents (29)
  // Detect by whether all values are <= 1
  const isDecimal = vals.every(v => v <= 1);
  return Math.round(isDecimal ? avg * 100 : avg);
}

function computeABHarvestAvg(species, wmu) {
  const s = (species||'').toLowerCase();
  if (s === 'elk' && AB_ELK_HISTORY?.[wmu]) return computeHarvestAvg(AB_ELK_HISTORY[wmu]);
  if (s === 'moose' && AB_MOOSE_HISTORY?.[wmu]) return computeHarvestAvg(AB_MOOSE_HISTORY[wmu]);
  if (['mule deer','muledeer','mule_deer'].includes(s) && AB_MULEDEER_HISTORY?.[wmu]) return computeHarvestAvg(AB_MULEDEER_HISTORY[wmu]);
  if (['antelope','pronghorn','pronghorn antelope'].includes(s) && AB_ANTELOPE_HISTORY?.[wmu]) return computeHarvestAvg(AB_ANTELOPE_HISTORY[wmu]);
  if (['white-tailed deer','white tailed deer','whitetail','whitetailed deer','white-tail'].includes(s) && AB_WTDEER_HISTORY?.[wmu]) return computeHarvestAvg(AB_WTDEER_HISTORY[wmu]);
  if (s.includes('bison') && AB_BISON_HISTORY?.length) {
    const vals = AB_BISON_HISTORY.slice(-10).map(r=>r.pct);
    return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : null;
  }
  return null;
}

// Cached version — reset when AB data reloads
const _abHarvestAvgCache = new Map();
function computeABHarvestAvgCached(species, wmu) {
  const key = species + '||' + wmu;
  if (_abHarvestAvgCache.has(key)) return _abHarvestAvgCache.get(key);
  const v = computeABHarvestAvg(species, wmu);
  _abHarvestAvgCache.set(key, v);
  return v;
}


function buildOddsLineChart(yearlyOdds, cardIndex, weightedAvg) {
  if (!yearlyOdds || Object.keys(yearlyOdds).length === 0) return '';
  const entries = Object.entries(yearlyOdds).sort((a,b)=>+a[0]-+b[0]).slice(-10);
  if (entries.length < 2) return '';

  const W = 280, H = 76, PAD_L = 8, PAD_R = 8, PAD_T = 16, PAD_B = 20;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const baseY = PAD_T + plotH;
  const TIP_H = 34, TIP_W = 64;

  const vals = entries.map(e => parseFloat(e[1]));
  const maxV = Math.max(...vals, 0.01);
  const minYr = +entries[0][0];
  const maxYr = +entries[entries.length-1][0];
  const yrSpan = maxYr - minYr || 1;

  const pts = entries.map(([yr, v]) => ({
    x: PAD_L + ((+yr - minYr) / yrSpan) * plotW,
    y: PAD_T + plotH - (parseFloat(v) / maxV) * plotH,
    yr: yr, v: parseFloat(v)
  }));

  // Split into contiguous segments (gap > 2 years = break)
  const segments = [];
  let seg = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (+pts[i].yr - +pts[i-1].yr > 2) { segments.push(seg); seg = [pts[i]]; }
    else seg.push(pts[i]);
  }
  segments.push(seg);

  const linePath = segments.map(s =>
    'M' + s[0].x.toFixed(1) + ',' + s[0].y.toFixed(1) +
    s.slice(1).map(p => ' L' + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join('')
  ).join(' ');

  const fillPath = segments.filter(s => s.length > 1).map(s =>
    'M' + s[0].x.toFixed(1) + ',' + baseY.toFixed(1) +
    ' L' + s[0].x.toFixed(1) + ',' + s[0].y.toFixed(1) +
    s.slice(1).map(p => ' L' + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join('') +
    ' L' + s[s.length-1].x.toFixed(1) + ',' + baseY.toFixed(1) + ' Z'
  ).join(' ');

  const labelIdxs = new Set([0, pts.length - 1]);
  if (pts.length >= 5) labelIdxs.add(Math.floor(pts.length / 2));
  if (pts.length >= 9) { labelIdxs.add(Math.floor(pts.length / 4)); labelIdxs.add(Math.floor(3 * pts.length / 4)); }
  const yearLabels = pts.filter((_, i) => labelIdxs.has(i))
    .map(p => '<text x="' + p.x.toFixed(1) + '" y="' + (H - 2) + '" text-anchor="middle" fill="#6b7a8d" font-size="8" font-family="DM Sans,sans-serif">' + p.yr + '</text>')
    .join('');

  let avgLine = '';
  if (weightedAvg != null && weightedAvg > 0) {
    const avgY = Math.max(PAD_T + 1, Math.min(baseY - 1, PAD_T + plotH - (weightedAvg / maxV) * plotH));
    avgLine = '<line x1="' + PAD_L + '" y1="' + avgY.toFixed(1) + '" x2="' + (W - PAD_R) + '" y2="' + avgY.toFixed(1) + '" stroke="#4a7fd4" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.8"/>';
  }

  // Dots with instant SVG tooltips
  const dots = pts.map(p => {
    const pct = p.v % 1 < 0.05 ? Math.round(p.v) + '' : p.v.toFixed(1);
    const tipX = Math.min(Math.max(p.x - TIP_W / 2, PAD_L), W - PAD_R - TIP_W);
    const tipY = Math.max(p.y - TIP_H - 8, 0);
    return '<g onmouseenter="var t=this.querySelector(\'.odtip\');t.style.display=\'block\'" onmouseleave="var t=this.querySelector(\'.odtip\');t.style.display=\'none\'" style="cursor:default">' +
      '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.5" fill="#1a3a6e" stroke="#4a7fd4" stroke-width="1.5"/>' +
      '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="10" fill="transparent"/>' +
      '<g class="odtip" style="display:none;pointer-events:none">' +
      '<rect x="' + tipX.toFixed(1) + '" y="' + tipY.toFixed(1) + '" width="' + TIP_W + '" height="' + TIP_H + '" rx="4" fill="#1e293b" stroke="#4a7fd4" stroke-width="1.2"/>' +
      '<text x="' + (tipX + TIP_W/2).toFixed(1) + '" y="' + (tipY + 13).toFixed(1) + '" text-anchor="middle" font-size="9" font-weight="600" fill="#94a3b8" font-family="DM Sans,sans-serif">' + p.yr + '</text>' +
      '<text x="' + (tipX + TIP_W/2).toFixed(1) + '" y="' + (tipY + 27).toFixed(1) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#4a7fd4" font-family="DM Sans,sans-serif">' + pct + '%</text>' +
      '</g></g>';
  }).join('');

  const gradId = 'og' + cardIndex;
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible">' +
    '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="#1e4fa0" stop-opacity="0.3"/>' +
    '<stop offset="100%" stop-color="#1e4fa0" stop-opacity="0.02"/>' +
    '</linearGradient></defs>' +
    '<path d="' + fillPath + '" fill="url(#' + gradId + ')"/>' +
    avgLine +
    '<path d="' + linePath + '" fill="none" stroke="#2563c7" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
    dots + yearLabels + '</svg>';
}
function onSlider(v) {
  selMinOdds = ODDS_STEPS[parseInt(v)];
  const d=document.getElementById('oddsDisplay'), u=document.getElementById('oddsUnit'), s=document.getElementById('oddsSubLabel');
  if (selMinOdds===0) { d.textContent='Any'; u.textContent=''; s.textContent='All draws'; }
  else { d.textContent=selMinOdds; u.textContent='%+'; s.textContent='Min '+selMinOdds+'% odds'; }
  applyFilters();
}

function buildSpeciesChips() {
  const all = [...new Set(DATA.map(r=>r.Species))].sort();
  document.getElementById('speciesChips').innerHTML = all.map(s =>
    `<div class="chip${selSpecies.has(s)?' active':''}" onclick="toggleSpecies('${s}')">${s}</div>`
  ).join('');
  document.getElementById('clearSpecies').classList.toggle('visible', selSpecies.size>0);
}

function buildMUList() {
  const relevant = selSpecies.size===0 ? DATA : DATA.filter(r=>selSpecies.has(r.Species));
  const nums = [...new Set(relevant.map(r=>r.MU_General))].sort((a,b)=>a-b);
  document.getElementById('muList').innerHTML = nums.map(n =>
    `<div class="mu-item${selMUs.has(n)?' active':''}" onclick="toggleMU(${n})">
      <span class="mu-num">${n}</span>
      <span class="mu-name">${MU_NAMES[n]||''}</span>
    </div>`
  ).join('');
  document.getElementById('clearMU').classList.toggle('visible', selMUs.size>0);
}

function toggleSpecies(s) {
  if (selSpecies.has(s)) selSpecies.delete(s); else selSpecies.add(s);
  const relevant = selSpecies.size===0 ? DATA : DATA.filter(r=>selSpecies.has(r.Species));
  const validMUs = new Set(relevant.map(r=>r.MU_General));
  selMUs.forEach(m=>{ if(!validMUs.has(m)) selMUs.delete(m); });
  buildSpeciesChips(); buildMUList(); applyFilters();
}

function toggleMU(n) {
  if (selMUs.has(n)) selMUs.delete(n); else selMUs.add(n);
  buildMUList(); applyFilters();
}

function buildClassChips() {
  const wrap = document.getElementById('classChips');
  if (!wrap) return;
  ['Antlered','Antlerless','Any'].forEach(c => {
    // chips are static in HTML, just toggle active class
  });
  wrap.innerHTML = ['Antlered','Antlerless','Any'].map(c =>
    `<div class="chip${selClass.has(c)?' active':''}" onclick="toggleClass('${c}')">${c}</div>`
  ).join('');
  const cl = document.getElementById('clearClass');
  if (cl) cl.classList.toggle('visible', selClass.size > 0);
}
function toggleClass(c) {
  if (selClass.has(c)) selClass.delete(c); else selClass.add(c);
  buildClassChips(); applyFilters();
}

function clearFilter(type) {
  if (type==='species') { selSpecies.clear(); buildSpeciesChips(); buildMUList(); }
  if (type==='mu') { selMUs.clear(); selMUsFull.clear(); bcUpdateMapChips(); bcUpdateMapStyles(); buildMUList(); }
  if (type==='class') { selClass.clear(); buildClassChips(); }
  applyFilters();
}

function setSort(mode) {
  sortMode = mode;
  document.getElementById('sortOddsBtn').classList.toggle('active', mode==='odds');
  const ssBtn = document.getElementById('sortSuccessBtn');
  if (ssBtn) ssBtn.classList.toggle('active', mode==='success');
  document.getElementById('sortSeasonBtn').classList.toggle('active', mode==='season');
  applyFilters();
}

function resetAll() {
  selSpecies.clear(); selMUs.clear(); selMUsFull.clear(); selMinOdds=0; selMinHarvest=0; selClass.clear();
    document.getElementById('oddsSlider').value=0;
  onSlider(0);
  bcUpdateMapChips(); bcUpdateMapStyles();
  buildSpeciesChips(); buildMUList(); buildClassChips(); applyFilters();
}

function applyFilters() {
  const q = (document.getElementById('search') ? document.getElementById('search').value : '').toLowerCase();
  filtered = DATA.filter(r => {
    if (selSpecies.size>0 && !selSpecies.has(r.Species)) return false;
    if (selMUs.size>0 && !selMUs.has(r.MU_General)) return false;
    if (selMUsFull.size>0 && !selMUsFull.has(r.MU)) return false;
    if ((r['%']||0) < selMinOdds) return false;
    if (selMinHarvest > 0) {
      const hr = computeHarvestAvg(r.yearly_fill_rates);
      if (hr === null || hr < selMinHarvest) return false;
    }
    if (selClass.size > 0) {
      const cls = (r.Class || '').toLowerCase();
      const match = [...selClass].some(c => {
        if (c === 'Antlered') return cls.includes('antlered') && !cls.includes('antlerless');
        if (c === 'Antlerless') return cls.includes('antlerless');
        if (c === 'Any') return !cls.includes('antlered') && !cls.includes('antlerless');
        return false;
      });
      if (!match) return false;
    }
    if (q) {
      const hay = [r.Species,r.MU,r.Area,r.Zone,r.Class,r.Season,r.Notes,r.MU_Name].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Season sort: Aug=earliest; pre-Aug months wrap to end
  if (sortMode==='odds') {
    filtered.sort((a,b)=>(b['%']||0)-(a['%']||0));
  } else if (sortMode==='success') {
    filtered.sort((a,b) => {
      const fa = computeHarvestAvg(a.yearly_fill_rates);
      const fb = computeHarvestAvg(b.yearly_fill_rates);
      if (fb === null && fa === null) return 0;
      if (fb === null) return -1;
      if (fa === null) return 1;
      return fb - fa;
    });
  } else {
    filtered.sort((a,b)=>{
      const adj = v => { const n = v||9999; return n < 800 ? n + 1200 : n; };
      return adj(a.Season_Sort) - adj(b.Season_Sort);
    });
  }

  const tags=[];
  selSpecies.forEach(s=>tags.push(s));
  selMUs.forEach(m=>tags.push(m+' — '+(MU_NAMES[m]||'')));
  if (selMinOdds>0) tags.push('≥ '+selMinOdds+'%');


  let title='All Draws';
  if (selSpecies.size===1) title=[...selSpecies][0];
  else if (selSpecies.size>1) title=[...selSpecies].join(', ');
  document.getElementById('resultsTitle').textContent=title;
  document.getElementById('countDisplay').textContent=filtered.length.toLocaleString();

  renderCards();
}

function toggleWriteup(btn) {
  const body = btn.nextElementSibling;
  const arrow = btn.querySelector('span');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  arrow.textContent = open ? '▾' : '▴';
}

function toggleCard(i) {
  const el=document.getElementById('exp-'+i);
  const btn=document.getElementById('expbtn-'+i);
  if (!el) return;
  const open=el.classList.contains('open');
  if (open) { el.classList.remove('open'); btn.textContent='▾ Show details'; }
  else { el.classList.add('open'); btn.textContent='▴ Hide details'; }
}

function renderCards() {
  const grid=document.getElementById('cardsGrid');
  if (!filtered.length) {
    grid.innerHTML=`<div class="empty"><div class="empty-title">No draws found</div><p>Try adjusting your filters.</p></div>`;
    return;
  }
  const show=filtered.slice(0,300);
  if (WRITEUPS) show.forEach(r=>{ if(!r.writeup){const k=`${r.Species}_${r.MU}_${r.Code}`;if(WRITEUPS[k])r.writeup=WRITEUPS[k];}});

  function buildBCCard(r,i) {
    const cls=oddsClass(r['%']), pct=fmt(r['%']);
    const fr = computeHarvestAvg(r.yearly_fill_rates);
    const frFmt = fr !== null ? fr + '%' : null;
    const frCls = fr !== null ? (fr >= 50 ? 'fill-high' : fr >= 25 ? 'fill-mid' : 'fill-low') : 'fill-none';

    const expandHTML = `
      <div class="expand-grid">
        <div class="ei"><div class="ei-label">Full MU</div><div class="ei-val">${r.MU}</div></div>
        <div class="ei"><div class="ei-label">Draw Code</div><div class="ei-val">${r.Code}</div></div>
        <div class="ei"><div class="ei-label">Zone</div><div class="ei-val">${r.Zone||'—'}</div></div>
        <div class="ei"><div class="ei-label">Season</div><div class="ei-val">${r.Season}</div></div>
        <div class="ei"><div class="ei-label">2024 Draw Odds</div><div class="ei-val">${r.Odds} (${pct})</div></div>
        <div class="ei"><div class="ei-label">Tags Available</div><div class="ei-val">${r.Tags}</div></div>
        ${fr!=null?`<div class="ei"><div class="ei-label">Harvest Success Rate (10yr avg)</div><div class="ei-val ${frCls}-text">${frFmt}</div></div>`:''}
        ${r.fill_rate_alltime!=null?`<div class="ei"><div class="ei-label">Harvest Success Rate (all-time)</div><div class="ei-val">${fmtFill(r.fill_rate_alltime)} <span style="font-size:10px;color:var(--text-muted)">(${r.fill_rate_years} yrs data)</span></div></div>`:''}
        ${r.Notes?`<div class="ei ei-note">📝 ${r.Notes}</div>`:''}
      </div>
      ${(()=>{
        const allEntries = Object.entries(r.yearly_draw_odds||{});
        const last10 = allEntries.sort((a,b)=>+a[0]-+b[0]).slice(-10).filter(e=>isFinite(parseFloat(e[1])) && parseFloat(e[1]) > 0 && parseFloat(e[1]) <= 100);
        const nYrs = last10.length;
        if (nYrs < 2) {
          return '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)"><div class="chart-label">Draw odds % by year — no data available</div></div>';
        }
        const wavg10 = Math.min(100, +(last10.reduce((s,e)=>s+parseFloat(e[1]),0)/nYrs).toFixed(1));
        const oddsObj = Object.fromEntries(last10);
        return '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">' +
          buildOddsLineChart(oddsObj, i, wavg10) +
          '<div class="chart-label">Draw odds % by year (' + (nYrs < 10 ? nYrs + ' yrs' : 'last 10') + ')' +
          ' · <span style="color:#4a7fd4">- - -</span> ' + wavg10 + '% avg' +
          '</div></div>';
      })()}
      ${fr!=null && Object.keys(r.yearly_fill_rates||{}).length>2?`
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
        ${buildGreenBarChart(Object.fromEntries(Object.entries(r.yearly_fill_rates||{}).map(([y,v])=>[y,parseFloat(v)*100])), 'bc'+i)}
        <div class="chart-label">Last 10 years of harvest data · <span style="color:#4ade80">AVG ${fr !== null ? fr + '%' : '—'}</span></div>
      </div>`:''}
      ${r.writeup ? (() => {
        const cleanText = t => (t||'').replace(/\u2014/g,'-').replace(/\u2013/g,'-').replace(/\u2018|\u2019/g,"'").replace(/\u201C|\u201D/g,'"');
        const parts = r.writeup.split('|||');
        const terrain = cleanText(parts[0]);
        const access = cleanText(parts[1]);
        const notesWarn = r.Notes ? `<div class="tc-warn"><svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1.5L13 12.5H1L7 1.5Z" stroke="#c47a1a" stroke-width="1.2" stroke-linejoin="round"/><path d="M7 6v3" stroke="#c47a1a" stroke-width="1.2" stroke-linecap="round"/><circle cx="7" cy="10.5" r="0.6" fill="#c47a1a"/></svg><span>${r.Notes}</span></div>` : '';
        return '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">' +
          '<button onclick="event.stopPropagation();toggleWriteup(this)" class="tc-toggle-btn">✦ Terrain &amp; Access <span class="tc-arrow">▾</span></button>' +
          '<div class="writeup-body tc-card" style="display:none;margin-top:10px">' +
          (terrain ? (
            '<div class="tc-section">' +
            '<div class="tc-section-label"><svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1 12L5 5l3 4 2-3 3 6H1z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>Terrain &amp; conditions</div>' +
            '<div class="tc-body">' + terrain + '</div>' +
            '</div>'
          ) : '') +
          (access ? (
            '<div class="tc-section">' +
            '<div class="tc-section-label"><svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="2.5" stroke="currentColor" stroke-width="1.1"/><path d="M2 13c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>Access &amp; what to expect</div>' +
            '<div class="tc-body">' + access + '</div>' +
            notesWarn +
            '</div>'
          ) : (notesWarn ? '<div class="tc-section">' + notesWarn + '</div>' : '')) +
          '</div></div>';
      })() : ''}
    `;

    return `<div class="card ${cls}" style="position:relative">
      <button class="star-btn ${isStarred(r) ? 'starred' : ''}" onclick="event.stopPropagation();toggleStar(${i})" title="Save draw">\u2605</button>
      <div class="card-header">
        <div>
          <div class="card-species">${r.Species}</div>
          <div class="card-class">${r.Class}${r.Zone?' &nbsp;·&nbsp; Zone '+r.Zone:''}</div>
          ${fr!=null?`<span class="fill-badge ${frCls}"><span class="fill-pct">${frFmt}</span><span class="fill-sub">&nbsp;Harvest Success Rate</span></span>`:`<span class="fill-badge fill-none"><span class="fill-sub">No Harvest Data</span></span>`}
        </div>
        <div class="odds-badge">
          <div class="odds-pct">${pct}</div>
          <div class="odds-ratio">${r.Odds}</div>
        </div>
      </div>
      <div class="card-info">
        <div class="ci"><div class="ci-label">Area</div><div class="ci-val hl">${r.Area}</div></div>
        <div class="ci"><div class="ci-label">Region</div><div class="ci-val">${r.MU_General} — ${r.MU_Name}</div></div>
        <div class="ci"><div class="ci-label">MU</div><div class="ci-val">${r.MU}</div></div>
        <div class="ci"><div class="ci-label">Tags</div><div class="ci-val">${r.Tags}</div></div>
      </div>
      <div class="card-footer">
        <div class="cf-item">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="1" y="2" width="10" height="9" rx="1.2" stroke="currentColor" stroke-width="1.2"/><path d="M4 1v2M8 1v2M1 5h10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          ${r.Season}
        </div>
        <div class="cf-item">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 8l1.5-4h5L10 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="3.5" cy="9" r="1" fill="currentColor"/><circle cx="8.5" cy="9" r="1" fill="currentColor"/><path d="M1 8h10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          ${r.Drive}
        </div>
      </div>
      <div class="card-expand" id="exp-${i}">${expandHTML}</div>
      <button class="expand-toggle" id="expbtn-${i}" onclick="toggleCard(${i})">▾ Show details</button>
      <button class="dd-open-btn" onclick="event.stopPropagation();openDrawDetail(${i})">View Full Page →</button>
    </div>`;
  }

  // Chunked render — paint first 30 cards immediately
  const CHUNK = 30;
  grid.innerHTML = show.slice(0, CHUNK).map((r,i) => buildBCCard(r,i)).join('');
  if (filtered.length>300) {
    grid.innerHTML+=`<div class="overflow-note">Showing 300 of ${filtered.length.toLocaleString()} — refine filters for more specific results</div>`;
  }

  if (show.length > CHUNK) {
    let offset = CHUNK;
    const overflowNote = grid.lastElementChild && grid.lastElementChild.classList.contains('overflow-note') ? grid.lastElementChild : null;
    function renderNextBCChunk() {
      if (offset >= show.length) return;
      const batch = show.slice(offset, offset + CHUNK);
      const frag = document.createDocumentFragment();
      const tmp = document.createElement('div');
      tmp.innerHTML = batch.map((r,j) => buildBCCard(r, offset+j)).join('');
      while (tmp.firstChild) {
        if (overflowNote) grid.insertBefore(tmp.firstChild, overflowNote);
        else grid.appendChild(tmp.firstChild);
      }
      offset += CHUNK;
      if (offset < show.length) requestAnimationFrame(renderNextBCChunk);
    }
    requestAnimationFrame(renderNextBCChunk);
  }
}

// Startup handled in startApp()

