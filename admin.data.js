async function ensureGuardsLoaded(silentMode, forceReload) {
  if (!state.supervisor) return [];
  if (state.guardsLoaded && !forceReload) {
    renderGuardsTable(state.guards || []);
    renderAdminTable();
    renderLiveGuardFilter();
    return state.guards || [];
  }

  try {
    const rows = await callApi("listGuards", {});
    state.guards = Array.isArray(rows) ? rows : [];
    state.guardsLoaded = true;
    renderGuardsTable(state.guards);
    renderAdminTable();
    renderLiveGuardFilter();
    return state.guards;
  } catch (err) {
    state.guards = [];
    state.guardsLoaded = false;
    renderGuardsTable([]);
    renderLiveGuardFilter();
    if (!silentMode) notify(`โหลดข้อมูล Guards ไม่สำเร็จ: ${err.message}`);
    return [];
  }
}

async function ensureCheckpointsLoaded(silentMode, forceReload) {
  if (!state.supervisor) return [];
  if (state.checkpointsLoaded && !forceReload) {
    renderCheckpointsTable(state.checkpoints || []);
    return state.checkpoints || [];
  }

  try {
    const rows = await callApi("listCheckpoints", {});
    state.checkpoints = Array.isArray(rows) ? rows : [];
    state.checkpointsLoaded = true;
    renderCheckpointsTable(state.checkpoints);
    return state.checkpoints;
  } catch (err) {
    state.checkpoints = [];
    state.checkpointsLoaded = false;
    renderCheckpointsTable([]);
    if (!silentMode) notify(`โหลดข้อมูล Checkpoints ไม่สำเร็จ: ${err.message}`);
    return [];
  }
}

async function ensureTemplatesLoaded(silentMode, forceReload) {
  if (!state.supervisor) return [];
  if (state.templatesLoaded && !forceReload) {
    renderTemplatesTable(state.templates || []);
    return state.templates || [];
  }

  try {
    const rows = await callApi("listShiftTemplates", {});
    state.templates = Array.isArray(rows) ? rows : [];
    state.templatesLoaded = true;
    renderTemplatesTable(state.templates);
    return state.templates;
  } catch (err) {
    state.templates = [];
    state.templatesLoaded = false;
    renderTemplatesTable([]);
    if (!silentMode) notify(`โหลดข้อมูล Templates ไม่สำเร็จ: ${err.message}`);
    return [];
  }
}

function renderLiveGuardFilter() {
  if (!el.liveGuardFilter) return;
  const prev = String(el.liveGuardFilter.value || "");
  const options = ['<option value="">All</option>']
    .concat((state.guards || []).map((g) => {
      const id = String(g.guard_id || "");
      const name = String(g.name || "-");
      return `<option value="${escapeAttr(id)}">${escapeHtml(id)} - ${escapeHtml(name)}</option>`;
    }))
    .join("");
  el.liveGuardFilter.innerHTML = options;
  if (prev) el.liveGuardFilter.value = prev;
}

async function loadLiveLogs(forceReload) {
  if (!state.supervisor) return;
  const date = el.liveDate && el.liveDate.value ? el.liveDate.value : toYmd(new Date());
  const guardId = String(el.liveGuardFilter ? el.liveGuardFilter.value : "").trim();
  const status = String(el.liveStatusFilter ? el.liveStatusFilter.value : "").trim();
  const cacheKey = `${state.supervisor?.supervisor_id || ""}|${date}|${guardId}|${status}`;
  if (!forceReload && state.liveLogsCache && Array.isArray(state.liveLogsCache[cacheKey])) {
    state.liveLogs = state.liveLogsCache[cacheKey];
    renderLiveLogs(state.liveLogs);
    return;
  }

  try {
    const rows = await callApi("listCheckLogs", {
      supervisorId: state.supervisor && state.supervisor.supervisor_id ? state.supervisor.supervisor_id : "",
      date,
      guardId,
      status
    });
    state.liveLogs = Array.isArray(rows) ? rows : [];
    if (!state.liveLogsCache) state.liveLogsCache = {};
    state.liveLogsCache[cacheKey] = state.liveLogs;
    renderLiveLogs(state.liveLogs);
  } catch (err) {
    renderLiveLogs([]);
    notify(`โหลดข้อมูล Live Logs ไม่สำเร็จ: ${err.message}`, "error");
  }
}

function renderLiveLogs(rows) {
  if (!el.liveTableBody) return;
  if (!rows || !rows.length) {
    el.liveTableBody.innerHTML = '<tr><td colspan="8">No logs</td></tr>';
    return;
  }
  el.liveTableBody.innerHTML = rows.map((r) => {
    const photoUrl = String(r.photo_url || "").trim();
    const photoCell = photoUrl
      ? `<a class="btn row-btn" href="${escapeAttr(photoUrl)}" target="_blank" rel="noopener">View</a>`
      : "-";
    return `
      <tr>
        <td>${escapeHtml(r.scan_time || "-")}</td>
        <td>${escapeHtml(r.guard_id || "-")}</td>
        <td>${escapeHtml(r.shift_id || "-")}</td>
        <td>${escapeHtml(r.checkpoint_name || r.checkpoint_id || "-")}</td>
        <td>${escapeHtml(r.qr_text_scanned || "-")}</td>
        <td>${escapeHtml(String(r.distance_m ?? "-"))}</td>
        <td>${escapeHtml(r.status || "-")}</td>
        <td>${photoCell}</td>
      </tr>
    `;
  }).join("");
}

async function loadTemplateData() {
  if (!state.supervisor) return;
  const rows = await ensureTemplatesLoaded(true);
  if (rows.length) notify("โหลดข้อมูล Template สำเร็จ");
}
