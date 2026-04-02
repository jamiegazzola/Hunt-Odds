
// ── AB FILTER PAGE ──
function abFpBuildClassChips() {
  const wrap = document.getElementById('abFpClassChips');
  if (!wrap) return;
  wrap.innerHTML = ['Antlered','Antlerless','Any'].map(c =>
    `<button class="fp-chip ${abFpSelClass.has(c)?'active':''}" onclick="abFpToggleClass('${c}')">${c}</button>`
  ).join('');
}
function abFpToggleClass(c) {
  abFpSelClass.has(c) ? abFpSelClass.delete(c) : abFpSelClass.add(c);
  document.querySelectorAll('#abFpClassChips .fp-chip').forEach(b =>
    b.classList.toggle('active', abFpSelClass.has(b.textContent.trim()))
  );
  abFpUpdateCount();
}

function abFpBuildChips() {
  const wrap = document.getElementById('abFpSpeciesChips');
  if (!wrap || AB_DATA.length===0) return;
  const all = [...new Set(AB_DATA.map(r=>r.species))].sort();
  wrap.innerHTML = all.map(s =>
    `<button class="fp-chip ${abFpSelSpecies.has(s)?'active':''}" onclick="abFpToggleSpecies('${s}')">${s}</button>`
  ).join('');
  abFpUpdatePointsSection();
}
function abFpBuildWMU() {
  const wrap = document.getElementById('abFpWMUChips');
  if (!wrap||AB_DATA.length===0) return;
  const wmus = [...new Set(AB_DATA.map(r=>r.wmu))].sort((a,b)=>parseInt(a)-parseInt(b));
  wrap.innerHTML = wmus.map(w =>
    `<button class="fp-chip ${abFpSelWMU.has(w)?'active':''}" onclick="abFpToggleWMU('${w}')" style="font-size:11px;padding:5px 10px">${w}</button>`
  ).join('');
}
function abFpToggleSpecies(s) {
  abFpSelSpecies.has(s)?abFpSelSpecies.delete(s):abFpSelSpecies.add(s);
  document.querySelectorAll('#abFpSpeciesChips .fp-chip').forEach(b =>
    b.classList.toggle('active', abFpSelSpecies.has(b.textContent.trim()))
  );
  abFpUpdatePointsSection(); abFpUpdateCount();
}
function abFpToggleWMU(w) {
  abFpSelWMU.has(w)?abFpSelWMU.delete(w):abFpSelWMU.add(w);
  document.querySelectorAll('#abFpWMUChips .fp-chip').forEach(b =>
    b.classList.toggle('active', abFpSelWMU.has(b.textContent.trim()))
  );
  abFpUpdateCount();
}
function abFpUpdatePointsSection() {
  const section=document.getElementById('abPointsSection');
  const wrap=document.getElementById('abPointsInputs');
  if(!section||!wrap) return;
  section.style.display='block';
  const species = abFpSelSpecies.size>0 ? [...abFpSelSpecies].sort() : [...new Set(AB_DATA.map(r=>r.species))].sort();
  wrap.innerHTML = species.map(s => {
    const val = abProfile?.priorities ? (Object.entries(abProfile.priorities).find(([k])=>s.toLowerCase().includes(k.split('_')[1]||''))?.[1] || '') : '';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:14px;color:var(--text-primary);font-weight:500">${s}</span>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:12px;color:var(--text-muted)">pts</span>
        <input type="number" min="0" max="50" placeholder="0"
          oninput="abSetPtsForSpecies('${s}',this.value)"
          style="width:60px;padding:6px 8px;background:var(--bg-secondary,#1a1a1a);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:14px;text-align:center">
      </div>
    </div>`;
  }).join('');
}

// Map species name to all relevant priority keys
function abSetPtsForSpecies(species, val) {
  const s = species.toLowerCase();
  const num = val===''?'':parseInt(val);
  if (!abProfile) return;
  AB_PRIORITY_CATS.forEach(cat => {
    const group = cat.group.toLowerCase();
    if (s.includes('moose') && group.includes('moose')) abProfile.priorities[cat.key] = num;
    if ((s.includes('mule deer')) && cat.key.includes('mule')) abProfile.priorities[cat.key] = num;
    if ((s.includes('white') || s.includes('whitetail')) && cat.key.includes('whitetail')) abProfile.priorities[cat.key] = num;
    if (s.includes('elk') && group.includes('elk')) abProfile.priorities[cat.key] = num;
    if (s.includes('antelope') && group.includes('antelope')) abProfile.priorities[cat.key] = num;
    if (s.includes('sheep') && group.includes('sheep')) abProfile.priorities[cat.key] = num;
    if (s.includes('bison') && cat.key==='bison') abProfile.priorities[cat.key] = num;
    if (s.includes('turkey') && cat.key==='cougar') {}  // no mapping for turkey
  });
}

function abFpOnSlider(v) {
  abFpMinOdds=parseInt(v);
  const val=AB_ODDS_STEPS[abFpMinOdds]||0;
  const n=document.getElementById('abFpOddsNum'),u=document.getElementById('abFpOddsUnit'),h=document.getElementById('abFpOddsHint');
  if(n) n.textContent=val===0?'Any':val+'%';
  if(u) u.textContent=val>0?'+':'';
  if(h) h.textContent=val===0?'Showing all draws':'Min '+val+'% odds';
  abFpUpdateCount();
}
function abFpOnHarvestSlider(v) {
  abFpMinHarvest = FP_HARVEST_STEPS[parseInt(v)] || 0;
  const n=document.getElementById('abFpHarvestNum'), u=document.getElementById('abFpHarvestUnit'), h=document.getElementById('abFpHarvestHint');
  if (!n) return;
  if (abFpMinHarvest===0) { n.textContent='Any'; u.textContent=''; h.textContent='Showing all draws'; }
  else { n.textContent=abFpMinHarvest; u.textContent='%+'; h.textContent='Min '+abFpMinHarvest+'% success'; }
  abFpUpdateCount();
}

// AB filter page map toggle
let abFpMapOpen = false;
let abFpMapInitialized = false;
let abFpLeafletInstance = null;
let abFpGeoLayer = null;
function abFpToggleMap() {
  const panel = document.getElementById('abFpMapPanel');
  const btn = document.getElementById('abFpMapBtn');
  if (!panel || !btn) return;
  abFpMapOpen = !abFpMapOpen;
  panel.style.display = abFpMapOpen ? 'block' : 'none';
  btn.style.background = abFpMapOpen ? 'rgba(74,222,128,.22)' : 'rgba(74,222,128,.1)';
  btn.innerHTML = abFpMapOpen
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Close Map`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg> Filter by Map`;
  if (abFpMapOpen) {
    const container = document.getElementById('abFpLeafletMap');
    if (!abFpMapInitialized || (container && !container._leaflet_id)) {
      abFpMapInitialized = false; abFpLeafletInstance = null; abFpGeoLayer = null;
      abFpInitMap();
    } else {
      setTimeout(() => abFpLeafletInstance && abFpLeafletInstance.invalidateSize(), 150);
    }
  }
}
function abFpInitMap() {
  if (abFpMapInitialized) return;
  abFpMapInitialized = true;
  function initWhenReady() {
    const container = document.getElementById('abFpLeafletMap');
    if (!container) return;
    abFpLeafletInstance = L.map('abFpLeafletMap', { center:[54.0,-115.0], zoom:5, minZoom:4, maxZoom:13, scrollWheelZoom:true, touchZoom:true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap', maxZoom:19 }).addTo(abFpLeafletInstance);
    abFpGeoLayer = L.geoJSON(AB_WMU_GEOJSON, {
      style: feature => {
        const id = String(feature.properties.WMUNIT_NUM || '');
        const sel = abFpSelWMU.has(id);
        return { fillColor: sel ? '#4ade80' : '#6aab76', fillOpacity: sel ? 0.75 : 0.35, color: sel ? '#fff' : '#1a1a1a', weight: sel ? 2.5 : 0.7 };
      },
      onEachFeature: (feature, layer) => {
        const id = String(feature.properties.WMUNIT_NUM || '');
        layer.on('click', () => { abFpToggleWMU(id); abFpRefreshMapStyles(); });
        layer.on('mouseover', function() { if (!abFpSelWMU.has(id)) this.setStyle({ fillColor:'#fff', fillOpacity:0.4, color:'#4ade80', weight:1.5 }); });
        layer.on('mouseout', function() { this.setStyle({ fillColor: abFpSelWMU.has(id)?'#4ade80':'#6aab76', fillOpacity: abFpSelWMU.has(id)?0.75:0.35, color: abFpSelWMU.has(id)?'#fff':'#1a1a1a', weight: abFpSelWMU.has(id)?2.5:0.7 }); });
      }
    }).addTo(abFpLeafletInstance);
    abFpLeafletInstance.fitBounds([[49.0,-120.0],[60.0,-110.0]]);
  }
  if (typeof L !== 'undefined') initWhenReady();
  else { const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; s.onload=initWhenReady; document.head.appendChild(s); }
}
function abFpRefreshMapStyles() {
  if (!abFpGeoLayer) return;
  abFpGeoLayer.eachLayer(layer => {
    const id = String(layer.feature.properties.WMUNIT_NUM || '');
    const sel = abFpSelWMU.has(id);
    layer.setStyle({ fillColor: sel?'#4ade80':'#6aab76', fillOpacity: sel?0.75:0.35, color: sel?'#fff':'#1a1a1a', weight: sel?2.5:0.7 });
  });
  // Update chip display
  const chips = document.getElementById('abFpMapChips');
  if (!chips) return;
  if (abFpSelWMU.size === 0) { chips.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">Click zones to filter</span>'; return; }
  chips.innerHTML = [...abFpSelWMU].sort((a,b)=>parseInt(a)-parseInt(b)).map(w =>
    `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px 3px 10px;background:rgba(74,222,128,.15);border:1px solid rgba(74,222,128,.35);border-radius:12px;font-size:11px;font-weight:700;color:#4ade80">WMU&nbsp;${w}<span onclick="abFpToggleWMU('${w}');abFpRefreshMapStyles()" style="cursor:pointer;opacity:.65;font-size:14px;line-height:1;margin-left:1px">×</span></span>`
  ).join('');
}
function abFpUpdateCount() {
  if(!AB_DATA.length) return;
  const cards=buildABCards();
  const thresh=AB_ODDS_STEPS[abFpMinOdds]||0;
  const count=cards.filter(c=>{
    if(abFpSelSpecies.size>0&&!abFpSelSpecies.has(c.species)) return false;
    if(abFpSelWMU.size>0&&!abFpSelWMU.has(String(c.wmu))) return false;
    if(abFpSelClass.size>0){
      const d=(c.draw||'').toLowerCase();
      const match=[...abFpSelClass].some(cl=>{
        if(cl==='Antlered') return d.includes('antlered')&&!d.includes('antlerless');
        if(cl==='Antlerless') return d.includes('antlerless');
        if(cl==='Any') return !d.includes('antlered')&&!d.includes('antlerless');
        return false;
      });
      if(!match) return false;
    }
    const odds=c.personalOdds!==null?c.personalOdds:c.latestOdds;
    if (odds<thresh) return false;
    if (abFpMinHarvest > 0) {
      const hv = computeABHarvestAvgCached(c.species, c.wmu);
      if (hv === null || hv < abFpMinHarvest) return false;
    }
    return true;
  }).length;
  const el=document.getElementById('abFpMatchNum'); if(el) el.textContent=count.toLocaleString();
  const cta=document.getElementById('abFpCtaLabel'); if(cta) cta.textContent=`Explore ${count.toLocaleString()} Results`;
}
function abFpSetSort(mode,btn) {
  abFpSortMode=mode; abSortMode=mode;
  document.querySelectorAll('#abFpSortChips .fp-sort-chip').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
}
function abFpClearFilter(type) {
  if(type==='species'){abFpSelSpecies.clear();abFpBuildChips();}
  if(type==='class'){abFpSelClass.clear();abFpBuildClassChips();}
  if(type==='wmu'){abFpSelWMU.clear();abFpBuildWMU();}
  abFpUpdateCount();
}
function abFpReset() { abFpSelSpecies.clear(); abFpSelClass.clear(); abFpSelWMU.clear(); abFpMinOdds=0; abFpMinHarvest=0; const sl=document.getElementById('abFpOddsSlider');if(sl)sl.value=0; const hs=document.getElementById('abFpHarvestSlider');if(hs)hs.value=0; }
function abFpGoToDraws() {
  abSelSpecies=new Set(abFpSelSpecies); abSelClass=new Set(abFpSelClass);
  // Merge WMU from chips and map
  abSelWMU=new Set(abFpSelWMU);
  abMinOdds=abFpMinOdds; abSortMode=abFpSortMode;
  abMinHarvest=abFpMinHarvest;
  const sl=document.getElementById('abOddsSlider'); if(sl) sl.value=abMinOdds;
  showPage('abDraws');
}

// ══════════════════════════════════════════════════════════════
// ── ALBERTA PROFILE PAGE
// ══════════════════════════════════════════════════════════════
function renderAbProfilePage() {
  const page = document.getElementById('abProfilePage');
  if (!page) return;
  const p = abProfile || defaultAbProfile();

  const resOptions = [
    {val:'ab_resident', label:'Alberta Resident'},
    {val:'non_resident_canadian', label:'Non-resident Canadian'},
    {val:'non_resident_alien', label:'Non-resident Alien'},
  ];

  const groupedCats = AB_PRIORITY_GROUPS.map(group => {
    const cats = AB_PRIORITY_CATS.filter(c => c.group === group);
    const rows = cats.map(cat => {
      const val = p.priorities[cat.key];
      const displayVal = (val===''||val===null||val===undefined) ? '' : val;
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:14px;color:var(--text-primary)">${cat.label}</span>
        <input type="number" min="0" max="50" placeholder="—" value="${displayVal}"
          oninput="abProfileSetPriority('${cat.key}',this.value)"
          style="width:64px;padding:7px 10px;background:var(--bg-primary);border:1.5px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:15px;text-align:center;font-weight:600">
      </div>`;
    }).join('');
    return `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);margin-bottom:10px">${group}</div>
      ${rows}
    </div>`;
  }).join('');

  const savedMsg = document.getElementById('abProfileSavedMsg');

  page.innerHTML = `
    <div style="max-width:540px;margin:0 auto;padding:24px 16px 100px">
      <div style="margin-bottom:24px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);margin-bottom:6px">Alberta</div>
        <div style="font-size:26px;font-weight:800;color:var(--text-primary);margin-bottom:6px">My Draw Profile</div>
        <div style="font-size:13px;color:var(--text-muted);line-height:1.5">Set your residency and priority points once. The app uses this to personalize your Alberta draw odds.</div>
      </div>

      <!-- Eligibility -->
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);margin-bottom:14px">Eligibility</div>

        <div style="margin-bottom:14px">
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px">Residency Status</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${resOptions.map(o=>`
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                <input type="radio" name="abResidency" value="${o.val}" ${p.residencyStatus===o.val?'checked':''}
                  onchange="abProfileSet('residencyStatus','${o.val}')"
                  style="accent-color:var(--accent);width:16px;height:16px">
                <span style="font-size:14px;color:var(--text-primary)">${o.label}</span>
              </label>`).join('')}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px;background:var(--bg-primary);border-radius:10px;border:1px solid var(--border)">
            <input type="checkbox" ${p.hasHost?'checked':''} onchange="abProfileSet('hasHost',this.checked)" style="accent-color:var(--accent);width:15px;height:15px">
            <span style="font-size:13px;color:var(--text-primary)">Has AB Host</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px;background:var(--bg-primary);border-radius:10px;border:1px solid var(--border)">
            <input type="checkbox" ${p.hasWIN?'checked':''} onchange="abProfileSet('hasWIN',this.checked)" style="accent-color:var(--accent);width:15px;height:15px">
            <span style="font-size:13px;color:var(--text-primary)">Has WIN #</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px;background:var(--bg-primary);border-radius:10px;border:1px solid var(--border)">
            <input type="checkbox" ${p.hunterEdCompleted?'checked':''} onchange="abProfileSet('hunterEdCompleted',this.checked)" style="accent-color:var(--accent);width:15px;height:15px">
            <span style="font-size:13px;color:var(--text-primary)">Hunter Ed Done</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px;background:var(--bg-primary);border-radius:10px;border:1px solid var(--border)">
            <input type="checkbox" ${p.isSenior?'checked':''} onchange="abProfileSet('isSenior',this.checked)" style="accent-color:var(--accent);width:15px;height:15px">
            <span style="font-size:13px;color:var(--text-primary)">Senior</span>
          </label>
        </div>
      </div>

      <!-- Priority Points -->
      <div style="margin-bottom:6px">
        <div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:4px">Priority Points by Category</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;line-height:1.5">Enter your Alberta draw priority for each category. These are not tied to one WMU — the app compares them across all relevant hunts.</div>
      </div>
      ${groupedCats}

      <!-- Save / Reset -->
      <div id="abProfileSavedMsg" style="display:none;text-align:center;padding:10px;color:#4ade80;font-size:13px;font-weight:600;margin-bottom:10px">✓ Profile saved!</div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <button onclick="abProfileReset()" style="flex:1;padding:13px;background:var(--bg-card);border:1.5px solid var(--border);border-radius:12px;color:var(--text-secondary);font-size:15px;font-weight:600;cursor:pointer">Reset</button>
        <button onclick="abProfileSave()" style="flex:2;padding:13px;background:var(--accent);border:none;border-radius:12px;color:#fff;font-size:15px;font-weight:600;cursor:pointer">Save Profile →</button>
      </div>
      <button onclick="showPage('abFilter')" style="width:100%;margin-top:12px;padding:11px;background:none;border:none;color:var(--text-muted);font-size:13px;cursor:pointer">Skip — Explore Without Profile</button>
    </div>`;

  // Wire up current temp profile for edits
  window._abProfileTemp = JSON.parse(JSON.stringify(p));
}

let _abProfileTemp = null;
function abProfileSet(field, val) {
  if (!_abProfileTemp) _abProfileTemp = defaultAbProfile();
  _abProfileTemp[field] = val;
}
function abProfileSetPriority(key, val) {
  if (!_abProfileTemp) _abProfileTemp = defaultAbProfile();
  _abProfileTemp.priorities[key] = val===''?'':parseInt(val)||0;
}
function abProfileSave() {
  if (!_abProfileTemp) _abProfileTemp = defaultAbProfile();
  // Collect all radio/checkbox values from DOM
  const res = document.querySelector('input[name="abResidency"]:checked');
  if (res) _abProfileTemp.residencyStatus = res.value;
  saveAbProfile(_abProfileTemp);
  const msg = document.getElementById('abProfileSavedMsg');
  if (msg) msg.style.display = 'block';
  // Swap save button to Explore, then auto-navigate after a moment
  const saveBtn = document.querySelector('[onclick="abProfileSave()"]');
  if (saveBtn) {
    saveBtn.textContent = '✓ Explore Draw Odds →';
    saveBtn.style.background = '#166534';
    saveBtn.setAttribute('onclick', "showPage('abDraws')");
  }
  setTimeout(() => showPage('abDraws'), 1200);
}
function abProfileReset() {
  if (!confirm('Reset your Alberta profile?')) return;
  clearAbProfile();
  _abProfileTemp = defaultAbProfile();
  renderAbProfilePage();
}

// ══════════════════════════════════════════════════════════════
// ── COMPARE PAGE
// ══════════════════════════════════════════════════════════════
