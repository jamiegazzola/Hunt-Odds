  const COLORS = ['#4a7fd4', '#4caf82', '#e6a817', '#e05c5c'];
  const n = draws.length;

  // ── Helper: build sparkline SVG for a single draw (odds history) ──
  function buildOddsSparkline(r, color) {
    const entries = Object.entries(r.yearly_draw_odds || {})
      .sort((a,b) => +a[0] - +b[0])
      .slice(-10)
      .filter(e => isFinite(parseFloat(e[1])) && parseFloat(e[1]) > 0);
    if (entries.length < 2) return '<div style="font-size:11px;color:var(--text-muted);padding:16px 0;text-align:center">No historical data</div>';

    const W = 220, H = 64, PL = 4, PR = 4, PT = 6, PB = 18;
    const vals = entries.map(e => parseFloat(e[1]));
    const maxV = Math.max(...vals, 0.1);
    const minYr = +entries[0][0], maxYr = +entries[entries.length-1][0];
    const yrSpan = maxYr - minYr || 1;
    const pw = W - PL - PR, ph = H - PT - PB;
    const pts = entries.map(([yr,v]) => ({
      x: PL + ((+yr - minYr)/yrSpan)*pw,
      y: PT + ph - (parseFloat(v)/maxV)*ph,
      yr, v: parseFloat(v)
    }));
    const line = 'M' + pts.map(p => p.x.toFixed(1)+','+p.y.toFixed(1)).join(' L');
    const fill = `M${PL},${PT+ph} L` + pts.map(p => p.x.toFixed(1)+','+p.y.toFixed(1)).join(' L') + ` L${pts[pts.length-1].x.toFixed(1)},${PT+ph} Z`;
    const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
    const avgY = (PT + ph - (avg/maxV)*ph).toFixed(1);
    const labels = [entries[0], entries[Math.floor(entries.length/2)], entries[entries.length-1]];
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block">
      <defs><linearGradient id="sg${r.Code||Math.random().toString(36).slice(2)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.35"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      <path d="${fill}" fill="url(#sg${r.Code||'x'})" />
      <line x1="${PL}" y1="${avgY}" x2="${W-PR}" y2="${avgY}" stroke="${color}" stroke-opacity="0.3" stroke-width="1" stroke-dasharray="3,3"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${pts.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="${color}"/>`).join('')}
      ${labels.map(([yr])=>{const p=pts.find(x=>x.yr===yr);return p?`<text x="${p.x.toFixed(1)}" y="${H-4}" text-anchor="middle" font-size="8" fill="var(--text-muted)">${yr}</text>`:''}).join('')}
    </svg>`;
  }

  // ── Helper: build success rate bar chart ──
  function buildSuccessChart(r, color) {
    const entries = Object.entries(r.yearly_fill_rates || {})
      .sort((a,b) => +a[0] - +b[0]).slice(-8)
      .filter(e => parseFloat(e[1]) >= 0);
    if (entries.length < 2) return '<div style="font-size:11px;color:var(--text-muted);padding:16px 0;text-align:center">No historical data</div>';
    const W = 220, H = 64, PB = 18, PT = 6;
    const barW = Math.min(22, (W - 8) / entries.length - 3);
    const totalW = entries.length * (barW + 3) - 3;
    const startX = (W - totalW) / 2;
    const bars = entries.map(([yr, val], i) => {
      const v = Math.min(parseFloat(val), 1);
      const bh = Math.max(2, Math.round(v * (H - PT - PB)));
      const x = startX + i * (barW + 3);
      const y = PT + (H - PT - PB) - bh;
      const pct = Math.round(v * 100);
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW}" height="${bh}" rx="2" fill="${color}" fill-opacity="${0.4 + v*0.5}" title="${yr}: ${pct}%"/>
        <text x="${(x + barW/2).toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="8" fill="var(--text-muted)">${yr.slice(-2)}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block">${bars}</svg>`;
  }

  // ── Stat bar (horizontal, proportional) ──
  function statBar(val, maxVal, color) {
    const pct = maxVal > 0 ? Math.min(100, (val/maxVal)*100) : 0;
    return `<div style="height:5px;background:rgba(255,255,255,0.07);border-radius:3px;margin-top:5px;overflow:hidden">
      <div style="height:100%;width:${pct.toFixed(1)}%;background:${color};border-radius:3px;transition:width 0.6s ease"></div>
    </div>`;
  }

  // ── Precompute max values across all draws for relative bars ──
  const maxOdds = Math.max(...draws.map(d => d['%'] || 0), 0.01);
  const maxFill = Math.max(...draws.map(d => d.fill_rate_3yr || 0), 0.01);
  const maxTags = Math.max(...draws.map(d => parseInt(d.Tags) || 0), 1);
  const maxDriveKm = Math.max(...draws.map(d => {
    const m = (d.Drive||'').match(/(\d[\d,]*)\s*km/);
    return m ? parseInt(m[1].replace(',','')) : 0;
  }), 1);

  function getDriveKm(d) {
    const m = (d.Drive||'').match(/(\d[\d,]*)\s*km/);
    return m ? parseInt(m[1].replace(',','')) : 0;
  }

  // ── Build each column ──
  const cols = draws.map((r, i) => {
    const color = COLORS[i % COLORS.length];
    const oddsVal = r['%'] || 0;
    const fillVal = r.fill_rate_3yr;
    const fillAllTime = r.fill_rate_alltime;
    const driveKm = getDriveKm(r);
    const driveHrs = (r.Drive||'').match(/\(([^)]+)\)/)?.[1] || '';
    const tags = parseInt(r.Tags) || 0;
    const oddsColor = oddsVal >= 5 ? '#4caf82' : oddsVal >= 1 ? '#e6a817' : '#e05c5c';
    const fillColor = fillVal >= 0.7 ? '#4caf82' : fillVal >= 0.4 ? '#e6a817' : fillVal != null ? '#e05c5c' : 'var(--text-muted)';

    return `<div class="cmp-col" style="--col-color:${color}">
      <!-- Header -->
      <div class="cmp-col-header" style="border-top:3px solid ${color}">
        <div class="cmp-species">${r.Species}</div>
        <div class="cmp-class">${r.Class}${r.Zone ? ' · Zone ' + r.Zone : ''}</div>
        <div class="cmp-area">${r.Area} · MU ${r.MU}</div>
        <div class="cmp-region" style="color:${color}">${r.MU_General} — ${r.MU_Name}</div>
      </div>

      <!-- Key Stats -->
      <div class="cmp-section">
        <div class="cmp-section-label">KEY STATS</div>
        <div class="cmp-stat">
          <div class="cmp-stat-label">Draw Odds</div>
          <div class="cmp-stat-val" style="color:${oddsColor}">${fmt(oddsVal)}</div>
          <div class="cmp-stat-sub">${r.Odds || '—'}</div>
          ${statBar(oddsVal, maxOdds, oddsColor)}
        </div>
        <div class="cmp-stat">
          <div class="cmp-stat-label">3-Yr Success Rate</div>
          <div class="cmp-stat-val" style="color:${fillColor}">${fillVal != null ? fmtFill(fillVal) : '—'}</div>
          ${fillVal != null ? statBar(fillVal, maxFill, fillColor) : ''}
        </div>
        ${fillAllTime != null ? `<div class="cmp-stat">
          <div class="cmp-stat-label">All-Time Success Rate</div>
          <div class="cmp-stat-val">${fmtFill(fillAllTime)}</div>
          <div class="cmp-stat-sub">${r.fill_rate_years || '?'} yrs data</div>
        </div>` : ''}
        <div class="cmp-stat">
          <div class="cmp-stat-label">Tags Available</div>
          <div class="cmp-stat-val">${tags || '—'}</div>
          ${statBar(tags, maxTags, color)}
        </div>
      </div>

      <!-- Hunt Details -->
      <div class="cmp-section">
        <div class="cmp-section-label">HUNT DETAILS</div>
        <div class="cmp-detail-row"><span class="cmp-dl">Season</span><span class="cmp-dv">${r.Season || '—'}</span></div>
        <div class="cmp-detail-row"><span class="cmp-dl">Draw Code</span><span class="cmp-dv">${r.Code || '—'}</span></div>
        <div class="cmp-detail-row"><span class="cmp-dl">Drive</span><span class="cmp-dv">${driveKm > 0 ? driveKm.toLocaleString() + ' km' : '—'}${driveHrs ? ' ('+driveHrs+')' : ''}</span></div>
        ${statBar(maxDriveKm > 0 ? maxDriveKm - driveKm + driveKm : 0, maxDriveKm, color)}
      </div>

      <!-- Draw Odds History Chart -->
      <div class="cmp-section">
        <div class="cmp-section-label">DRAW ODDS HISTORY</div>
        ${buildOddsSparkline(r, color)}
      </div>

      <!-- Success Rate History Chart -->
      <div class="cmp-section">
        <div class="cmp-section-label">SUCCESS RATE HISTORY</div>
        ${buildSuccessChart(r, color)}
      </div>
    </div>`;
  }).join('');

  // ── Legend dots ──
  const legend = draws.map((r,i) => `
    <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-dim)">
      <div style="width:10px;height:10px;border-radius:50%;background:${COLORS[i%COLORS.length]};flex-shrink:0"></div>
      ${r.Species} · ${r.Area} MU ${r.MU}
    </div>`).join('');

  // ── Inject modal ──
  const modal = document.createElement('div');
  modal.id = 'compareModal';
  modal.innerHTML = `
    <div class="cmp-backdrop" onclick="closeCompareModal()"></div>
    <div class="cmp-modal">
      <div class="cmp-modal-header">
        <div>
          <div class="cmp-modal-title">Draw Comparison</div>
          <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:6px">${legend}</div>
        </div>
        <button class="cmp-close-btn" onclick="closeCompareModal()">✕ Close</button>
      </div>
      <div class="cmp-cols" style="--n-cols:${n}">${cols}</div>
    </div>`;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => modal.classList.add('cmp-visible'));
}

function closeCompareModal() {
  const modal = document.getElementById('compareModal');
  if (modal) {
    modal.classList.remove('cmp-visible');
    setTimeout(() => { modal.remove(); document.body.style.overflow = ''; }, 300);
  }
}

function renderSavedPage() {
  const grid = document.getElementById('savedCardsGrid');
  // Detach savedEmpty before wiping innerHTML so it stays in memory
  let empty = document.getElementById('savedEmpty');
  if (!empty) {
    empty = document.createElement('div');
    empty.id = 'savedEmpty';
    empty.className = 'saved-empty';
    empty.innerHTML = '<div class="saved-empty-icon">☆</div><div class="saved-empty-title">No saved draws yet</div><p class="saved-empty-sub">Tap the star on any draw card to save it here for easy comparison.</p><button class="hero-cta" onclick="showPage(\'filter\')" style="margin-top:16px;width:auto;padding:11px 24px;font-size:13px">Browse Draws</button>';
  }
  if (empty.parentNode) empty.parentNode.removeChild(empty);

  const compareBtn = document.getElementById('compareBtn');
  const subtitle = document.getElementById('savedSubtitle');
