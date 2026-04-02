let DATA = [];
let WRITEUPS = null;
let WRITEUPS_LOADING = null;
let AB_DATA = [];

// ── ALBERTA PROFILE (localStorage) ──
const AB_PROFILE_KEY = 'huntsmart_ab_profile';
let abProfile = null;

function loadAbProfile() {
  try { abProfile = JSON.parse(localStorage.getItem(AB_PROFILE_KEY)) || null; } catch(e) { abProfile = null; }
}
function saveAbProfile(p) {
  abProfile = p;
  localStorage.setItem(AB_PROFILE_KEY, JSON.stringify(p));
}
function clearAbProfile() {
  abProfile = null;
  localStorage.removeItem(AB_PROFILE_KEY);
}
let activeProvince = 'BC'; // 'BC' or 'AB'

// ── DATA SOURCES ──
const DATA_URL = 'https://raw.githubusercontent.com/jamiegazzola/Hunt-Odds/main/data/draws.json';
const WRITEUPS_URL = 'https://raw.githubusercontent.com/jamiegazzola/Hunt-Odds/main/data/writeups.json';
const AB_DATA_URL = 'https://raw.githubusercontent.com/jamiegazzola/Hunt-Odds/main/data/AlbertaData.json';
const AB_HARVEST_URL = 'https://raw.githubusercontent.com/jamiegazzola/Hunt-Odds/main/data/alberta_2024_huntcode_harvest_success_matched_only.json';
let AB_HARVEST = null;
const AB_ELK_HISTORY_URL = 'https://raw.githubusercontent.com/jamiegazzola/Hunt-Odds/main/data/AB_ELK_10YRDATA.json';
let AB_ELK_HISTORY = null; // { wmu: { year: pct, ... }, ... } — also handles grouped WMUs
const AB_MOOSE_HISTORY_URL = 'https://raw.githubusercontent.com/jamiegazzola/Hunt-Odds/main/data/alberta_moose_harvest_2015_2024.json';
let AB_MOOSE_HISTORY = null; // { wmu: { year: pct, ... } }
const AB_MULEDEER_HISTORY_URL = 'https://raw.githubusercontent.com/jamiegazzola/Hunt-Odds/main/data/alberta_mule_deer_harvest_2015_2024.json';
let AB_MULEDEER_HISTORY = null; // { wmu: { year: pct, ... } }
const AB_ANTELOPE_HISTORY_URL = 'https://raw.githubusercontent.com/jamiegazzola/Hunt-Odds/main/data/alberta_antelope_harvest_2015_2024.json';
let AB_ANTELOPE_HISTORY = null; // { wmu: { year: pct, ... } }
const AB_WTDEER_HISTORY_URL = 'https://raw.githubusercontent.com/jamiegazzola/Hunt-Odds/main/data/alberta_white_tailed_deer_harvest_2015_2024.json';
let AB_WTDEER_HISTORY = null; // { wmu: { year: pct, ... } }
const AB_BISON_HISTORY_URL = 'https://raw.githubusercontent.com/jamiegazzola/Hunt-Odds/main/data/alberta_wood_bison_harvest_2015_2025.json';
let AB_BISON_HISTORY = null; // [ { season, pct }, ... ] — province-level, no WMU breakdown

async function loadAppData() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`Failed to load draw data: ${response.status}`);
  DATA = await response.json();
}

async function loadABData() {
  if (AB_DATA.length > 0) return;
  const response = await fetch(AB_DATA_URL);
  if (!response.ok) throw new Error(`Failed to load Alberta data: ${response.status}`);
  const raw = await response.json();
  // Filter junk rows and invalid pctDrawn
  AB_DATA = raw.filter(r => r.wmu && !r.wmu.includes('*') && r.pctDrawn <= 100);
  _abAllCardsCache = null; // invalidate card cache
}
async function loadABHarvest() {
  if (AB_HARVEST) return;
  try {
    const r = await fetch(AB_HARVEST_URL);
    const arr = r.ok ? await r.json() : [];
    AB_HARVEST = {};
    for (const rec of arr) {
      const key = `${rec.species}||${rec.draw}||${rec.wmu}`;
      // Prefer draw_choice matches over wmu matches
      if (!(key in AB_HARVEST) || rec.matchedBy === 'draw_choice') {
        AB_HARVEST[key] = {
          pct: rec.participantSuccessPercent,
          participants: rec.totalParticipants ?? rec.participants ?? rec.licencesIssued ?? rec.total_participants ?? null
        };
      }
    }
  } catch(e) { AB_HARVEST = {}; }
}

