/**
 * app.js – Admin dashboard controller (v5)
 * Features: bin picker map, emergency alerts, route preview map with OSRM
 */
const AppController = (() => {
  if (typeof Auth !== 'undefined') Auth.requireRole('admin');

  let currentTab = 'dashboard';
  let activeFilter = 'all';
  let mapInitialized = false;
  let pickerMap = null;
  let pickerMarker = null;
  let routePreviewMap = null;
  let routePreviewLayer = null;

  /* ── OSRM helper (reusable) ── */
  async function fetchOSRM(points) {
    if (!points || points.length < 2) return null;
    const coords = points.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
      if (!res.ok) return null;
      const json = await res.json();
      if (json.code === 'Ok' && json.routes?.[0]) {
        return {
          coords: json.routes[0].geometry.coordinates.map(c => [c[1], c[0]]),
          distance: json.routes[0].distance,
          duration: json.routes[0].duration,
        };
      }
    } catch (e) { console.warn('OSRM:', e.message); }
    return null;
  }

  /* ============================================================
     RENDER HELPERS
  ============================================================ */
  function renderDashboard() {
    const bins = BinStore.getAll();
    const filtered = activeFilter === 'all' ? bins : bins.filter(b => b.status === activeFilter);
    const grid = document.getElementById('binGrid');
    grid.innerHTML = '';
    if (!filtered.length) {
      grid.innerHTML = '<p style="color:var(--text-muted);padding:20px 0;grid-column:1/-1">No bins match this filter.</p>';
    } else {
      filtered.forEach(bin => grid.appendChild(UI.createBinCard(bin)));
    }
    UI.updateStats(BinStore.getStats());
  }

  function renderManage() {
    const bins = BinStore.getAll();
    document.getElementById('binTableBody').innerHTML = '';
    bins.forEach(bin => document.getElementById('binTableBody').appendChild(UI.createTableRow(bin)));
    UI.populateBinSelect(bins);
  }

  function renderVisualGrid() {
    const grid = document.getElementById('visualGridView');
    grid.innerHTML = '';
    [...BinStore.getAll()].sort((a, b) => b.fill - a.fill).forEach(b => grid.appendChild(UI.createBinCard(b)));
  }

  function renderVisualCanvas() {
    const canvas = document.getElementById('visualCanvas');
    canvas.innerHTML = '';
    const sorted = [...BinStore.getAll()].sort((a, b) => a.id.localeCompare(b.id));
    sorted.forEach((bin, i) => canvas.appendChild(UI.createBinNode(bin, i, sorted.length)));
  }

  async function renderMap() {
    if (!mapInitialized) { MapView.init('leafletMap'); mapInitialized = true; }
    const bins = BinStore.getAll(), trucks = TruckStore.getAll();
    MapView.renderBins(bins);
    MapView.renderTrucks(trucks);
    renderTruckFleet(trucks);
    MapView.invalidate();
  }

  function renderTruckFleet(trucks) {
    const bar = document.getElementById('truckFleetBar');
    if (!bar) return;
    bar.innerHTML = '';
    trucks.forEach(t => bar.appendChild(UI.createTruckCard(t)));
  }

  /* ── Emergency Alerts (bins > 85%) ── */
  function renderEmergencyAlerts() {
    const bins = BinStore.getAll().filter(b => b.fill > 85);
    const countEl = document.getElementById('emergencyCount');
    const listEl = document.getElementById('emergencyList');
    const badge = document.getElementById('reportsBadge');
    if (!countEl || !listEl) return;

    countEl.textContent = bins.length;
    // Update nav badge
    if (badge) {
      if (bins.length > 0) { badge.style.display = 'inline'; badge.textContent = bins.length; }
      else badge.style.display = 'none';
    }

    if (!bins.length) {
      listEl.innerHTML = '<div style="color:#16a34a;font-size:12px;font-weight:600;padding:8px 0">✅ No emergency bins — all below 85%</div>';
      return;
    }
    listEl.innerHTML = bins.sort((a, b) => b.fill - a.fill).map(b => {
      return `<div style="background:#fff;border:1px solid #fecaca;border-left:4px solid #ef4444;border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:12px">
        <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px">${b.fill.toFixed(0)}%</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:13px;color:#1a1a2e">${b.id} — ${b.location}</div>
          <div style="font-size:11px;color:#6b7280">${b.zone} · ${b.capacity}L capacity</div>
        </div>
        <span style="font-size:11px;background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:8px;font-weight:700">CRITICAL</span>
      </div>`;
    }).join('');
  }

  /* ── Citizen Reports ── */
  function renderReports() {
    const reports = ReportStore.getAll();
    const el = document.getElementById('reportsContainer');
    if (!el) return;
    if (!reports.length) {
      el.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:40px;font-size:13px">No citizen reports yet.</div>';
      return;
    }
    el.innerHTML = reports.map(r => {
      const sc = r.urgent ? '#ef4444' : r.status === 'resolved' ? '#22c55e' : '#f59e0b';
      const time = new Date(r.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      return `<div style="background:var(--surface);border:1px solid var(--border);border-left:4px solid ${sc};border-radius:10px;padding:16px;display:flex;align-items:center;gap:14px">
        <div style="flex:1">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">
            <b style="font-size:13px">${r.binId}</b>
            <span style="font-size:11px;background:${r.urgent ? '#fee2e2' : '#fef3c7'};color:${r.urgent ? '#991b1b' : '#92400e'};padding:1px 7px;border-radius:10px;font-weight:700">${r.urgent ? 'URGENT' : r.type}</span>
            <span style="font-size:11px;color:var(--text-muted)">${r.status}</span>
          </div>
          <div style="font-size:12px;color:var(--text-secondary)">${r.binLocation}</div>
          <div style="font-size:12px;color:var(--text-muted)">${r.description || '(no description)'}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">By ${r.reporterName} · ${time}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${r.status !== 'resolved' ? `<button class="btn btn-outline" style="font-size:11px;padding:4px 10px" onclick="window.resolveReport('${r.id}')">✓ Resolve</button>` : ''}
          ${r.status === 'open' ? `<button class="btn btn-outline" style="font-size:11px;padding:4px 10px" onclick="window.ackReport('${r.id}')">Acknowledge</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  function updateLastUpdated() {
    const el = document.getElementById('lastUpdated');
    if (el) el.textContent = 'Updated at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function renderAll() {
    renderDashboard();
    renderManage();
    renderVisualGrid();
    renderVisualCanvas();
    updateLastUpdated();
  }

  /* ============================================================
     BIN PICKER MAP (Manage Tab)
  ============================================================ */
  function initBinPickerMap() {
    if (pickerMap) return;
    const el = document.getElementById('binPickerMap');
    if (!el) return;
    pickerMap = L.map(el).setView([28.6139, 77.2090], 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19,
    }).addTo(pickerMap);

    // Show existing bins
    BinStore.getAll().forEach(b => {
      const c = b.fill <= 40 ? '#22c55e' : b.fill <= 75 ? '#f59e0b' : '#ef4444';
      L.circleMarker([b.lat, b.lng], { radius: 6, fillColor: c, color: '#fff', weight: 1, fillOpacity: 0.7 })
        .addTo(pickerMap).bindPopup(`${b.id}`);
    });

    pickerMap.on('click', (e) => {
      const { lat, lng } = e.latlng;
      document.getElementById('binLat').value = lat.toFixed(6);
      document.getElementById('binLng').value = lng.toFixed(6);
      document.getElementById('binCoordsLabel').textContent = `✓ ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      document.getElementById('binCoordsLabel').style.color = '#16a34a';

      if (pickerMarker) pickerMap.removeLayer(pickerMarker);
      pickerMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: '<div style="width:28px;height:28px;border-radius:50%;background:#3b82f6;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.25)">📌</div>',
          iconSize: [28, 28], iconAnchor: [14, 14],
        }),
      }).addTo(pickerMap);
    });

    setTimeout(() => pickerMap.invalidateSize(), 300);
  }

  /* ============================================================
     ROUTE PREVIEW MAP (Route Tab)
  ============================================================ */
  function initRoutePreviewMap() {
    if (routePreviewMap) return;
    const el = document.getElementById('routePreviewMap');
    if (!el) return;
    routePreviewMap = L.map(el).setView([28.6139, 77.2090], 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19,
    }).addTo(routePreviewMap);
    routePreviewLayer = L.layerGroup().addTo(routePreviewMap);
    setTimeout(() => routePreviewMap.invalidateSize(), 300);
  }

  async function renderRouteOnPreviewMap(route, truckLat, truckLng) {
    if (!routePreviewMap || !routePreviewLayer) return;
    routePreviewLayer.clearLayers();

    if (!route.length) return;

    // Truck marker
    L.marker([truckLat, truckLng], {
      icon: L.divIcon({
        className: '', iconSize: [32, 32], iconAnchor: [16, 16],
        html: '<div style="width:32px;height:32px;border-radius:50%;background:#3b82f6;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 8px rgba(0,0,0,.25)">🚛</div>',
      }),
    }).addTo(routePreviewLayer).bindPopup('Truck start');

    // Bin markers with numbers
    route.forEach((bin, i) => {
      const c = bin.fill <= 40 ? '#22c55e' : bin.fill <= 75 ? '#f59e0b' : '#ef4444';
      L.circleMarker([bin.lat, bin.lng], {
        radius: 9 + (bin.fill / 100) * 7, fillColor: c, color: '#fff', weight: 2, fillOpacity: 0.85,
      }).addTo(routePreviewLayer)
        .bindPopup(`<b>${i + 1}. ${bin.id}</b><br>${bin.location}<br><b style="color:${c}">${bin.fill.toFixed(0)}%</b>`);
      L.marker([bin.lat, bin.lng], {
        icon: L.divIcon({
          className: '', iconSize: [18, 18], iconAnchor: [9, 9],
          html: `<div style="background:${c};color:#fff;font-size:10px;font-weight:800;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff">${i + 1}</div>`,
        }),
      }).addTo(routePreviewLayer);
    });

    // Fetch OSRM real road route
    const waypoints = [
      { lat: truckLat, lng: truckLng },
      ...route.slice(0, 9).map(b => ({ lat: b.lat, lng: b.lng })),
    ];
    const infoEl = document.getElementById('routeMapInfo');
    if (infoEl) { infoEl.style.display = 'block'; infoEl.textContent = '⏳ Fetching road route…'; }

    const result = await fetchOSRM(waypoints);
    if (result && result.coords.length > 1) {
      L.polyline(result.coords, { color: '#3b82f6', weight: 5, opacity: 0.8 }).addTo(routePreviewLayer);
      const km = (result.distance / 1000).toFixed(1);
      const min = Math.round(result.duration / 60);
      if (infoEl) infoEl.textContent = `📡 ${km} km · ~${min} min via roads`;
    } else {
      // Fallback straight lines
      const pts = waypoints.map(p => [p.lat, p.lng]);
      L.polyline(pts, { color: '#3b82f6', weight: 3, dashArray: '8 6', opacity: 0.6 }).addTo(routePreviewLayer);
      if (infoEl) infoEl.textContent = '⚠️ Showing straight-line fallback';
    }

    // Fit bounds
    const allPts = [[truckLat, truckLng], ...route.map(b => [b.lat, b.lng])];
    routePreviewMap.fitBounds(allPts, { padding: [30, 30] });
  }

  /* ============================================================
     NAVIGATION
  ============================================================ */
  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');
    const titles = {
      dashboard: ['Dashboard', 'Waste bin monitoring across Delhi NCR'],
      map: ['Live Map', 'Truck fleet · real road routes · bin markers'],
      manage: ['Manage Bins', 'Add bins by clicking map · update or remove'],
      route: ['Route Optimizer', 'Priority-based routing with real road paths'],
      visual: ['Visualization', 'Anti-gravity fill level display'],
      reports: ['Citizen Reports', 'Emergency alerts and citizen-submitted reports'],
      users: ['User Management', 'Approve drivers · view registered users'],
    };
    document.getElementById('pageTitle').textContent = titles[tab]?.[0] || tab;
    document.getElementById('pageSubtitle').textContent = titles[tab]?.[1] || '';
    if (tab === 'dashboard') renderDashboard();
    if (tab === 'map') renderMap();
    if (tab === 'manage') { renderManage(); initBinPickerMap(); setTimeout(() => pickerMap?.invalidateSize(), 200); }
    if (tab === 'visual') { renderVisualGrid(); renderVisualCanvas(); }
    if (tab === 'route') { initRoutePreviewMap(); setTimeout(() => routePreviewMap?.invalidateSize(), 200); }
    if (tab === 'reports') { ReportStore.refresh().then(() => { renderReports(); renderEmergencyAlerts(); }); }
    if (tab === 'users') { renderUsersTab(); }
  }

  /* ============================================================
     ASSIGN ROUTES + DRAW REAL ROADS (Live Map)
  ============================================================ */
  async function handleAssignRoutes() {
    const btn = document.getElementById('assignRoutesBtn');
    const loading = document.getElementById('routeLoadingMsg');
    btn.disabled = true;
    btn.textContent = '⏳ Assigning…';
    if (loading) loading.style.display = 'inline';
    try {
      const threshold = parseInt(document.getElementById('mapThreshold').value, 10) || 30;
      await TruckStore.assignRoutes(BinStore.getAll(), threshold);
      const bins = BinStore.getAll(), trucks = TruckStore.getAll();
      MapView.renderBins(bins);
      MapView.renderTrucks(trucks);
      renderTruckFleet(trucks);
      if (loading) loading.textContent = '⏳ Fetching road routes from OSRM…';
      await MapView.renderRoutes(trucks, bins);
      UI.showToast('Routes assigned — real road paths loaded!', 'success');
    } catch (e) {
      UI.showToast('Route error: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '⟳ Assign Routes & Show Roads';
      if (loading) loading.style.display = 'none';
    }
  }

  /* ============================================================
     FORM HANDLERS
  ============================================================ */
  async function handleAddBin(e) {
    e.preventDefault();
    const id = document.getElementById('binId').value.trim().toUpperCase();
    const location = document.getElementById('binLocation').value.trim();
    const zone = document.getElementById('binZone').value;
    const fill = parseInt(document.getElementById('binFill').value, 10);
    const capacity = parseInt(document.getElementById('binCapacity').value, 10);
    const lat = parseFloat(document.getElementById('binLat').value);
    const lng = parseFloat(document.getElementById('binLng').value);

    if (!id || !location) { UI.showToast('ID and Location required.', 'error'); return; }
    if (isNaN(lat) || isNaN(lng)) { UI.showToast('Click the map to set bin coordinates first!', 'error'); return; }

    try {
      await BinStore.add({ id, location, zone, fill, capacity, lat, lng });
      UI.showToast(`${id} added at ${lat.toFixed(4)}, ${lng.toFixed(4)}!`, 'success');
      document.getElementById('addBinForm').reset();
      document.getElementById('fillLabelAdd').textContent = '0%';
      document.getElementById('binCoordsLabel').textContent = '← Click map to set';
      document.getElementById('binCoordsLabel').style.color = 'var(--accent)';
      if (pickerMarker) { pickerMap.removeLayer(pickerMarker); pickerMarker = null; }
      renderAll();
      if (mapInitialized) MapView.renderBins(BinStore.getAll());
    } catch (err) { UI.showToast(err.message, 'error'); }
  }

  async function handleUpdateFill(e) {
    e.preventDefault();
    const id = document.getElementById('updateBinSelect').value;
    const fill = parseInt(document.getElementById('updateFill').value, 10);
    if (!id) { UI.showToast('Select a bin first.', 'error'); return; }
    try {
      await BinStore.updateFill(id, fill);
      UI.showToast(`${id} updated to ${fill}%`, 'success');
      renderAll();
      if (mapInitialized) MapView.renderBins(BinStore.getAll());
    } catch (err) { UI.showToast(err.message, 'error'); }
  }

  async function removeBin(id) {
    if (!confirm(`Remove ${id}?`)) return;
    try {
      await BinStore.remove(id);
      UI.showToast(`${id} removed.`, 'info');
      renderAll();
      if (mapInitialized) MapView.renderBins(BinStore.getAll());
    } catch (err) { UI.showToast(err.message, 'error'); }
  }

  /* ============================================================
     ROUTE TAB — Generate + show on preview map
  ============================================================ */
  async function handleGenerateRoute() {
    const threshold = parseInt(document.getElementById('thresholdSlider').value, 10);
    const zone = document.getElementById('zoneFilter').value;
    const trucks = TruckStore.getAll();
    const ref = trucks[0];
    const route = RouteOptimizer.generate(BinStore.getAll(), ref.lat, ref.lng, threshold, zone);
    const summary = RouteOptimizer.summarize(route);
    const listEl = document.getElementById('routeList');
    const descEl = document.getElementById('routeDesc');
    listEl.innerHTML = '';
    if (!route.length) {
      descEl.textContent = `No bins above ${threshold}% threshold.`;
      listEl.innerHTML = '<div class="route-empty"><p>Lower the threshold to find bins.</p></div>';
      return;
    }
    descEl.textContent = `${summary.count} stop${summary.count > 1 ? 's' : ''} · Avg ${summary.avgFill}% · ${summary.zones.join(', ')}`;
    route.forEach((bin, i) => listEl.appendChild(UI.createRouteStep(bin, i)));
    UI.showToast(`Route: ${summary.count} stops — loading road map…`, 'success');

    // Render on preview map
    initRoutePreviewMap();
    setTimeout(() => routePreviewMap?.invalidateSize(), 200);
    await renderRouteOnPreviewMap(route, ref.lat, ref.lng);
  }

  function handleViewToggle(view) {
    document.getElementById('toggleGrid').classList.toggle('active', view === 'grid');
    document.getElementById('toggleMap').classList.toggle('active', view === 'map');
    document.getElementById('visualGridView').classList.toggle('hidden', view !== 'grid');
    document.getElementById('visualMapView').classList.toggle('hidden', view !== 'map');
    if (view === 'map') renderVisualCanvas();
  }

  /* ============================================================
     INIT
  ============================================================ */
  /* ============================================================
     USERS TAB — pending approvals + registered users
  ============================================================ */
  async function renderUsersTab() {
    await Promise.all([renderPendingDrivers(), renderAllUsers()]);
  }

  async function renderPendingDrivers() {
    try {
      const pending = await Api.Auth.getPending();
      const countEl = document.getElementById('pendingCount');
      const listEl = document.getElementById('pendingList');
      const badge = document.getElementById('pendingBadge');

      countEl.textContent = pending.length;
      if (badge) {
        if (pending.length > 0) { badge.style.display = 'inline'; badge.textContent = pending.length; }
        else badge.style.display = 'none';
      }

      if (!pending.length) {
        listEl.innerHTML = '<div style="color:#16a34a;font-size:12px;font-weight:600;padding:8px 0">✅ No pending requests</div>';
        return;
      }

      listEl.innerHTML = pending.map(u => {
        return `<div style="background:#fff;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:14px">
          <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700">🚛</div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:13px;color:#1a2035">${u.name}</div>
            <div style="font-size:11px;color:#6b7a99">@${u.username} · Truck: ${u.truckId || 'None'}</div>
          </div>
          <button onclick="window.approveUser('${u.username}')" style="padding:6px 14px;border-radius:6px;font-size:11px;font-weight:700;background:#dcfce7;color:#15803d;border:1px solid #86efac;cursor:pointer;font-family:inherit">✓ Approve</button>
          <button onclick="window.rejectUser('${u.username}')" style="padding:6px 14px;border-radius:6px;font-size:11px;font-weight:700;background:#fee2e2;color:#991b1b;border:1px solid #fecaca;cursor:pointer;font-family:inherit">✗ Reject</button>
        </div>`;
      }).join('');
    } catch(e) {
      console.error('Failed to load pending users:', e);
    }
  }

  async function renderAllUsers() {
    try {
      const users = await Api.Auth.getUsers();
      const tbody = document.getElementById('usersTableBody');
      tbody.innerHTML = users.map(u => {
        const roleColors = { admin: '#3b6ef6', driver: '#0d9488', citizen: '#f59e0b' };
        const statusColors = { active: '#22c55e', pending: '#f59e0b' };
        return `<tr>
          <td style="font-weight:600">@${u.username}</td>
          <td>${u.name}</td>
          <td><span style="background:${roleColors[u.role]}20;color:${roleColors[u.role]};padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700">${u.role}</span></td>
          <td>${u.truckId || '—'}</td>
          <td><span style="background:${statusColors[u.status]}20;color:${statusColors[u.status]};padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700">${u.status}</span></td>
        </tr>`;
      }).join('');
    } catch(e) {
      console.error('Failed to load users:', e);
    }
  }

  /* ============================================================
     INIT
  ============================================================ */
  async function init() {
    document.getElementById('binGrid').innerHTML = '<p style="color:var(--text-muted);padding:20px;grid-column:1/-1">⏳ Loading from database…</p>';
    await Promise.all([BinStore.init(), TruckStore.init(), ReportStore.init()]);

    // Globals
    window.AppController = { removeBin };
    window.renderReports = () => { renderReports(); renderEmergencyAlerts(); };
    window.resolveReport = async id => { await ReportStore.updateStatus(id, 'resolved'); renderReports(); UI.showToast('Resolved.', 'success'); };
    window.ackReport = async id => { await ReportStore.updateStatus(id, 'acknowledged'); renderReports(); UI.showToast('Acknowledged.', 'info'); };
    window.approveUser = async (username) => {
      if (!confirm(`Approve driver "${username}"?`)) return;
      try {
        await Api.Auth.approve(username);
        UI.showToast(`✅ ${username} approved!`, 'success');
        renderUsersTab();
      } catch(e) { UI.showToast('Error: ' + e.message, 'error'); }
    };
    window.rejectUser = async (username) => {
      if (!confirm(`Reject and delete "${username}"?`)) return;
      try {
        await Api.Auth.reject(username);
        UI.showToast(`${username} rejected.`, 'info');
        renderUsersTab();
      } catch(e) { UI.showToast('Error: ' + e.message, 'error'); }
    };
    window.refreshUsers = () => renderUsersTab();

    // Nav
    document.querySelectorAll('.nav-item').forEach(item =>
      item.addEventListener('click', e => { e.preventDefault(); switchTab(item.dataset.tab); })
    );
    // Filters
    document.querySelectorAll('.filter-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); activeFilter = btn.dataset.filter; renderDashboard();
      })
    );
    // Forms
    document.getElementById('addBinForm').addEventListener('submit', handleAddBin);
    document.getElementById('updateBinForm').addEventListener('submit', handleUpdateFill);
    // Sliders
    document.getElementById('binFill').addEventListener('input', function () { document.getElementById('fillLabelAdd').textContent = this.value + '%'; });
    document.getElementById('updateFill').addEventListener('input', function () { document.getElementById('fillLabelUpdate').textContent = this.value + '%'; });
    document.getElementById('thresholdSlider').addEventListener('input', function () { document.getElementById('thresholdLabel').textContent = this.value + '%'; });
    document.getElementById('mapThreshold').addEventListener('input', function () { document.getElementById('mapThresholdLabel').textContent = this.value + '%'; });
    // Buttons
    document.getElementById('generateRouteBtn').addEventListener('click', handleGenerateRoute);
    document.getElementById('refreshBtn').addEventListener('click', async () => {
      await Promise.all([BinStore.init(), TruckStore.init()]);
      renderAll(); UI.showToast('Refreshed from database.', 'info');
    });
    document.getElementById('assignRoutesBtn').addEventListener('click', handleAssignRoutes);
    const crBtn = document.getElementById('clearReportsBtn');
    if (crBtn) crBtn.addEventListener('click', async () => { await ReportStore.refresh(); renderReports(); renderEmergencyAlerts(); });
    // View toggle
    document.getElementById('toggleGrid').addEventListener('click', () => handleViewToggle('grid'));
    document.getElementById('toggleMap').addEventListener('click', () => handleViewToggle('map'));

    renderAll();
    renderEmergencyAlerts();
    // Check for pending users on load
    renderPendingDrivers();
  }

  document.addEventListener('DOMContentLoaded', () => init().catch(e => {
    console.error('Init failed:', e);
    document.getElementById('binGrid').innerHTML = `<div style="color:#ef4444;padding:20px;grid-column:1/-1">
      ❌ Cannot connect to database.<br><small>Run: <code>node server.js</code> then open <code>http://localhost:3000</code></small></div>`;
  }));
})();
