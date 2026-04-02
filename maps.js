function abWmuFillColor(wmuNum) {
  const n = parseInt(wmuNum);
  if (n >= 500) return '#4a8f5a';   // dark green — far north
  if (n >= 400) return '#6aab76';   // green — north central
  if (n >= 300) return '#9bc46a';   // yellow-green — peace country
  if (n >= 200) return '#c49a35';   // amber — foothills
  if (n >= 100) return '#c06828';   // orange — south
  if (n >= 700) return '#7a8fd4';   // blue-purple — antelope zones
  return '#666';
}

// ── STYLE FUNCTION ──
// Cache of WMU ids that have real cards — rebuilt by abUpdateMapStyles after each filter run
let _abWmuWithCards = null;

function abWmuGetStyle(feature, isSelected) {
  const id = String(feature.properties.WMUNIT_NUM || '');
  const hasDraws = AB_DATA.length === 0 || (_abWmuWithCards ? _abWmuWithCards.has(id) : AB_DATA.some(r => String(r.wmu) === id));
  return {
    fillColor: isSelected ? '#4ade80' : abWmuFillColor(id),
    fillOpacity: isSelected ? 0.75 : hasDraws ? 0.38 : 0.15,
    color: isSelected ? '#ffffff' : '#1a1a1a',
    weight: isSelected ? 2.5 : 0.7,
    opacity: isSelected ? 1.0 : 0.75
  };
}

// ── UPDATE ALL ZONE STYLES (called after selection changes) ──
function abUpdateMapStyles() {
  if (!abWmuGeoLayer) return;
  // Rebuild the set of WMUs that have real cards (post-buildABCards quota filter)
  if (AB_DATA.length > 0) {
    const allCards = buildABCards().filter(c => c !== null);
    _abWmuWithCards = new Set(allCards.map(c => String(c.wmu)));
  }
  abWmuGeoLayer.eachLayer(layer => {
    const id = String(layer.feature.properties.WMUNIT_NUM || '');
    layer.setStyle(abWmuGetStyle(layer.feature, abSelWMU.has(id)));
  });
  abUpdateMapChips();
  // Keep dropdown in sync
  const dropdown = document.querySelector('#abWMUList select');
  if (dropdown) dropdown.value = abSelWMU.size === 1 ? [...abSelWMU][0] : '';
}

// ── CHIP ROW BELOW MAP ──
function abUpdateMapChips() {
  const chips = document.getElementById('abMapChips');
  if (!chips) return;
  if (abSelWMU.size === 0) {
    chips.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">Click zones to filter · multi-select supported</span>';
    return;
  }
  const sorted = [...abSelWMU].sort((a,b)=>parseInt(a)-parseInt(b));
  chips.innerHTML = sorted.map(w =>
    `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px 3px 10px;background:rgba(74,222,128,.15);border:1px solid rgba(74,222,128,.35);border-radius:12px;font-size:11px;font-weight:700;color:#4ade80;cursor:default">
      WMU&nbsp;${w}
      <span onclick="abToggleWMU('${w}')" style="cursor:pointer;opacity:.65;font-size:14px;line-height:1;margin-left:1px" title="Remove">×</span>
    </span>`
  ).join('');
  // Add clear all if multiple
  if (abSelWMU.size > 1) {
    chips.innerHTML += `<span onclick="abSidebarClearFilter('wmu')" style="font-size:11px;color:var(--text-muted);text-decoration:underline;cursor:pointer;padding:3px 6px">Clear all</span>`;
  }
}