async function loadABElkHistory() {
  if (AB_ELK_HISTORY) return;
  try {
    const r = await fetch(AB_ELK_HISTORY_URL);
    const d = r.ok ? await r.json() : null;
    if (!d || !d.records) { AB_ELK_HISTORY = {}; return; }
    // Build lookup: wmu -> { year -> pct }
    // For grouped WMUs like "124/144/148/150", index each individual WMU separately
    AB_ELK_HISTORY = {};
    for (const rec of d.records) {
      const pct = rec.est_hunter_success_percent ?? rec.est_hunter_success_pct ?? rec.estimated_hunter_success_percent;
      if (pct === null || pct === undefined) continue;
      const wmus = rec.wmu.split('/').map(w => w.trim());
      for (const wmu of wmus) {
        if (!AB_ELK_HISTORY[wmu]) AB_ELK_HISTORY[wmu] = {};
        // Keep the most recent entry if duplicate years (prefer individual over grouped)
        if (!(rec.year in AB_ELK_HISTORY[wmu]) || wmus.length === 1) {
          AB_ELK_HISTORY[wmu][rec.year] = pct;
        }
      }
    }
  } catch(e) { console.error('[ElkHistory] failed:', e); AB_ELK_HISTORY = {}; }
}

async function loadABMooseHistory() {
  if (AB_MOOSE_HISTORY) return;
  try {
    const r = await fetch(AB_MOOSE_HISTORY_URL);
    const d = r.ok ? await r.json() : null;
    if (!d || !d.records) { AB_MOOSE_HISTORY = {}; return; }
    AB_MOOSE_HISTORY = {};
    for (const rec of d.records) {
      const pct = rec.est_hunter_success_pct ?? rec.est_hunter_success_percent ?? rec.estimated_hunter_success_percent;
      if (pct === null || pct === undefined) continue;
      const wmus = String(rec.wmu).split('/').map(w => w.trim());
      for (const wmu of wmus) {
        if (!AB_MOOSE_HISTORY[wmu]) AB_MOOSE_HISTORY[wmu] = {};
        if (!(rec.year in AB_MOOSE_HISTORY[wmu]) || wmus.length === 1) {
          AB_MOOSE_HISTORY[wmu][rec.year] = pct;
        }
      }
    }
  } catch(e) { console.error('[MooseHistory] failed:', e); AB_MOOSE_HISTORY = {}; }
}

async function loadABMuleDeerHistory() {
  if (AB_MULEDEER_HISTORY) return;
  try {
    const r = await fetch(AB_MULEDEER_HISTORY_URL);
    const d = r.ok ? await r.json() : null;
    if (!d || !d.records) { AB_MULEDEER_HISTORY = {}; return; }
    AB_MULEDEER_HISTORY = {};
    for (const rec of d.records) {
      const pct = rec.estimated_hunter_success_percent;
      if (pct === null || pct === undefined) continue;
      const wmus = String(rec.wmu).split('/').map(w => w.trim());
      for (const wmu of wmus) {
        if (!AB_MULEDEER_HISTORY[wmu]) AB_MULEDEER_HISTORY[wmu] = {};
        if (!(rec.year in AB_MULEDEER_HISTORY[wmu]) || wmus.length === 1) {
          AB_MULEDEER_HISTORY[wmu][rec.year] = pct;
        }
      }
    }
  } catch(e) { console.error('[MuleDeerHistory] failed:', e); AB_MULEDEER_HISTORY = {}; }
}

