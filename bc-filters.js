function fpBuildClassChips() {
  const wrap = document.getElementById('fpClassChips');
  if (!wrap) return;
  wrap.innerHTML = ['Antlered','Antlerless','Any'].map(c =>
    `<div class="fp-chip${fpSelClass.has(c)?' active':''}" onclick="fpToggleClass('${c}')">${c}</div>`
  ).join('');
  const cl = document.getElementById('fpClearClass');
  if (cl) cl.classList.toggle('vis', fpSelClass.size > 0);
}
function fpToggleClass(c) {
  if (fpSelClass.has(c)) fpSelClass.delete(c); else fpSelClass.add(c);
  fpBuildClassChips(); fpUpdateCta();
}

function fpBuildChips() {
  const all = [...new Set(DATA.map(r=>r.Species))].sort();
  document.getElementById('fpSpeciesChips').innerHTML = all.map(s =>
    `<div class="fp-chip${fpSelSpecies.has(s)?' active':''}" onclick="fpToggleSpecies('${s}')">${s}</div>`
  ).join('');
  const cl = document.getElementById('fpClearSpecies');
  if (cl) cl.classList.toggle('vis', fpSelSpecies.size > 0);
}

function fpBuildMU() {
  const relevant = fpSelSpecies.size===0 ? DATA : DATA.filter(r=>fpSelSpecies.has(r.Species));
  const nums = [...new Set(relevant.map(r=>r.MU_General))].sort((a,b)=>a-b);
  document.getElementById('fpMUGrid').innerHTML = nums.map(n =>
    `<div class="fp-mu-btn${fpSelMUs.has(n)?' active':''}" onclick="fpToggleMU(${n})">
      <div class="fp-mu-num">${n}</div>
      <div class="fp-mu-name">${MU_NAMES[n]||''}</div>
    </div>`
  ).join('');
  const cl = document.getElementById('fpClearMU');
  if (cl) cl.classList.toggle('vis', fpSelMUs.size > 0);
}

function fpToggleSpecies(s) {
  if (fpSelSpecies.has(s)) fpSelSpecies.delete(s); else fpSelSpecies.add(s);
  const relevant = fpSelSpecies.size===0 ? DATA : DATA.filter(r=>fpSelSpecies.has(r.Species));
  const validMUs = new Set(relevant.map(r=>r.MU_General));
  fpSelMUs.forEach(m => { if (!validMUs.has(m)) fpSelMUs.delete(m); });
  fpBuildChips(); fpBuildMU(); fpUpdateCta();
}

function fpToggleMU(n) {
  if (fpSelMUs.has(n)) fpSelMUs.delete(n); else fpSelMUs.add(n);
  fpBuildMU(); fpUpdateCta();
}

function fpClearFilter(type) {
  if (type==='species') { fpSelSpecies.clear(); fpBuildChips(); fpBuildMU(); }
  if (type==='class') { fpSelClass.clear(); fpBuildClassChips(); }
  if (type==='mu') { fpSelMUs.clear(); fpBuildMU(); }
  fpUpdateCta();
}

function fpOnSlider(v) {
  fpMinOdds = ODDS_STEPS[parseInt(v)];
  const n=document.getElementById('fpOddsNum'), u=document.getElementById('fpOddsUnit'), h=document.getElementById('fpOddsHint');
  if (fpMinOdds===0) { n.textContent='Any'; u.textContent=''; h.textContent='Showing all draws'; }
  else { n.textContent=fpMinOdds; u.textContent='%+'; h.textContent='Min '+fpMinOdds+'% odds'; }
  fpUpdateCta();
}


function fpOnHarvestSlider(v) {
  fpMinHarvest = FP_HARVEST_STEPS[parseInt(v)];
  const n=document.getElementById('fpHarvestNum'), u=document.getElementById('fpHarvestUnit'), h=document.getElementById('fpHarvestHint');
  if (!n) return;
  if (fpMinHarvest===0) { n.textContent='Any'; u.textContent=''; h.textContent='Showing all draws'; }
  else { n.textContent=fpMinHarvest; u.textContent='%+'; h.textContent='Min '+fpMinHarvest+'% success'; }
  fpUpdateCta();
}

function fpReset() {
  fpSelSpecies.clear(); fpSelClass.clear(); fpSelMUs.clear(); fpMinOdds=0; fpMinHarvest=0;
  const sl = document.getElementById('fpOddsSlider');
  if (sl) { sl.value=0; fpOnSlider(0); }
  const hs = document.getElementById('fpHarvestSlider');
  if (hs) { hs.value=0; fpOnHarvestSlider(0); }
}

function fpUpdateCta() {
  const count = DATA.filter(r => {
    if (fpSelSpecies.size>0 && !fpSelSpecies.has(r.Species)) return false;
    if (fpSelMUs.size>0 && !fpSelMUs.has(r.MU_General)) return false;
    if ((r['%']||0) < fpMinOdds) return false;
    if (fpMinHarvest > 0) {
      const hr = computeHarvestAvg(r.yearly_fill_rates);
      if (hr === null || hr < fpMinHarvest) return false;
    }
    if (fpSelClass.size > 0) {
      const cls = (r.Class || '').toLowerCase();
      const match = [...fpSelClass].some(c => {
        if (c === 'Antlered') return cls.includes('antlered') && !cls.includes('antlerless');
        if (c === 'Antlerless') return cls.includes('antlerless');
        if (c === 'Any') return !cls.includes('antlered') && !cls.includes('antlerless');
        return false;
      });
      if (!match) return false;
    }
    return true;
  }).length;
  const num = document.getElementById('fpMatchNum');
  if (num) num.textContent = count.toLocaleString();
  const lbl = document.getElementById('fpCtaLabel');
  if (lbl) lbl.textContent = 'Show Results';
}