// ── AUTO-OPEN MAP (called on page load — no button press needed) ──
function abAutoOpenMap() {
  const panel = document.getElementById('abMapPanel');
  const btn = document.getElementById('abMapToggleBtn');
  if (!panel) return;
  // Already open — just make sure Leaflet size is valid
  if (abMapOpen) {
    setTimeout(() => abLeafletMapInstance && abLeafletMapInstance.invalidateSize(), 150);
    return;
  }
  abMapOpen = true;
  panel.style.display = 'block';
  if (btn) {
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Close Map`;
    btn.style.background = 'rgba(74,222,128,.18)';
  }
  const container = document.getElementById('abLeafletMap');
  const containerIsStale = container && !container._leaflet_id;
  if (!abMapInitialized || containerIsStale) {
    abMapInitialized = false;
    abLeafletMapInstance = null;
    abWmuGeoLayer = null;
    abInitLeafletMap();
  } else {
    setTimeout(() => abLeafletMapInstance && abLeafletMapInstance.invalidateSize(), 150);
  }
}

// ── TOGGLE MAP PANEL OPEN/CLOSE ──
function abToggleMap() {
  const panel = document.getElementById('abMapPanel');
  const btn = document.getElementById('abMapToggleBtn');
  if (!panel || !btn) return;
  abMapOpen = !abMapOpen;
  panel.style.display = abMapOpen ? 'block' : 'none';
  btn.innerHTML = abMapOpen
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Close Map`
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg> Filter by Map`;
  btn.style.background = abMapOpen ? 'rgba(74,222,128,.18)' : 'rgba(74,222,128,.08)';
  if (abMapOpen) {
    // If the container div was re-rendered by abBuildWMUList(), Leaflet's
    // _leaflet_id marker will be gone — detect this and re-init from scratch.
    const container = document.getElementById('abLeafletMap');
    const containerIsStale = container && !container._leaflet_id;
    if (!abMapInitialized || containerIsStale) {
      abMapInitialized = false;
      abLeafletMapInstance = null;
      abWmuGeoLayer = null;
      abInitLeafletMap();
    } else {
      setTimeout(() => abLeafletMapInstance && abLeafletMapInstance.invalidateSize(), 150);
    }
  }
}

// ── INIT LEAFLET MAP ──
function abInitLeafletMap() {
  if (abMapInitialized) return;
  abMapInitialized = true;

  // Make sure Leaflet CSS is loaded
  if (!document.querySelector('link[href*="leaflet"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(link);
  }

  function initWhenReady() {
    abLeafletMapInstance = L.map('abLeafletMap', {
      center: [54.0, -115.0],
      zoom: 5,
      minZoom: 4,
      maxZoom: 13,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,   // always on
      touchZoom: true,         // pinch zoom always on
      tap: true
    });

    // Hide the scroll hint — no longer needed since zoom is always active
    const hint = document.getElementById('abMapScrollHint');
    if (hint) hint.style.display = 'none';

    // OpenStreetMap tile layer — same as albertahuntmap.ca
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors · © Government of Alberta',
      subdomains: 'abc',
      maxZoom: 19
    }).addTo(abLeafletMapInstance);

    // Add WMU polygons from embedded GeoJSON
    abWmuGeoLayer = L.geoJSON(AB_WMU_GEOJSON, {
      style: feature => abWmuGetStyle(feature, false),
      onEachFeature: (feature, layer) => {
        const id = String(feature.properties.WMUNIT_NUM || '');
        const hasDraws = AB_DATA.length === 0 || (() => {
          const allCards = buildABCards().filter(c => c !== null);
          return allCards.some(c => String(c.wmu) === id);
        })();

        // Hover effects — selected zones keep their green style, only unselected get white glow
        layer.on('mouseover', function(e) {
          const isSelected = abSelWMU.has(id);
          if (!isSelected) {
            this.setStyle({ fillColor: '#ffffff', fillOpacity: 0.45, weight: 1.5, color: '#4ade80' });
          } else {
            // Brighten slightly to acknowledge hover, but keep selected look
            this.setStyle({ fillColor: '#4ade80', fillOpacity: 0.92, weight: 3, color: '#ffffff' });
          }
          // Count how many cards would show for this WMU under current non-WMU filters.
          // We take the already-filtered result set and count cards matching this WMU,
          // OR if this WMU is not currently selected we count from the full filtered-minus-WMU set.
          let wmuCardCount;
          if (abSelWMU.has(id)) {
            // WMU is already in the filter — count cards in the current result that match it
            wmuCardCount = abLastFilteredCards.filter(c => String(c.wmu) === id).length;
          } else {
            // WMU is not selected — simulate adding it: apply all current non-WMU filters to all cards
            const allCards = buildABCards().filter(c => c !== null);
            const thresh = AB_ODDS_STEPS[abMinOdds] || 0;
            wmuCardCount = allCards.filter(c => {
              if (String(c.wmu) !== id) return false;
              if (abSelSpecies.size > 0 && !abSelSpecies.has(c.species)) return false;
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
              if (abProfileFilter === 'has_profile' && isNaN(c.userPts)) return false;
              if (abProfileFilter === 'above_threshold' && c.thresholdStatus !== 'above') return false;
              if (abProfileFilter === 'below_threshold' && c.thresholdStatus !== 'below') return false;
              return true;
            }).length;
          }
          const tipText = wmuCardCount > 0
            ? `<b style="color:#4ade80">WMU ${id}</b><br><span style="font-size:11px;color:#aaa">${wmuCardCount} draw${wmuCardCount !== 1 ? 's' : ''} available</span>`
            : `<b>WMU ${id}</b><br><span style="font-size:11px;color:#888">No draws match current filters</span>`;
          this.bindTooltip(tipText, {
            sticky: true,
            direction: 'top',
            offset: [0, -4],
            opacity: 1,
            className: 'ab-wmu-tip'
          }).openTooltip(e.latlng);
        });

        layer.on('mouseout', function() {
          // Always restore to the correct persistent style (selected = green, unselected = default)
          this.setStyle(abWmuGetStyle(feature, abSelWMU.has(id)));
          this.closeTooltip();
        });

        // Click: toggle zone in filter
        layer.on('click', function() {
          if (!hasDraws) return; // don't select zones with no draws
          abToggleWMU(id);
          // abToggleWMU already calls abUpdateMapStyles + abApplyFilters
        });
      }
    }).addTo(abLeafletMapInstance);

    // Fit map to Alberta bounds
    abLeafletMapInstance.fitBounds([[49.0, -120.0], [60.0, -110.0]]);
    abUpdateMapChips();
  }

  // If Leaflet already loaded, init immediately; otherwise load it first
  if (typeof L !== 'undefined') {
    initWhenReady();
  } else {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    script.onload = initWhenReady;
    document.head.appendChild(script);
  }
}


// ══════════════════════════════════════════════════════════════
// ── BC WMU INTERACTIVE MAP
// ══════════════════════════════════════════════════════════════

function bcWmuFillColor(wmuId) {
  const region = parseInt((wmuId || '').split('-')[0]);
  if (region === 1) return '#4a8f5a';
  if (region === 2) return '#6aab76';
  if (region === 3) return '#9bc46a';
  if (region === 4) return '#c49a35';
  if (region === 5) return '#c06828';
  if (region === 6) return '#7a8fd4';
  if (region === 7) return '#a064c8';
  if (region === 8) return '#5ab8c4';
  if (region === 9) return '#c45a8a';
  return '#666';
}

function bcWmuGetStyle(feature, isSelected) {
  const id = feature.properties.wmu_id || '';
  const hasDraws = DATA.length === 0 || DATA.some(r => r.MU === id);
  return {
    fillColor: isSelected ? '#4ade80' : bcWmuFillColor(id),
    fillOpacity: isSelected ? 0.75 : hasDraws ? 0.38 : 0.15,
    color: isSelected ? '#ffffff' : '#1a1a1a',
    weight: isSelected ? 2.5 : 0.7,
    opacity: isSelected ? 1.0 : 0.75
  };
}

function bcToggleWMUFull(id) {
  if (selMUsFull.has(id)) selMUsFull.delete(id); else selMUsFull.add(id);
  bcUpdateMapStyles();
  applyFilters();
}

function bcUpdateMapStyles() {
  if (!bcWmuGeoLayer) return;
  bcWmuGeoLayer.eachLayer(function(layer) {
    const id = layer.feature.properties.wmu_id || '';
    layer.setStyle(bcWmuGetStyle(layer.feature, selMUsFull.has(id)));
  });
  bcUpdateMapChips();
}

function bcUpdateMapChips() {
  const chips = document.getElementById('bcMapChips');
  if (!chips) return;
  if (selMUsFull.size === 0) {
    chips.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">Click zones to filter · multi-select supported</span>';
    return;
  }
  const sorted = [...selMUsFull].sort();
  chips.innerHTML = sorted.map(id =>
    '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px 3px 10px;background:rgba(74,222,128,.15);border:1px solid rgba(74,222,128,.35);border-radius:12px;font-size:11px;font-weight:700;color:#4ade80;cursor:default">' +
      'WMU\u00a0' + id +
      '<span onclick="bcToggleWMUFull(\'' + id + '\')" style="cursor:pointer;opacity:.65;font-size:14px;line-height:1;margin-left:1px" title="Remove">\u00d7</span>' +
    '</span>'
  ).join('');
  if (selMUsFull.size > 1) {
    chips.innerHTML += '<span onclick="selMUsFull.clear();bcUpdateMapStyles();applyFilters();" style="font-size:11px;color:var(--text-muted);text-decoration:underline;cursor:pointer;padding:3px 6px">Clear all</span>';
  }
}

function bcToggleMap() {
  const panel = document.getElementById('bcMapPanel');
  const btn = document.getElementById('bcMapToggleBtn');
  if (!panel || !btn) return;
  bcMapOpen = !bcMapOpen;
  panel.style.display = bcMapOpen ? 'block' : 'none';
  btn.innerHTML = bcMapOpen
    ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Close Map'
    : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg> Filter by Map';
  btn.style.background = bcMapOpen ? 'rgba(74,222,128,.18)' : 'rgba(74,222,128,.08)';
  if (bcMapOpen) {
    var container = document.getElementById('bcLeafletMap');
    if (!bcMapInitialized || (container && !container._leaflet_id)) {
      bcMapInitialized = false;
      bcLeafletMapInstance = null;
      bcWmuGeoLayer = null;
      bcInitLeafletMap();
    } else {
      setTimeout(function() { bcLeafletMapInstance && bcLeafletMapInstance.invalidateSize(); }, 150);
    }
  }
}

function bcInitLeafletMap() {
  if (bcMapInitialized) return;
  bcMapInitialized = true;

  if (!document.querySelector('link[href*="leaflet"]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(link);
  }

  function doInit() {
    if (bcWmuGeoJSON) {
      bcRenderMap(bcWmuGeoJSON);
    } else {
      var container = document.getElementById('bcLeafletMap');
      if (container) {
        var loader = document.createElement('div');
        loader.id = 'bcMapLoader';
        loader.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:500;background:var(--bg-secondary,#111);border-radius:10px';
        loader.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">Loading BC map\u2026</span>';
        container.appendChild(loader);
      }
      fetch(BC_WMU_GEOJSON_URL)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          bcWmuGeoJSON = data;
          var loader = document.getElementById('bcMapLoader');
          if (loader) loader.remove();
          bcRenderMap(data);
        })
        .catch(function(err) {
          console.error('BC WMU GeoJSON load failed:', err);
          var loader = document.getElementById('bcMapLoader');
          if (loader) loader.innerHTML = '<span style="font-size:12px;color:#f87171">Failed to load map. Check connection.</span>';
        });
    }
  }

  if (typeof L !== 'undefined') {
    doInit();
  } else {
    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    script.onload = doInit;
    document.head.appendChild(script);
  }
}

function bcRenderMap(geojson) {
  var container = document.getElementById('bcLeafletMap');
  if (!container) return;

  bcLeafletMapInstance = L.map('bcLeafletMap', {
    center: [54.0, -124.0],
    zoom: 5,
    minZoom: 4,
    maxZoom: 13,
    zoomControl: true,
    scrollWheelZoom: true,
    touchZoom: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '\u00a9 <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors \u00b7 \u00a9 Government of BC',
    subdomains: 'abc',
    maxZoom: 19
  }).addTo(bcLeafletMapInstance);

  var wmusWithDraws = new Set(DATA.map(function(r) { return r.MU; }));

  bcWmuGeoLayer = L.geoJSON(geojson, {
    style: function(feature) { return bcWmuGetStyle(feature, false); },
    onEachFeature: function(feature, layer) {
      var id = feature.properties.wmu_id || '';
      var hasDraws = wmusWithDraws.has(id);

      layer.on('mouseover', function(e) {
        var isSelected = selMUsFull.has(id);
        if (!isSelected) {
          this.setStyle({ fillColor: '#ffffff', fillOpacity: 0.45, weight: 1.5, color: '#4ade80' });
        } else {
          this.setStyle({ fillColor: '#4ade80', fillOpacity: 0.92, weight: 3, color: '#ffffff' });
        }
        var cardCount = isSelected
          ? filtered.filter(function(r) { return r.MU === id; }).length
          : DATA.filter(function(r) {
              if (r.MU !== id) return false;
              if (selSpecies.size > 0 && !selSpecies.has(r.Species)) return false;
              if ((r['%'] || 0) < selMinOdds) return false;
              return true;
            }).length;
        var tipText = cardCount > 0
          ? '<b style="color:#4ade80">WMU ' + id + '</b><br><span style="font-size:11px;color:#aaa">' + cardCount + ' draw' + (cardCount !== 1 ? 's' : '') + ' available</span>'
          : '<b>WMU ' + id + '</b><br><span style="font-size:11px;color:#888">No draws match filters</span>';
        this.bindTooltip(tipText, { sticky: true, direction: 'top', offset: [0, -4], opacity: 1, className: 'ab-wmu-tip' }).openTooltip(e.latlng);
      });

      layer.on('mouseout', function() {
        this.setStyle(bcWmuGetStyle(feature, selMUsFull.has(id)));
        this.closeTooltip();
      });

      layer.on('click', function() {
        if (!hasDraws) return;
        bcToggleWMUFull(id);
      });
    }
  }).addTo(bcLeafletMapInstance);

  bcLeafletMapInstance.fitBounds([[48.3, -139.0], [60.0, -114.0]]);
  bcUpdateMapChips();
}

// ══════════════════════════════════════════════════════════════
// ── FULL-PAGE MAP TAB (BC / AB toggle)
// ══════════════════════════════════════════════════════════════

let fullMapProvince   = 'BC';    // 'BC' | 'AB'
let fullMapInitialized = { BC: false, AB: false };
let fullMapInstance   = null;
let fullMapGeoLayer   = null;
let fullMapSelRegions = new Set();  // selected WMU IDs
let fullMapSortMode   = 'odds';

// ── Switch province ──
function fullMapSetProvince(prov) {
  if (fullMapProvince === prov) return;
  fullMapProvince = prov;
  fullMapSelRegions.clear();

  // Toggle button states
  document.getElementById('mapToggleBC').classList.toggle('active', prov === 'BC');
  document.getElementById('mapToggleAB').classList.toggle('active', prov === 'AB');

  // Destroy existing Leaflet map so it can reinitialise for the new province
  if (fullMapInstance) {
    fullMapInstance.remove();
    fullMapInstance = null;
    fullMapGeoLayer = null;
    // Clear the leaflet container so it can be reused
    const container = document.getElementById('fullMapLeaflet');
    if (container) { container.innerHTML = ''; delete container._leaflet_id; }
  }
  fullMapInitialized[prov] = false;

  // Hide results
  fullMapHideResults();
  fullMapUpdateChips();

  // Reinit
  fullMapInit();
}

// ── Called by showPage('map') ──
function fullMapInit() {
  if (fullMapInitialized[fullMapProvince]) {
    setTimeout(() => fullMapInstance && fullMapInstance.invalidateSize(), 150);
    return;
  }

  const loading = document.getElementById('fullMapLoading');
  const txt     = document.getElementById('fullMapLoadingText');
  if (loading) loading.style.display = 'flex';
  if (txt) txt.textContent = `Loading ${fullMapProvince === 'BC' ? 'BC' : 'Alberta'} map…`;

  // Ensure Leaflet is loaded
  function doInit() {
    if (fullMapProvince === 'BC') {
      _fullMapInitBC();
    } else {
      _fullMapInitAB();
    }
  }

  if (typeof L !== 'undefined') {
    doInit();
  } else {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    script.onload = doInit;
    document.head.appendChild(script);
  }
}

// ── Build Leaflet map ──
function _fullMapBuildBase(center, zoom, bounds) {
  const container = document.getElementById('fullMapLeaflet');
  if (!container) return null;
  if (container._leaflet_id) { container.innerHTML = ''; delete container._leaflet_id; }

  const map = L.map('fullMapLeaflet', {
    center, zoom, minZoom: 4, maxZoom: 13,
    zoomControl: true, scrollWheelZoom: true, touchZoom: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: 'abc', maxZoom: 19
  }).addTo(map);

  if (bounds) map.fitBounds(bounds);
  return map;
}

// ── BC MAP ──
function _fullMapInitBC() {
  fullMapInitialized['BC'] = true;
  fullMapInstance = _fullMapBuildBase([54.0, -124.0], 5, [[48.3, -139.0],[60.0,-114.0]]);
  if (!fullMapInstance) return;

  function render(geojson) {
    bcWmuGeoJSON = bcWmuGeoJSON || geojson;
    fullMapGeoLayer = L.geoJSON(geojson, {
      style: feature => _fullMapBCStyle(feature, false),
      onEachFeature: (feature, layer) => {
        const id = feature.properties.wmu_id || '';
        const hasDraws = DATA.some(r => r.MU === id);

        layer.on('mouseover', function(e) {
          const sel = fullMapSelRegions.has(id);
          this.setStyle(sel
            ? { fillColor:'#4ade80', fillOpacity:0.92, weight:3, color:'#fff' }
            : { fillColor:'#fff',    fillOpacity:0.4,  weight:1.5, color:'#4ade80' });
          const cnt = DATA.filter(r => r.MU === id).length;
          this.bindTooltip(
            `<b style="color:#4ade80">WMU ${id}</b><br><span style="font-size:11px;color:#aaa">${cnt || 'No'} draw${cnt!==1?'s':''}</span>`,
            { sticky:true, direction:'top', offset:[0,-4], opacity:1, className:'ab-wmu-tip' }
          ).openTooltip(e.latlng);
        });
        layer.on('mouseout', function() {
          this.setStyle(_fullMapBCStyle(feature, fullMapSelRegions.has(id)));
          this.closeTooltip();
        });
        layer.on('click', function() {
          if (!hasDraws) return;
          if (fullMapSelRegions.has(id)) fullMapSelRegions.delete(id);
          else fullMapSelRegions.add(id);
          fullMapRefreshStyles();
          fullMapUpdateChips();
          fullMapShowResults();
        });
      }
    }).addTo(fullMapInstance);

    const loading = document.getElementById('fullMapLoading');
    if (loading) loading.style.display = 'none';
  }

  if (bcWmuGeoJSON) {
    render(bcWmuGeoJSON);
  } else {
    fetch(BC_WMU_GEOJSON_URL)
      .then(r => r.json())
      .then(data => { bcWmuGeoJSON = data; render(data); })
      .catch(() => {
        const l = document.getElementById('fullMapLoading');
        if (l) l.innerHTML = '<span style="color:#f87171;font-size:12px">Failed to load BC map.</span>';
      });
  }
}

function _fullMapBCStyle(feature, isSelected) {
  const id = feature.properties.wmu_id || '';
  const hasDraws = DATA.length === 0 || DATA.some(r => r.MU === id);
  return {
    fillColor:    isSelected ? '#4ade80' : bcWmuFillColor(id),
    fillOpacity:  isSelected ? 0.75 : hasDraws ? 0.38 : 0.15,
    color:        isSelected ? '#ffffff' : '#1a1a1a',
    weight:       isSelected ? 2.5 : 0.7,
    opacity:      isSelected ? 1.0 : 0.75
  };
}

// ── AB MAP ──
function _fullMapInitAB() {
  fullMapInitialized['AB'] = true;

  async function build() {
    // Make sure AB data is loaded before rendering tooltips
    await Promise.all([loadABData(), loadABHarvest()]);

    fullMapInstance = _fullMapBuildBase([54.0, -115.0], 5, [[49.0,-120.0],[60.0,-110.0]]);
    if (!fullMapInstance) return;

    fullMapGeoLayer = L.geoJSON(AB_WMU_GEOJSON, {
      style: feature => _fullMapABStyle(feature, false),
      onEachFeature: (feature, layer) => {
        const id = String(feature.properties.WMUNIT_NUM || '');
        const allCards = buildABCards().filter(c => c !== null);
        const hasDraws = allCards.some(c => String(c.wmu) === id);

        layer.on('mouseover', function(e) {
          const sel = fullMapSelRegions.has(id);
          this.setStyle(sel
            ? { fillColor:'#4ade80', fillOpacity:0.92, weight:3, color:'#fff' }
            : { fillColor:'#fff',    fillOpacity:0.4,  weight:1.5, color:'#4ade80' });
          const cnt = allCards.filter(c => String(c.wmu) === id).length;
          this.bindTooltip(
            `<b style="color:#4ade80">WMU ${id}</b><br><span style="font-size:11px;color:#aaa">${cnt || 'No'} draw${cnt!==1?'s':''}</span>`,
            { sticky:true, direction:'top', offset:[0,-4], opacity:1, className:'ab-wmu-tip' }
          ).openTooltip(e.latlng);
        });
        layer.on('mouseout', function() {
          this.setStyle(_fullMapABStyle(feature, fullMapSelRegions.has(id)));
          this.closeTooltip();
        });
        layer.on('click', function() {
          if (!hasDraws) return;
          if (fullMapSelRegions.has(id)) fullMapSelRegions.delete(id);
          else fullMapSelRegions.add(id);
          fullMapRefreshStyles();
          fullMapUpdateChips();
          fullMapShowResults();
        });
      }
    }).addTo(fullMapInstance);

    const loading = document.getElementById('fullMapLoading');
    if (loading) loading.style.display = 'none';
  }

  build().catch(err => {
    console.error('[fullMap AB]', err);
    const l = document.getElementById('fullMapLoading');
    if (l) l.innerHTML = '<span style="color:#f87171;font-size:12px">Failed to load Alberta map.</span>';
  });
}

function _fullMapABStyle(feature, isSelected) {
  const id = String(feature.properties.WMUNIT_NUM || '');
  // reuse abWmuGetStyle if available, otherwise fallback
  if (typeof abWmuGetStyle === 'function') {
    const hasDraws = AB_DATA.length === 0 || (() => {
      const allCards = buildABCards().filter(c => c !== null);
      return allCards.some(c => String(c.wmu) === id);
    })();
    return {
      fillColor:    isSelected ? '#4ade80' : abWmuFillColor(id),
      fillOpacity:  isSelected ? 0.75 : hasDraws ? 0.38 : 0.15,
      color:        isSelected ? '#ffffff' : '#1a1a1a',
      weight:       isSelected ? 2.5 : 0.7,
      opacity:      isSelected ? 1.0 : 0.75
    };
  }
  return { fillColor: isSelected ? '#4ade80' : '#6aab76', fillOpacity: 0.4, color:'#1a1a1a', weight:0.7 };
}

// ── Refresh all layer styles ──
function fullMapRefreshStyles() {
  if (!fullMapGeoLayer) return;
  fullMapGeoLayer.eachLayer(layer => {
    const props = layer.feature.properties;
    const id = fullMapProvince === 'BC'
      ? (props.wmu_id || '')
      : String(props.WMUNIT_NUM || '');
    const styleFn = fullMapProvince === 'BC' ? _fullMapBCStyle : _fullMapABStyle;
    layer.setStyle(styleFn(layer.feature, fullMapSelRegions.has(id)));
  });
}

// ── Chips row ──
function fullMapUpdateChips() {
  const row = document.getElementById('fullMapChipsRow');
  if (!row) return;
  if (fullMapSelRegions.size === 0) {
    row.innerHTML = '<span style="font-size:11px;color:var(--text-muted)">No regions selected — showing all</span>';
    return;
  }
  const sorted = [...fullMapSelRegions].sort();
  row.innerHTML = sorted.map(id =>
    `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px 3px 10px;background:rgba(74,222,128,.15);border:1px solid rgba(74,222,128,.35);border-radius:12px;font-size:11px;font-weight:700;color:#4ade80;cursor:default">
      WMU&nbsp;${id}
      <span onclick="fullMapRemoveRegion('${id}')" style="cursor:pointer;opacity:.65;font-size:14px;line-height:1;margin-left:1px" title="Remove">×</span>
    </span>`
  ).join('');
  if (fullMapSelRegions.size > 1) {
    row.innerHTML += `<span onclick="fullMapClearAll()" style="font-size:11px;color:var(--text-muted);text-decoration:underline;cursor:pointer;padding:3px 6px">Clear all</span>`;
  }
}

function fullMapRemoveRegion(id) {
  fullMapSelRegions.delete(id);
  fullMapRefreshStyles();
  fullMapUpdateChips();
  if (fullMapSelRegions.size === 0) fullMapHideResults();
  else fullMapShowResults();
}

function fullMapClearAll() {
  fullMapSelRegions.clear();
  fullMapRefreshStyles();
  fullMapUpdateChips();
  fullMapHideResults();
}

// ── Results drawer ──
function fullMapHideResults() {
  const drawer = document.getElementById('fullMapResultsDrawer');
  if (drawer) drawer.style.display = 'none';
}

function fullMapCloseResults() {
  fullMapHideResults();
}

function fullMapShowResults() {
  const drawer = document.getElementById('fullMapResultsDrawer');
  if (!drawer) return;

  const regions = [...fullMapSelRegions];
  let cards;

  if (fullMapProvince === 'BC') {
    // Filter BC draws for selected WMUs
    cards = DATA.filter(r => regions.includes(r.MU)).map(r => ({
      _type: 'BC',
      species: r.Species,
      mu: r.MU,
      code: r.Code,
      odds: r['%'] || 0,
      success: r.FillRate != null ? r.FillRate * 100 : null,
      season: r.Season || '',
      class: r.Class || ''
    }));
  } else {
    // Filter AB draws for selected WMUs
    const allCards = buildABCards().filter(c => c !== null);
    cards = allCards
      .filter(c => regions.includes(String(c.wmu)))
      .map(c => ({
        _type: 'AB',
        species: c.species,
        mu: c.wmu,
        code: c.draw,
        odds: c.personalOdds !== null ? c.personalOdds : c.latestOdds,
        success: c.harvestSuccess,
        season: c.season || '',
        class: c.draw || ''
      }));
  }

  // Sort
  if (fullMapSortMode === 'odds') {
    cards.sort((a,b) => b.odds - a.odds);
  } else if (fullMapSortMode === 'success') {
    cards.sort((a,b) => {
      const as = a.success ?? -1, bs = b.success ?? -1;
      return bs - as;
    });
  } else if (fullMapSortMode === 'season') {
    cards.sort((a,b) => String(a.season).localeCompare(String(b.season)));
  }

  // Render
  const grid = document.getElementById('fullMapResultsGrid');
  const title = document.getElementById('fullMapResultsTitle');
  const count = document.getElementById('fullMapResultsCount');
  const regionLabel = regions.length === 1 ? `WMU ${regions[0]}` : `${regions.length} regions`;
  if (title) title.textContent = `Draws for ${regionLabel}`;
  if (count) count.textContent = `${cards.length.toLocaleString()} draw${cards.length !== 1 ? 's' : ''}`;

  if (grid) {
    if (cards.length === 0) {
      grid.innerHTML = '<div class="fm-no-results">No draws found for the selected region(s) with current filters.</div>';
    } else {
      grid.innerHTML = cards.map(c => {
        const cls = (fullMapProvince === 'BC')
          ? (c.odds >= 5 ? 'green' : c.odds >= 1 ? 'yellow' : 'red')
          : (c.odds >= 20 ? 'green' : c.odds >= 5 ? 'yellow' : 'red');
        const oddsStr = c.odds != null ? ((c.odds >= 10 ? Math.round(c.odds) : c.odds.toFixed(1)) + '%') : '?%';
        const succStr = c.success != null ? ((c.success >= 10 ? Math.round(c.success) : c.success.toFixed(1)) + '%') : null;
        const succCls = c.success != null
          ? (c.success >= (fullMapProvince==='BC'?40:50) ? 'fill-high' : c.success >= (fullMapProvince==='BC'?20:25) ? 'fill-mid' : 'fill-low')
          : 'fill-none';
        return `<div class="fm-card ${cls}">
          <div class="fm-card-top">
            <div>
              <div class="fm-card-species">${c.species}</div>
              <div class="fm-card-meta">WMU ${c.mu}${c.class ? ' · ' + c.class : ''}</div>
            </div>
            <div class="fm-card-odds ${cls}">${oddsStr}</div>
          </div>
          <div class="fm-card-bottom">
            <span class="fm-card-code">${c.code || ''}</span>
            ${succStr
              ? `<span class="fm-card-success ${succCls}">${succStr} success</span>`
              : `<span class="fm-card-success fill-none">No success data</span>`}
            ${c.season && c.season !== '1' ? `<span class="fm-card-code">${c.season}</span>` : ''}
          </div>
        </div>`;
      }).join('');
    }
  }

  drawer.style.display = 'flex';
  drawer.style.flexDirection = 'column';

  // Force Leaflet to recalculate (drawer taking space)
  setTimeout(() => fullMapInstance && fullMapInstance.invalidateSize(), 50);
}

function fullMapSetSort(mode, btn) {
  fullMapSortMode = mode;
  document.querySelectorAll('.fullmap-sort-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (fullMapSelRegions.size > 0) fullMapShowResults();
}

// ── Go to full draws page with map selections applied ──
function fullMapGoToDraws() {
  if (fullMapProvince === 'BC') {
    // Apply the WMU selections to the BC filter
    selMUsFull.clear();
    fullMapSelRegions.forEach(id => selMUsFull.add(id));
    // Also set region filters from WMU regions
    selMUs.clear();
    fullMapSelRegions.forEach(id => {
      const region = parseInt((id || '').split('-')[0]);
      if (!isNaN(region)) selMUs.add(region);
    });
    showPage('draws');
    bcUpdateMapStyles();
  } else {
    // Apply WMU selections to AB filter
    abSelWMU.clear();
    fullMapSelRegions.forEach(id => abSelWMU.add(id));
    showPage('abDraws');
  }
}