async function loadABAntelopeHistory() {
  if (AB_ANTELOPE_HISTORY) return;
  try {
    const r = await fetch(AB_ANTELOPE_HISTORY_URL);
    const d = r.ok ? await r.json() : null;
    if (!d || !d.records) { AB_ANTELOPE_HISTORY = {}; return; }
    AB_ANTELOPE_HISTORY = {};
    for (const rec of d.records) {
      const pct = rec.est_hunter_success_percent ?? rec.est_hunter_success_pct ?? rec.estimated_hunter_success_percent;
      if (pct === null || pct === undefined) continue;
      const wmus = String(rec.wmu_group || rec.wmu || '').split(/[\/,]/).map(w => w.trim()).filter(Boolean);
      for (const wmu of wmus) {
        if (!AB_ANTELOPE_HISTORY[wmu]) AB_ANTELOPE_HISTORY[wmu] = {};
        if (!(rec.year in AB_ANTELOPE_HISTORY[wmu]) || wmus.length === 1) {
          AB_ANTELOPE_HISTORY[wmu][rec.year] = pct;
        }
      }
    }
  } catch(e) { console.error('[AntelopeHistory] failed:', e); AB_ANTELOPE_HISTORY = {}; }
}

async function loadABWTDeerHistory() {
  if (AB_WTDEER_HISTORY) return;
  try {
    const r = await fetch(AB_WTDEER_HISTORY_URL);
    const d = r.ok ? await r.json() : null;
    if (!d || !d.records) { AB_WTDEER_HISTORY = {}; return; }
    AB_WTDEER_HISTORY = {};
    for (const rec of d.records) {
      const pct = rec.estimated_hunter_success_percent;
      if (pct === null || pct === undefined) continue;
      const wmus = String(rec.wmu).split('/').map(w => w.trim());
      for (const wmu of wmus) {
        if (!AB_WTDEER_HISTORY[wmu]) AB_WTDEER_HISTORY[wmu] = {};
        if (!(rec.year in AB_WTDEER_HISTORY[wmu]) || wmus.length === 1) {
          AB_WTDEER_HISTORY[wmu][rec.year] = pct;
        }
      }
    }
  } catch(e) { console.error('[WTDeerHistory] failed:', e); AB_WTDEER_HISTORY = {}; }
}

async function loadABBisonHistory() {
  if (AB_BISON_HISTORY) return;
  try {
    const r = await fetch(AB_BISON_HISTORY_URL);
    const d = r.ok ? await r.json() : null;
    if (!d || !d.records) { AB_BISON_HISTORY = []; return; }
    // Keep only open seasons with a real success rate; skip suspended/ongoing
    AB_BISON_HISTORY = d.records
      .filter(rec => rec.season_status === 'Open' && rec.success_rate_percent !== null && rec.success_rate_percent > 0)
      .map(rec => ({ season: rec.season_year, pct: rec.success_rate_percent }));
  } catch(e) { console.error('[BisonHistory] failed:', e); AB_BISON_HISTORY = []; }
}

async function loadWriteups() {
  if (WRITEUPS) return WRITEUPS;
  if (WRITEUPS_LOADING) return WRITEUPS_LOADING;
  WRITEUPS_LOADING = fetch(WRITEUPS_URL)
    .then(r => r.ok ? r.json() : {})
    .then(data => { WRITEUPS = data; return data; });
  return WRITEUPS_LOADING;
}

function getWriteup(r) {
  if (!WRITEUPS) return null;
  const key = `${r.Species}_${r.MU}_${r.Code}`;
  return WRITEUPS[key] || null;
}

async function startApp() {
  try {
    loadAbProfile();
    await loadAppData();
    buildSpeciesChips();
    buildMUList();
    buildClassChips();
    applyFilters();
    showPage('home');
    updateSavedBadge();
    // ── BACKGROUND PREFETCH ─────────────────────────────────────
    // After the UI is painted, silently load everything so that
    // switching to Alberta or opening the map feels instant.
    setTimeout(() => {
      // 1. Leaflet JS + CSS — so the map script is parsed and ready
      if (typeof L === 'undefined') {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
        document.head.appendChild(css);
        const js = document.createElement('script');
        js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
        document.head.appendChild(js);
      }
      // 2. All Alberta data files — parallel, silent
      loadABData();
      loadABHarvest();
      loadABElkHistory();
      loadABMooseHistory();
      loadABMuleDeerHistory();
      loadABAntelopeHistory();
      loadABWTDeerHistory();
      loadABBisonHistory();
      // 3. BC writeups
      loadWriteups();
    }, 100); // start prefetch almost immediately — writeups must be ready before user hits Show Results
  } catch (error) {
    console.error(error);
    document.body.innerHTML = '<div style="padding:24px;font-family:DM Sans, sans-serif;color:#f0f2f4;background:#111214;min-height:100vh">Failed to load app data.</div>';
  }
}