function applyFiltersAndGoToDraws() {
  selSpecies = new Set(fpSelSpecies);
  selClass = new Set(fpSelClass);
  selMUs = new Set(fpSelMUs);
  selMinOdds = fpMinOdds;
  selMinHarvest = fpMinHarvest;
  // Sync the draws-page slider before showPage so applyFilters picks it up
  const idx = ODDS_STEPS.indexOf(fpMinOdds);
  const sl = document.getElementById('oddsSlider');
  if (sl && idx >= 0) sl.value = idx;
  // showPage('draws') already calls buildMUList, buildSpeciesChips, buildClassChips, applyFilters
  showPage('draws');
}




// [saved vars moved to top]

function saveToStorage() {
  try { localStorage.setItem('huntodds_saved', JSON.stringify(savedDraws)); } catch(e) {}
  updateSavedBadge();
}

function updateSavedBadge() {
  const badge = document.getElementById('savedBadge');
  const badgeMobile = document.getElementById('savedBadgeMobile');
  const total = savedDraws.length + abSavedDraws.length;
  [badge, badgeMobile].forEach(b => {
    if (!b) return;
    if (total > 0) { b.textContent = total; b.style.display = 'inline-flex'; }
    else { b.style.display = 'none'; }
  });
}

function abSaveToStorage() {
  try { localStorage.setItem('huntodds_ab_saved', JSON.stringify(abSavedDraws)); } catch(e) {}
  updateSavedBadge();
}

function abIsStarred(c) {
  const key = 'AB|' + c.species + '|' + c.wmu + '|' + c.draw;
  return abSavedDraws.some(s => s._key === key);
}

function abToggleStar(i) {
  const c = abLastFilteredCards[i];
  if (!c) return;
  const key = 'AB|' + c.species + '|' + c.wmu + '|' + c.draw;
  const idx = abSavedDraws.findIndex(s => s._key === key);
  if (idx >= 0) {
    abSavedDraws.splice(idx, 1);
  } else {
    abSavedDraws.push({...c, _key: key, _province: 'AB'});
  }
  abSaveToStorage();
  const btn = document.querySelector('button.star-btn[data-abidx="' + i + '"]');
  if (btn) {
    const starred = abIsStarred(c);
    btn.classList.toggle('starred', starred);
    btn.style.opacity = starred ? '1' : '';
  }
}

function abRemoveSaved(key) {
  abSavedDraws = abSavedDraws.filter(s => s._key !== key);
  abSaveToStorage();
  renderComparePage();
}

function isStarred(r) {
  const key = r.Species + '|' + r.MU + '|' + r.Code;
  return savedDraws.some(s => s._key === key);
}

function toggleStar(i) {
  const r = filtered[i];
  if (!r) return;
  const key = r.Species + '|' + r.MU + '|' + r.Code;
  const idx = savedDraws.findIndex(s => s._key === key);
  if (idx >= 0) {
    savedDraws.splice(idx, 1);
  } else {
    savedDraws.push({...r, _key: key});
  }
  saveToStorage();
  // Update just this card's star without full re-render
  const btn = document.querySelector(`button.star-btn[onclick*="toggleStar(${i})"]`);
  if (btn) btn.classList.toggle('starred', isStarred(r));
}

function removeSaved(key) {
  savedDraws = savedDraws.filter(s => s._key !== key);
  saveToStorage();
  renderSavedPage();
}

function clearAllSaved() {
  if (!confirm('Remove all saved draws?')) return;
  savedDraws = [];
  abSavedDraws = [];
  compareSelected.clear();
  saveToStorage();
  abSaveToStorage();
  renderSavedPage();
  updateSavedBadge();
}

function toggleCompare() {
  compareMode = !compareMode;
  compareSelected.clear();
  document.getElementById('comparePanel').style.display = 'none';
  renderSavedPage();
}

function closeCompare() {
  compareMode = false;
  compareSelected.clear();
  document.getElementById('comparePanel').style.display = 'none';
  renderSavedPage();
}

function toggleCompareSelect(key) {
  if (compareSelected.has(key)) {
    compareSelected.delete(key);
  } else {
    if (compareSelected.size >= 4) {
      alert('Compare up to 4 draws at a time.');
      return;
    }
    compareSelected.add(key);
  }
  renderSavedPage();
}

function launchCompare() {
  if (compareSelected.size >= 2) buildComparePanel();
}

function buildComparePanel() {
  const draws = savedDraws.filter(s => compareSelected.has(s._key));
  if (draws.length < 2) return;

  // Remove existing modal if present
  const existing = document.getElementById('compareModal');
  if (existing) existing.remove();

