const API_URL = "https://script.google.com/macros/s/AKfycbz5oaXP-o7CDvjVnZeoEUDHwB1vya6f1mmEUNGmiJadlpmyqaQnyS0RX6CHopQ4M3Q/exec";
const STORAGE_KEY = "guardtour.supervisor.session";
const DEFAULT_MAP_CENTER = { lat: 13.782472, lng: 100.971472 };
const DEFAULT_GOOGLE_MAPS_URL = "https://www.google.com/maps?q=13.782472,100.971472";

const state = {
  supervisor: null,
  guards: [],
  checkpoints: [],
  templates: [],
  liveLogs: [],
  shiftCheckpoints: {},
  charts: {},
  userTab: "admin"
};

const el = {};
let loadingCount = 0;

window.addEventListener("DOMContentLoaded", async () => {
  bindElements();
  bindEvents();

  startTopClock();
  el.reportDate.value = toYmd(new Date());
  el.liveDate.value = toYmd(new Date());
  clearSession();
  switchView("login");
});

function bindElements() {
  [
    "todayText",
    "topUserAvatar",
    "topUserName",
    "topUserMenuWrap",
    "topUserBtn",
    "topUserMenu",
    "changePasswordBtn",
    "topLogoutBtn",
    "view-login",
    "view-dashboard",
    "supervisorId",
    "loginBtn",
    "loginStatus",
    "reportDate",
    "liveDate",
    "liveGuardFilter",
    "liveStatusFilter",
    "liveRefreshBtn",
    "liveTableBody",
    "loadBtn",
    "kpiShifts",
    "kpiChecked",
    "kpiLate",
    "kpiMissed",
    "kpiIncidents",
    "kpiCompliance",
    "chartRangeDays",
    "chartCompliance",
    "chartOperations",
    "chartSeverity",
    "chartShiftType",
    "chartTopCheckpoints",
    "summaryList",
    "incidentList",
    "addUserBtn",
    "userTabAdmin",
    "userTabGuards",
    "userPaneAdmin",
    "userPaneGuards",
    "adminTableBody",
    "guardsTableBody",
    "addCheckpointBtn",
    "checkpointsTableBody",
    "addTemplateBtn",
    "templatesTableBody"
  ].forEach((id) => {
    el[id] = document.getElementById(id);
  });
}

function bindEvents() {
  el.loginBtn.addEventListener("click", () => login(false));
  el.loadBtn.addEventListener("click", loadDashboard);
  el.liveRefreshBtn.addEventListener("click", loadLiveLogs);
  el.liveDate.addEventListener("change", loadLiveLogs);
  el.liveGuardFilter.addEventListener("change", loadLiveLogs);
  el.liveStatusFilter.addEventListener("change", loadLiveLogs);
  el.chartRangeDays.addEventListener("change", loadDashboard);
  el.topLogoutBtn.addEventListener("click", logout);
  el.topUserBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleTopUserMenu();
  });
  el.changePasswordBtn.addEventListener("click", openChangePasswordSwal);
  document.addEventListener("click", (event) => {
    if (!el.topUserMenuWrap.contains(event.target)) {
      closeTopUserMenu();
    }
  });
  el.addUserBtn.addEventListener("click", () => {
    if (state.userTab === "admin") {
      openAddAdminSwal();
    } else {
      openAddUserSwal();
    }
  });
  el.addCheckpointBtn.addEventListener("click", () => openCheckpointSwal());
  el.addTemplateBtn.addEventListener("click", () => openTemplateSwal());
  el.userTabAdmin.addEventListener("click", () => switchUserTab("admin"));
  el.userTabGuards.addEventListener("click", () => switchUserTab("guards"));
  document.querySelectorAll(".menu-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.getAttribute("data-panel");
      switchFuncPanel(panel || "overview");
    });
  });
}

async function login(silentMode) {
  const supervisorId = el.supervisorId.value.trim();

  if (!supervisorId) {
    if (!silentMode) setText(el.loginStatus, "Please enter ID");
    return;
  }

  try {
    if (!silentMode) setText(el.loginStatus, "Signing in...");
    const data = await callApi("supervisorLogin", { supervisorId });
    state.supervisor = data;
    saveSession({
      supervisor_id: supervisorId,
      name: data.name || "",
      email: data.email || ""
    });
    el.topUserName.textContent = data.name || data.supervisor_id;
    el.topUserAvatar.textContent = getInitials(data.name || data.supervisor_id);
    switchView("dashboard");
    switchFuncPanel("overview");
    switchUserTab("admin");
    renderAdminTable();
    setText(el.loginStatus, "");
    await Promise.all([loadDashboard(), loadMasterData()]);
    return true;
  } catch (err) {
    if (silentMode) {
      const session = loadSession();
      state.supervisor = {
        supervisor_id: session.supervisor_id || supervisorId,
        name: session.name || session.supervisor_id || supervisorId,
        email: session.email || ""
      };
      el.topUserName.textContent = state.supervisor.name || state.supervisor.supervisor_id;
      el.topUserAvatar.textContent = getInitials(state.supervisor.name || state.supervisor.supervisor_id);
      switchView("dashboard");
      switchFuncPanel("overview");
      switchUserTab("admin");
      renderAdminTable();
      notify(`Session restored (offline mode): ${err.message}`, "warning");
      return false;
    } else {
      clearSession();
      switchView("login");
      setText(el.loginStatus, `Login failed: ${err.message}`);
      return false;
    }
  }
}

function logout() {
  closeTopUserMenu();
  state.supervisor = null;
  state.guards = [];
  state.checkpoints = [];
  state.templates = [];
  state.shiftCheckpoints = {};
  destroyAllCharts();
  clearSession();
  el.topUserName.textContent = "-";
  el.topUserAvatar.textContent = "--";
  renderAdminTable();
  renderGuardsTable([]);
  renderCheckpointsTable([]);
  renderTemplatesTable([]);
  switchFuncPanel("overview");
  switchUserTab("admin");
  switchView("login");
}

function toggleTopUserMenu() {
  const isOpen = el.topUserMenu.classList.contains("show");
  el.topUserMenu.classList.toggle("show", !isOpen);
  el.topUserBtn.setAttribute("aria-expanded", isOpen ? "false" : "true");
}

function closeTopUserMenu() {
  el.topUserMenu.classList.remove("show");
  el.topUserBtn.setAttribute("aria-expanded", "false");
}

function switchFuncPanel(panelName) {
  document.querySelectorAll(".func-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `panel-${panelName}`);
  });
  document.querySelectorAll(".menu-item").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-panel") === panelName);
  });

  if (panelName === "templates") {
    loadTemplateData();
    return;
  }
  if (panelName === "live") {
    loadLiveLogs();
  }
}

function switchUserTab(tabName) {
  state.userTab = tabName;
  el.userTabAdmin.classList.toggle("active", tabName === "admin");
  el.userTabGuards.classList.toggle("active", tabName === "guards");
  el.userPaneAdmin.classList.toggle("active", tabName === "admin");
  el.userPaneGuards.classList.toggle("active", tabName === "guards");
}

async function openAddAdminSwal(existingAdmin) {
  const isEdit = !!existingAdmin;
  if (!window.Swal) return;
  const result = await Swal.fire({
    title: isEdit ? "Edit Admin" : "Add Admin",
    width: 520,
    customClass: { popup: "swal-user-popup" },
    html: `
      <div style="display:grid;gap:8px;text-align:left">
        <label>Supervisor ID</label>
        <input id="swalSupervisorId" class="swal2-input" placeholder="e.g. S002" value="${escapeAttr(isEdit ? (existingAdmin.supervisor_id || "") : "")}" ${isEdit ? "disabled" : ""}>
        <label>Name</label>
        <input id="swalSupervisorName" class="swal2-input" placeholder="Admin name" value="${escapeAttr(isEdit ? (existingAdmin.name || "") : "")}">
        <label>Email</label>
        <input id="swalSupervisorEmail" class="swal2-input" placeholder="Email" value="${escapeAttr(isEdit ? (existingAdmin.email || "") : "")}">
        <label>Status</label>
        <select id="swalSupervisorStatus" class="swal2-select">
          <option value="active" ${(isEdit ? String(existingAdmin.status || "active") : "active").toLowerCase() === "active" ? "selected" : ""}>active</option>
          <option value="inactive" ${(isEdit ? String(existingAdmin.status || "") : "").toLowerCase() === "inactive" ? "selected" : ""}>inactive</option>
        </select>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: isEdit ? "Save" : "Add",
    cancelButtonText: "Cancel",
    preConfirm: () => {
      const supervisor_id = document.getElementById("swalSupervisorId").value.trim();
      const name = document.getElementById("swalSupervisorName").value.trim();
      const email = document.getElementById("swalSupervisorEmail").value.trim();
      const status = document.getElementById("swalSupervisorStatus").value;
      if (!supervisor_id || !name) {
        Swal.showValidationMessage("Supervisor ID and Name are required");
        return false;
      }
      return { supervisor_id, name, email, status };
    }
  });
  if (!result.isConfirmed || !result.value) return;

  try {
    await callApi("upsertSupervisor", { payload: result.value });
    notify("บันทึกข้อมูล Admin สำเร็จ");
    if (state.supervisor && String(state.supervisor.supervisor_id) === String(result.value.supervisor_id)) {
      state.supervisor = { ...state.supervisor, ...result.value };
      el.topUserName.textContent = state.supervisor.name || state.supervisor.supervisor_id;
      el.topUserAvatar.textContent = getInitials(state.supervisor.name || state.supervisor.supervisor_id);
    }
    renderAdminTable();
  } catch (err) {
    notify(`บันทึกข้อมูล Admin ไม่สำเร็จ: ${err.message}`);
  }
}

async function loadDashboard() {
  if (!state.supervisor) return;

  const date = el.reportDate.value || toYmd(new Date());
  const days = Number(el.chartRangeDays.value || 30);
  notify("Loading dashboard...");

  try {
    const [data, chartData] = await Promise.all([
      callApi("getSupervisorDailySummary", {
        supervisorId: state.supervisor.supervisor_id,
        date
      }),
      callApi("getDashboardCharts", {
        supervisorId: state.supervisor.supervisor_id,
        endDate: date,
        days
      })
    ]);

    const hasApiCharts = hasDashboardChartData(chartData);
    if (hasApiCharts) {
      const kpi = data.kpi || {};
      el.kpiShifts.textContent = String(kpi.total_shifts || 0);
      el.kpiChecked.textContent = String(kpi.total_checked_points || 0);
      el.kpiLate.textContent = String(kpi.total_late_points || 0);
      el.kpiMissed.textContent = String(kpi.total_missed_points || 0);
      el.kpiIncidents.textContent = String(kpi.total_incidents || 0);
      el.kpiCompliance.textContent = `${Number(kpi.avg_compliance_pct || 0).toFixed(2)}%`;

      renderSummary(data.shifts || []);
      renderIncidents(data.incidents || []);
      renderDashboardCharts(chartData || {});
      notify("Dashboard loaded");
      return;
    }

    const fallback = await buildFallbackDashboardFromLogs(date, days);
    const fbKpi = fallback.kpi || {};
    el.kpiShifts.textContent = String(fbKpi.total_shifts || 0);
    el.kpiChecked.textContent = String(fbKpi.total_checked_points || 0);
    el.kpiLate.textContent = String(fbKpi.total_late_points || 0);
    el.kpiMissed.textContent = String(fbKpi.total_missed_points || 0);
    el.kpiIncidents.textContent = String(fbKpi.total_incidents || 0);
    el.kpiCompliance.textContent = `${Number(fbKpi.avg_compliance_pct || 0).toFixed(2)}%`;

    renderSummary(fallback.summaryRows || []);
    renderIncidents([]);
    renderDashboardCharts(fallback.charts || {});
    notify("Dashboard loaded (log fallback)");
  } catch (err) {
    notify(`Load dashboard failed: ${err.message}`);
  }
}

async function loadMasterData() {
  if (!state.supervisor) return;
  const [guardsResult, checkpointsResult, templatesResult] = await Promise.allSettled([
    callApi("listGuards", {}),
    callApi("listCheckpoints", {}),
    callApi("listShiftTemplates", {})
  ]);

  if (guardsResult.status === "fulfilled") {
    state.guards = guardsResult.value || [];
    renderGuardsTable(state.guards);
    renderAdminTable();
    renderLiveGuardFilter();
  } else {
    state.guards = [];
    renderGuardsTable([]);
    renderLiveGuardFilter();
    notify(`โหลดข้อมูล Guards ไม่สำเร็จ: ${guardsResult.reason?.message || guardsResult.reason}`);
  }

  if (checkpointsResult.status === "fulfilled") {
    state.checkpoints = checkpointsResult.value || [];
    renderCheckpointsTable(state.checkpoints);
  } else if (guardsResult.status === "fulfilled") {
    // Keep user data visible even if checkpoint loading fails.
    notify("โหลด Checkpoints ไม่สำเร็จ แต่ยังแสดงข้อมูลผู้ใช้งานได้");
  }

  if (templatesResult.status === "fulfilled") {
    state.templates = templatesResult.value || [];
    renderTemplatesTable(state.templates);
  } else {
    state.templates = [];
    renderTemplatesTable([]);
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

async function loadLiveLogs() {
  if (!state.supervisor) return;
  const date = el.liveDate && el.liveDate.value ? el.liveDate.value : toYmd(new Date());
  const guardId = String(el.liveGuardFilter ? el.liveGuardFilter.value : "").trim();
  const status = String(el.liveStatusFilter ? el.liveStatusFilter.value : "").trim();
  try {
    const rows = await callApi("listCheckLogs", {
      supervisorId: state.supervisor && state.supervisor.supervisor_id ? state.supervisor.supervisor_id : "",
      date,
      guardId,
      status
    });
    state.liveLogs = Array.isArray(rows) ? rows : [];
    renderLiveLogs(state.liveLogs);
  } catch (err) {
    renderLiveLogs([]);
    notify(`Load live logs failed: ${err.message}`, "error");
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

async function openAddUserSwal(existingGuard) {
  if (!state.supervisor) return;
  const isEdit = !!existingGuard;

  if (!window.Swal) return;
  const result = await Swal.fire({
    title: isEdit ? "Edit User" : "Add User",
    width: 520,
    customClass: { popup: "swal-user-popup" },
    html: `
      <div style="display:grid;gap:8px;text-align:left">
        <label>Guard ID</label>
        <input id="swalGuardId" class="swal2-input" placeholder="e.g. G002" value="${escapeAttr(isEdit ? existingGuard.guard_id : "")}" ${isEdit ? "disabled" : ""}>
        <label>Name</label>
        <input id="swalGuardName" class="swal2-input" placeholder="Guard name" value="${escapeAttr(isEdit ? (existingGuard.name || "") : "")}">
        <label>Phone</label>
        <input id="swalGuardPhone" class="swal2-input" placeholder="Phone" value="${escapeAttr(isEdit ? (existingGuard.phone || "") : "")}">
        <label>Email</label>
        <input id="swalGuardEmail" class="swal2-input" placeholder="Email" value="${escapeAttr(isEdit ? (existingGuard.email || "") : "")}">
        <label>Status</label>
        <select id="swalGuardStatus" class="swal2-select">
          <option value="active" ${(isEdit ? String(existingGuard.status || "") : "active") === "active" ? "selected" : ""}>active</option>
          <option value="inactive" ${(isEdit ? String(existingGuard.status || "") : "") === "inactive" ? "selected" : ""}>inactive</option>
        </select>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: isEdit ? "Save" : "Add",
    cancelButtonText: "Cancel",
    preConfirm: () => {
      const guardId = document.getElementById("swalGuardId").value.trim();
      const name = document.getElementById("swalGuardName").value.trim();
      const phone = document.getElementById("swalGuardPhone").value.trim();
      const email = document.getElementById("swalGuardEmail").value.trim();
      const status = document.getElementById("swalGuardStatus").value;
      if (!guardId || !name) {
        Swal.showValidationMessage("Guard ID and Name are required");
        return false;
      }
      return { guard_id: guardId, name, phone, email, status };
    }
  });
  if (!result.isConfirmed || !result.value) return;

  try {
    const payload = {
      ...result.value
    };
    await callApi("upsertGuard", { payload });
    notify("บันทึกข้อมูล Guard สำเร็จ");
    await loadMasterData();
  } catch (err) {
    notify(`บันทึกข้อมูล Guard ไม่สำเร็จ: ${err.message}`);
  }
}

async function openCheckpointSwal(existingCheckpoint) {
  const isEdit = !!existingCheckpoint;
  if (!window.Swal) return;
  const autoCheckpointId = isEdit
    ? String(existingCheckpoint.checkpoint_id || "")
    : generateNextCheckpointId();
  const autoQrText = isEdit
    ? String(existingCheckpoint.qr_text || "")
    : autoCheckpointId;

  const result = await Swal.fire({
    title: isEdit ? "Edit Checkpoint" : "Add Checkpoint",
    width: "92vw",
    customClass: { popup: "swal-checkpoint-popup" },
    html: `
      <div class="cp-form-grid">
        <div class="cp-field">
          <label>Checkpoint ID</label>
          <input id="swalCpId" class="swal2-input" value="${escapeAttr(autoCheckpointId)}" readonly>
        </div>
        <div class="cp-field">
          <label>Checkpoint Name</label>
          <input id="swalCpName" class="swal2-input" placeholder="Checkpoint name" value="${escapeAttr(isEdit ? (existingCheckpoint.checkpoint_name || "") : "")}">
        </div>
        <div class="cp-field">
          <label>QR Text</label>
          <input id="swalCpQrText" class="swal2-input" placeholder="QR Text" value="${escapeAttr(autoQrText)}">
        </div>
        <div class="cp-field">
          <label>Radius (meter)</label>
          <input id="swalCpRadius" class="swal2-input" placeholder="50" value="${escapeAttr(isEdit ? (existingCheckpoint.radius_m || "50") : "50")}">
        </div>
        <div class="cp-field">
          <label>Latitude, Longitude</label>
          <input id="swalCpCoords" class="swal2-input" placeholder="13.782520, 100.971532" value="${escapeAttr(isEdit ? `${existingCheckpoint.lat || ""}, ${existingCheckpoint.lng || ""}` : "")}">
        </div>
        <div class="cp-field cp-help-box">
          <label class="cp-help-title">Map</label>
          <span id="swalCpMapNotice" class="cp-label-note">Enter Latitude/Longitude manually or open Google Maps.</span>
          <button id="swalCpOpenGoogleBtn" type="button" class="cp-map-btn cp-map-btn-google">
            <span class="cp-map-google-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.3a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6z"/>
              </svg>
            </span>
            <span>Open Google Maps</span>
          </button>
        </div>
        <div class="cp-field">
          <label>Photo Required</label>
          <select id="swalCpPhotoRequired" class="swal2-select">
            <option value="TRUE" ${(isEdit ? String(existingCheckpoint.is_photo_required || "TRUE") : "TRUE").toUpperCase() === "TRUE" ? "selected" : ""}>TRUE</option>
            <option value="FALSE" ${(isEdit ? String(existingCheckpoint.is_photo_required || "") : "").toUpperCase() === "FALSE" ? "selected" : ""}>FALSE</option>
          </select>
        </div>
        <div class="cp-field">
          <label>Active</label>
          <select id="swalCpActive" class="swal2-select">
            <option value="TRUE" ${(isEdit ? String(existingCheckpoint.active || "TRUE") : "TRUE").toUpperCase() === "TRUE" ? "selected" : ""}>TRUE</option>
            <option value="FALSE" ${(isEdit ? String(existingCheckpoint.active || "") : "").toUpperCase() === "FALSE" ? "selected" : ""}>FALSE</option>
          </select>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: isEdit ? "Save" : "Add",
    cancelButtonText: "Cancel",
    didOpen: async () => {
      const initialLat = Number(isEdit ? existingCheckpoint.lat : 0);
      const initialLng = Number(isEdit ? existingCheckpoint.lng : 0);
      await initCheckpointMapPicker(Number.isFinite(initialLat) ? initialLat : 0, Number.isFinite(initialLng) ? initialLng : 0);
    },
    preConfirm: () => {
      const checkpoint_id = document.getElementById("swalCpId").value.trim();
      const checkpoint_name = document.getElementById("swalCpName").value.trim();
      const qr_text = document.getElementById("swalCpQrText").value.trim() || checkpoint_id;
      const coords = document.getElementById("swalCpCoords").value.trim();
      const parsed = parseCoordsText(coords);
      const lat = parsed ? parsed.lat : "";
      const lng = parsed ? parsed.lng : "";
      const radius_m = Number(document.getElementById("swalCpRadius").value || 50);
      const is_photo_required = document.getElementById("swalCpPhotoRequired").value;
      const active = document.getElementById("swalCpActive").value;
      if (!checkpoint_id || !checkpoint_name || !qr_text) {
        Swal.showValidationMessage("Checkpoint ID, Name and QR Text are required");
        return false;
      }
      if (coords && !parsed) {
        Swal.showValidationMessage("Coordinates format must be like: 13.782520, 100.971532");
        return false;
      }
      return { checkpoint_id, checkpoint_name, qr_text, lat, lng, radius_m, is_photo_required, active };
    }
  });
  if (!result.isConfirmed || !result.value) return;

  try {
    await callApi("upsertCheckpoint", { payload: result.value });
    notify("บันทึกข้อมูล Checkpoint สำเร็จ");
    await loadMasterData();
  } catch (err) {
    notify(`บันทึกข้อมูล Checkpoint ไม่สำเร็จ: ${err.message}`);
  }
}

function renderSummary(rows) {
  if (!rows.length) {
    el.summaryList.innerHTML = '<div class="item">No shift summary</div>';
    return;
  }
  el.summaryList.innerHTML = rows.map((r) => `
    <div class="item">
      <strong>${escapeHtml(r.shift_id || "-")}</strong><br>
      Guard: ${escapeHtml(r.guard_id || "-")}<br>
      Total: ${Number(r.total_points || 0)}, Checked: ${Number(r.checked_points || 0)}<br>
      Late: ${Number(r.late_points || 0)}, Missed: ${Number(r.missed_points || 0)}<br>
      Incidents: ${Number(r.incidents_count || 0)}, Compliance: ${Number(r.compliance_pct || 0)}%
    </div>
  `).join("");
}

function renderIncidents(rows) {
  if (!rows.length) {
    el.incidentList.innerHTML = '<div class="item">No incidents</div>';
    return;
  }
  el.incidentList.innerHTML = rows.map((r) => `
    <div class="item">
      <strong>${escapeHtml(r.type || "-")}</strong> (${escapeHtml(r.severity || "-")})<br>
      Shift: ${escapeHtml(r.shift_id || "-")} | Guard: ${escapeHtml(r.guard_id || "-")}<br>
      Time: ${escapeHtml(r.incident_time || "-")}<br>
      Detail: ${escapeHtml(r.detail || "-")}
    </div>
  `).join("");
}

function renderDashboardCharts(data) {
  if (!window.Chart) return;

  const complianceTrend = Array.isArray(data.compliance_trend) ? data.compliance_trend : [];
  const dailyOps = Array.isArray(data.daily_operations) ? data.daily_operations : [];
  const bySeverity = data.incidents_by_severity || {};
  const byShiftType = Array.isArray(data.shift_type_performance) ? data.shift_type_performance : [];
  const topCp = Array.isArray(data.top_problem_checkpoints) ? data.top_problem_checkpoints : [];

  upsertChart("compliance", el.chartCompliance, {
    type: "line",
    data: {
      labels: complianceTrend.map((x) => String(x.date || "").slice(5)),
      datasets: [{
        label: "Compliance %",
        data: complianceTrend.map((x) => Number(x.compliance_pct || 0)),
        borderColor: "#1b9aaa",
        backgroundColor: "rgba(27,154,170,0.16)",
        tension: 0.3,
        fill: true
      }]
    },
    options: baseChartOptions({
      scales: { y: { beginAtZero: true, max: 100 } }
    })
  });

  upsertChart("ops", el.chartOperations, {
    type: "bar",
    data: {
      labels: dailyOps.map((x) => String(x.date || "").slice(5)),
      datasets: [
        { label: "Checked", data: dailyOps.map((x) => Number(x.checked || 0)), backgroundColor: "#2e8b57" },
        { label: "Missed", data: dailyOps.map((x) => Number(x.missed || 0)), backgroundColor: "#e76f51" },
        { label: "Invalid", data: dailyOps.map((x) => Number(x.invalid || 0)), backgroundColor: "#f4a261" }
      ]
    },
    options: baseChartOptions({
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true }
      }
    })
  });

  upsertChart("severity", el.chartSeverity, {
    type: "doughnut",
    data: {
      labels: ["LOW", "MEDIUM", "HIGH"],
      datasets: [{
        data: [Number(bySeverity.LOW || 0), Number(bySeverity.MEDIUM || 0), Number(bySeverity.HIGH || 0)],
        backgroundColor: ["#2a9d8f", "#e9c46a", "#e63946"]
      }]
    },
    options: baseChartOptions({})
  });

  upsertChart("shiftType", el.chartShiftType, {
    type: "bar",
    data: {
      labels: byShiftType.map((x) => x.shift_type || "UNKNOWN"),
      datasets: [
        {
          label: "Avg Compliance %",
          data: byShiftType.map((x) => Number(x.avg_compliance_pct || 0)),
          backgroundColor: "#4c78a8"
        },
        {
          label: "Incidents",
          data: byShiftType.map((x) => Number(x.incidents || 0)),
          backgroundColor: "#f58518"
        }
      ]
    },
    options: baseChartOptions({ scales: { y: { beginAtZero: true } } })
  });

  upsertChart("topCp", el.chartTopCheckpoints, {
    type: "bar",
    data: {
      labels: topCp.map((x) => `${x.checkpoint_id || "-"} ${x.checkpoint_name || ""}`.trim()),
      datasets: [{
        label: "Issues",
        data: topCp.map((x) => Number(x.issues || 0)),
        backgroundColor: "#d14343"
      }]
    },
    options: baseChartOptions({
      indexAxis: "y",
      scales: { x: { beginAtZero: true } }
    })
  });
}

function hasDashboardChartData(data) {
  if (!data || typeof data !== "object") return false;
  if (Array.isArray(data.compliance_trend) && data.compliance_trend.length) return true;
  if (Array.isArray(data.daily_operations) && data.daily_operations.length) return true;
  if (Array.isArray(data.shift_type_performance) && data.shift_type_performance.length) return true;
  if (Array.isArray(data.top_problem_checkpoints) && data.top_problem_checkpoints.length) return true;
  const sev = data.incidents_by_severity || {};
  return Number(sev.LOW || 0) + Number(sev.MEDIUM || 0) + Number(sev.HIGH || 0) > 0;
}

async function buildFallbackDashboardFromLogs(endDate, days) {
  const safeDays = Math.max(1, Number(days || 30));
  const dates = buildDateRangeLocal(endDate, safeDays);

  const responses = await Promise.allSettled(
    dates.map((date) => callApi("listCheckLogs", {
      supervisorId: state.supervisor?.supervisor_id || "",
      date,
      guardId: "",
      status: ""
    }))
  );

  const allLogs = [];
  responses.forEach((res) => {
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      allLogs.push(...res.value);
    }
  });

  const dayStats = {};
  dates.forEach((d) => {
    dayStats[d] = { checked: 0, late: 0, invalid: 0, total: 0 };
  });

  const shiftMap = {};
  const checkpointIssueMap = {};
  const shiftTypeMap = {
    DAY: { total: 0, checked: 0, invalid: 0 },
    NIGHT: { total: 0, checked: 0, invalid: 0 }
  };

  allLogs.forEach((log) => {
    const status = String(log.status || "").toUpperCase();
    const scanTime = String(log.scan_time || "");
    const dateKey = scanTime.slice(0, 10);
    const cpKey = String(log.checkpoint_id || "");
    const shiftId = String(log.shift_id || "");

    if (!dayStats[dateKey]) {
      dayStats[dateKey] = { checked: 0, late: 0, invalid: 0, total: 0 };
    }

    dayStats[dateKey].total += 1;

    if (status === "ONTIME" || status === "LATE") {
      dayStats[dateKey].checked += 1;
      if (status === "LATE") dayStats[dateKey].late += 1;
    } else if (status.startsWith("INVALID")) {
      dayStats[dateKey].invalid += 1;
      if (cpKey) checkpointIssueMap[cpKey] = Number(checkpointIssueMap[cpKey] || 0) + 1;
    }

    if (shiftId) {
      if (!shiftMap[shiftId]) {
        shiftMap[shiftId] = {
          shift_id: shiftId,
          guard_id: String(log.guard_id || "-"),
          total_points: 0,
          checked_points: 0,
          late_points: 0,
          missed_points: 0,
          incidents_count: 0,
          compliance_pct: 0
        };
      }
      shiftMap[shiftId].total_points += 1;
      if (status === "ONTIME" || status === "LATE") {
        shiftMap[shiftId].checked_points += 1;
      }
      if (status === "LATE") {
        shiftMap[shiftId].late_points += 1;
      }
    }

    const hh = Number(scanTime.slice(11, 13) || 0);
    const type = (hh >= 18 || hh < 6) ? "NIGHT" : "DAY";
    shiftTypeMap[type].total += 1;
    if (status === "ONTIME" || status === "LATE") shiftTypeMap[type].checked += 1;
    if (status.startsWith("INVALID")) shiftTypeMap[type].invalid += 1;
  });

  const complianceTrend = dates.map((d) => {
    const s = dayStats[d] || { total: 0, checked: 0 };
    const compliancePct = s.total ? (s.checked / s.total) * 100 : 0;
    return { date: d, compliance_pct: Number(compliancePct.toFixed(2)) };
  });

  const dailyOperations = dates.map((d) => {
    const s = dayStats[d] || { checked: 0, invalid: 0, total: 0 };
    const missed = Math.max(0, s.total - s.checked - s.invalid);
    return { date: d, checked: s.checked, missed, invalid: s.invalid };
  });

  const shiftTypePerformance = Object.keys(shiftTypeMap).map((type) => {
    const s = shiftTypeMap[type];
    const avgCompliance = s.total ? (s.checked / s.total) * 100 : 0;
    return {
      shift_type: type,
      total_shifts: s.total,
      avg_compliance_pct: Number(avgCompliance.toFixed(2)),
      incidents: 0
    };
  });

  const checkpointsById = {};
  (state.checkpoints || []).forEach((cp) => {
    checkpointsById[String(cp.checkpoint_id || "")] = cp;
  });

  const topProblemCheckpoints = Object.keys(checkpointIssueMap)
    .map((cpId) => ({
      checkpoint_id: cpId,
      checkpoint_name: checkpointsById[cpId]?.checkpoint_name || "",
      issues: Number(checkpointIssueMap[cpId] || 0)
    }))
    .sort((a, b) => b.issues - a.issues)
    .slice(0, 10);

  const summaryRows = Object.values(shiftMap).map((row) => {
    const total = Number(row.total_points || 0);
    const checked = Number(row.checked_points || 0);
    row.compliance_pct = total ? Number(((checked / total) * 100).toFixed(2)) : 0;
    return row;
  });

  const totalShifts = summaryRows.length;
  const totalChecked = summaryRows.reduce((n, r) => n + Number(r.checked_points || 0), 0);
  const totalLate = summaryRows.reduce((n, r) => n + Number(r.late_points || 0), 0);
  const totalMissed = summaryRows.reduce((n, r) => n + Number(r.missed_points || 0), 0);
  const avgCompliancePct = totalShifts
    ? summaryRows.reduce((n, r) => n + Number(r.compliance_pct || 0), 0) / totalShifts
    : 0;

  return {
    kpi: {
      total_shifts: totalShifts,
      total_checked_points: totalChecked,
      total_late_points: totalLate,
      total_missed_points: totalMissed,
      total_incidents: 0,
      avg_compliance_pct: Number(avgCompliancePct.toFixed(2))
    },
    summaryRows,
    charts: {
      compliance_trend: complianceTrend,
      daily_operations: dailyOperations,
      incidents_by_severity: { LOW: 0, MEDIUM: 0, HIGH: 0 },
      shift_type_performance: shiftTypePerformance,
      top_problem_checkpoints: topProblemCheckpoints
    }
  };
}

function upsertChart(key, canvasEl, config) {
  if (!canvasEl || !window.Chart) return;
  if (state.charts[key]) {
    state.charts[key].destroy();
  }
  state.charts[key] = new Chart(canvasEl.getContext("2d"), config);
}

function baseChartOptions(extra) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" }
    },
    ...extra
  };
}

function destroyAllCharts() {
  Object.keys(state.charts || {}).forEach((k) => {
    try {
      if (state.charts[k]) state.charts[k].destroy();
    } catch (_) {}
  });
  state.charts = {};
}

function renderAdminTable() {
  if (!state.supervisor) {
    el.adminTableBody.innerHTML = '<tr><td colspan="4">No admin data</td></tr>';
    return;
  }

  el.adminTableBody.innerHTML = `
    <tr>
      <td>${escapeHtml(state.supervisor.supervisor_id || "-")}</td>
      <td>${escapeHtml(state.supervisor.name || "-")}</td>
      <td>${escapeHtml(state.supervisor.email || "-")}</td>
      <td class="row-actions">
        <button class="btn row-btn icon-btn" data-edit-admin="${escapeAttr(state.supervisor.supervisor_id || "")}" title="Edit" aria-label="Edit">
          ${iconEdit()}
        </button>
        <button class="btn row-btn icon-btn btn-danger-soft" data-del-admin="${escapeAttr(state.supervisor.supervisor_id || "")}" title="Delete" aria-label="Delete">
          ${iconTrash()}
        </button>
      </td>
    </tr>
  `;

  Array.from(el.adminTableBody.querySelectorAll("[data-edit-admin]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      openAddAdminSwal({
        supervisor_id: state.supervisor?.supervisor_id || "",
        name: state.supervisor?.name || "",
        email: state.supervisor?.email || "",
        status: "active"
      });
    });
  });

  Array.from(el.adminTableBody.querySelectorAll("[data-del-admin]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const supervisorId = btn.getAttribute("data-del-admin");
      if (!supervisorId) return;
      confirmDeleteAdmin({
        supervisor_id: supervisorId,
        name: state.supervisor?.name || ""
      });
    });
  });
}

function renderGuardsTable(rows) {
  if (!rows.length) {
    el.guardsTableBody.innerHTML = '<tr><td colspan="6">No guards found</td></tr>';
    return;
  }

  el.guardsTableBody.innerHTML = rows.map((g) => `
    <tr>
      <td>${escapeHtml(g.guard_id || "-")}</td>
      <td>${escapeHtml(g.name || "-")}</td>
      <td>${escapeHtml(g.phone || "-")}</td>
      <td>${escapeHtml(g.email || "-")}</td>
      <td>${escapeHtml(g.status || "active")}</td>
      <td class="row-actions">
        <button class="btn row-btn icon-btn" data-edit-guard="${escapeAttr(g.guard_id)}" title="Edit" aria-label="Edit">
          ${iconEdit()}
        </button>
        <button class="btn row-btn icon-btn btn-danger-soft" data-del-guard="${escapeAttr(g.guard_id)}" title="Delete" aria-label="Delete">
          ${iconTrash()}
        </button>
      </td>
    </tr>
  `).join("");

  Array.from(el.guardsTableBody.querySelectorAll("[data-edit-guard]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-guard");
      const guard = rows.find((x) => String(x.guard_id) === String(id));
      if (!guard) return;
      openAddUserSwal(guard);
    });
  });

  Array.from(el.guardsTableBody.querySelectorAll("[data-del-guard]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del-guard");
      const guard = rows.find((x) => String(x.guard_id) === String(id));
      if (!guard) return;
      confirmDeleteGuard(guard);
    });
  });
}

async function confirmDeleteGuard(guard) {
  if (!window.Swal) return;
  const result = await Swal.fire({
    title: "Delete Guard?",
    text: `${guard.guard_id} - ${guard.name || ""}`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Delete",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#d14343"
  });
  if (!result.isConfirmed) return;

  try {
    await callApi("deleteGuard", { guardId: guard.guard_id });
    notify("ลบ Guard สำเร็จ");
    await loadMasterData();
  } catch (err) {
    notify(`ลบ Guard ไม่สำเร็จ: ${err.message}`);
  }
}

async function confirmDeleteAdmin(admin) {
  if (!window.Swal) return;
  const result = await Swal.fire({
    title: "Delete Admin?",
    text: `${admin.supervisor_id} - ${admin.name || ""}`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Delete",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#d14343"
  });
  if (!result.isConfirmed) return;

  try {
    await callApi("deleteSupervisor", { supervisorId: admin.supervisor_id });
    notify("ลบ Admin สำเร็จ");
    if (state.supervisor && String(state.supervisor.supervisor_id) === String(admin.supervisor_id)) {
      logout();
      return;
    }
    await loadMasterData();
  } catch (err) {
    notify(`ลบ Admin ไม่สำเร็จ: ${err.message}`);
  }
}

function renderCheckpointsTable(rows) {
  if (!rows.length) {
    el.checkpointsTableBody.innerHTML = '<tr><td colspan="9">No checkpoints</td></tr>';
    return;
  }

  el.checkpointsTableBody.innerHTML = rows.map((c) => `
    <tr>
      <td>${escapeHtml(c.checkpoint_id || "-")}</td>
      <td>${escapeHtml(c.checkpoint_name || "-")}</td>
      <td>${escapeHtml(c.qr_text || "-")}</td>
      <td>${escapeHtml(c.lat || "-")}</td>
      <td>${escapeHtml(c.lng || "-")}</td>
      <td>${escapeHtml(c.radius_m || "50")}</td>
      <td>${escapeHtml(c.is_photo_required || "TRUE")}</td>
      <td>${escapeHtml(c.active || "TRUE")}</td>
      <td class="row-actions">
        <button class="btn row-btn icon-btn" data-edit-cp="${escapeAttr(c.checkpoint_id)}" title="Edit" aria-label="Edit">
          ${iconEdit()}
        </button>
        <button class="btn row-btn icon-btn btn-qr" data-qr-cp="${escapeAttr(c.checkpoint_id)}" title="QR Code" aria-label="QR Code">
          ${iconQr()}
        </button>
        <button class="btn row-btn icon-btn btn-danger-soft" data-del-cp="${escapeAttr(c.checkpoint_id)}" title="Delete" aria-label="Delete">
          ${iconTrash()}
        </button>
      </td>
    </tr>
  `).join("");

  Array.from(el.checkpointsTableBody.querySelectorAll("[data-edit-cp]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-cp");
      const cp = rows.find((x) => String(x.checkpoint_id) === String(id));
      if (!cp) return;
      openCheckpointSwal(cp);
    });
  });

  Array.from(el.checkpointsTableBody.querySelectorAll("[data-qr-cp]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-qr-cp");
      const cp = rows.find((x) => String(x.checkpoint_id) === String(id));
      if (!cp) return;
      openCheckpointQrSwal(cp);
    });
  });

  Array.from(el.checkpointsTableBody.querySelectorAll("[data-del-cp]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del-cp");
      const cp = rows.find((x) => String(x.checkpoint_id) === String(id));
      if (!cp) return;
      confirmDeleteCheckpoint(cp);
    });
  });
}

async function openCheckpointQrSwal(checkpoint) {
  if (!window.Swal) return;
  const qrText = String(checkpoint.qr_text || checkpoint.checkpoint_id || "").trim();
  if (!qrText) {
    notify("Checkpoint นี้ไม่มี QR Text");
    return;
  }
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(qrText)}`;
  await Swal.fire({
    title: `QR: ${escapeHtml(checkpoint.checkpoint_id || "-")}`,
    width: 480,
    html: `
      <div style="display:grid;gap:10px;justify-items:center">
        <img src="${qrUrl}" alt="Checkpoint QR" style="width:320px;height:320px;border:1px solid #d8e1ef;border-radius:8px;background:#fff">
        <div style="font-size:13px;color:#5b6d86"><strong>QR Text:</strong> ${escapeHtml(qrText)}</div>
        <a class="btn" href="${qrUrl}" download="QR-${escapeAttr(checkpoint.checkpoint_id || "checkpoint")}.png" style="text-decoration:none">Download QR</a>
      </div>
    `,
    showConfirmButton: true,
    confirmButtonText: "Close"
  });
}

async function confirmDeleteCheckpoint(checkpoint) {
  if (!window.Swal) return;
  const result = await Swal.fire({
    title: "Delete Checkpoint?",
    text: `${checkpoint.checkpoint_id} - ${checkpoint.checkpoint_name || ""}`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Delete",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#d14343"
  });
  if (!result.isConfirmed) return;

  try {
    await callApi("deleteCheckpoint", { checkpointId: checkpoint.checkpoint_id });
    notify("ลบ Checkpoint สำเร็จ");
    await loadMasterData();
  } catch (err) {
    notify(`ลบ Checkpoint ไม่สำเร็จ: ${err.message}`);
  }
}


async function openChangePasswordSwal() {
  closeTopUserMenu();
  if (!state.supervisor || !window.Swal) return;

  const result = await Swal.fire({
    title: "Change Password",
    width: 460,
    customClass: { popup: "swal-user-popup" },
    html: `
      <div style="display:grid;gap:8px;text-align:left">
        <label>New Password</label>
        <input id="swalNewPassword" class="swal2-input" type="password" placeholder="At least 6 characters">
        <label>Confirm Password</label>
        <input id="swalConfirmPassword" class="swal2-input" type="password" placeholder="Re-enter password">
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Save",
    cancelButtonText: "Cancel",
    preConfirm: () => {
      const newPassword = document.getElementById("swalNewPassword").value;
      const confirmPassword = document.getElementById("swalConfirmPassword").value;
      if (!newPassword || newPassword.length < 6) {
        Swal.showValidationMessage("Password must be at least 6 characters");
        return false;
      }
      if (newPassword !== confirmPassword) {
        Swal.showValidationMessage("Confirm password does not match");
        return false;
      }
      return { newPassword };
    }
  });
  if (!result.isConfirmed || !result.value) return;

  try {
    await callApi("changeSupervisorPassword", {
      supervisorId: state.supervisor.supervisor_id,
      newPassword: result.value.newPassword
    });
    notify("เปลี่ยนรหัสผ่านสำเร็จ");
  } catch (err) {
    notify(`เปลี่ยนรหัสผ่านไม่สำเร็จ: ${err.message}`);
  }
}

async function loadTemplateData() {
  if (!state.supervisor) return;
  try {
    const rows = await callApi("listShiftTemplates", {});
    state.templates = Array.isArray(rows) ? rows : [];
    renderTemplatesTable(state.templates);
    notify("โหลดข้อมูล Template สำเร็จ");
  } catch (err) {
    state.templates = [];
    renderTemplatesTable([]);
    notify(`โหลดข้อมูล Template ไม่สำเร็จ: ${err.message}`);
  }
}

function renderTemplatesTable(rows) {
  if (!rows.length) {
    el.templatesTableBody.innerHTML = '<tr><td colspan="8">No templates</td></tr>';
    return;
  }

  el.templatesTableBody.innerHTML = rows.map((t) => `
    <tr>
      <td>${escapeHtml(t.template_id || "-")}</td>
      <td>${escapeHtml(t.template_name || "-")}</td>
      <td>${escapeHtml(formatTemplateGuardNames(t.guard_ids || t.guard_id))}</td>
      <td>${Number(t.rounds_per_shift || 1)}</td>
      <td>${escapeHtml(t.start_time || "-")}</td>
      <td>${escapeHtml(t.end_time || "-")}</td>
      <td>${escapeHtml(t.status || "ACTIVE")}</td>
      <td class="row-actions">
        <button class="btn row-btn icon-btn" data-edit-template="${escapeAttr(t.template_id)}" title="Edit" aria-label="Edit">
          ${iconEdit()}
        </button>
        <button class="btn row-btn icon-btn btn-danger-soft" data-del-template="${escapeAttr(t.template_id)}" title="Delete" aria-label="Delete">
          ${iconTrash()}
        </button>
      </td>
    </tr>
  `).join("");

  Array.from(el.templatesTableBody.querySelectorAll("[data-edit-template]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-template");
      const template = rows.find((x) => String(x.template_id) === String(id));
      if (!template) return;
      openTemplateSwal(template);
    });
  });

  Array.from(el.templatesTableBody.querySelectorAll("[data-del-template]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del-template");
      const template = rows.find((x) => String(x.template_id) === String(id));
      if (!template) return;
      confirmDeleteTemplate(template);
    });
  });

}

async function confirmDeleteTemplate(template) {
  if (!window.Swal) return;
  const result = await Swal.fire({
    title: "Delete Template?",
    text: `${template.template_id} - ${template.template_name || ""}`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Delete",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#d14343"
  });
  if (!result.isConfirmed) return;

  try {
    await callApi("deleteShiftTemplate", { templateId: template.template_id });
    notify("ลบ Template สำเร็จ");
    await loadTemplateData();
  } catch (err) {
    notify(`ลบ Template ไม่สำเร็จ: ${err.message}`);
  }
}

async function openTemplateSwal(existingTemplate) {
  const isEdit = !!existingTemplate;
  const defaultTemplateId = isEdit ? String(existingTemplate.template_id || "") : generateNextTemplateId();
  const selectedGuardIds = parseGuardIdsLocal(isEdit ? (existingTemplate.guard_ids || existingTemplate.guard_id || "") : "");
  let initialRouteRows = [];
  if (isEdit) {
    try {
      const route = await callApi("listTemplateCheckpoints", { templateId: defaultTemplateId });
      initialRouteRows = Array.isArray(route) ? route : [];
    } catch (_) {
      initialRouteRows = [];
    }
  }

  const cpOptions = (state.checkpoints || []).map((cp) => {
    return `<option value="${escapeAttr(cp.checkpoint_id)}">${escapeHtml(cp.checkpoint_id)} - ${escapeHtml(cp.checkpoint_name || "-")}</option>`;
  }).join("");
  const guardOptions = (state.guards || []).map((g) => {
    const gid = String(g.guard_id || "");
    if (!gid) return "";
    return `<option value="${escapeAttr(gid)}">${escapeHtml(gid)} - ${escapeHtml(g.name || "-")}</option>`;
  }).join("");
  const guardRows = (selectedGuardIds.length ? selectedGuardIds : [""]).map((id) => ({
    guard_id: String(id || "").trim()
  }));
  const routeRows = (initialRouteRows || []).map((r) => ({
    seq_no: Number(r.seq_no || 1),
    checkpoint_id: String(r.checkpoint_id || "")
  }));

  const result = await Swal.fire({
    title: isEdit ? "Edit Template" : "Add Template",
    width: "94vw",
    customClass: { popup: "swal-user-popup" },
    html: `
      <div class="template-popup-layout">
        <div class="template-form-grid">
          <div class="template-field">
            <label>Template ID</label>
            <input id="swalTemplateId" class="swal2-input" value="${escapeAttr(defaultTemplateId)}" readonly>
          </div>
          <div class="template-field">
            <label>Template Name</label>
            <input id="swalTemplateName" class="swal2-input" value="${escapeAttr(isEdit ? (existingTemplate.template_name || "") : "")}" placeholder="e.g. Day / Night">
          </div>
          <div class="template-field">
            <label>Rounds per Shift</label>
            <input id="swalTemplateRounds" class="swal2-input" type="number" min="1" step="1" value="${escapeAttr(isEdit ? Number(existingTemplate.rounds_per_shift || 1) : 1)}">
          </div>
          <div class="template-field">
            <label>Status</label>
            <select id="swalTemplateStatus" class="swal2-select">
              <option value="ACTIVE" ${String(isEdit ? existingTemplate.status : "ACTIVE").toUpperCase() === "ACTIVE" ? "selected" : ""}>ACTIVE</option>
              <option value="INACTIVE" ${String(isEdit ? existingTemplate.status : "").toUpperCase() === "INACTIVE" ? "selected" : ""}>INACTIVE</option>
            </select>
          </div>
          <div class="template-field">
            <label>Start Time</label>
            <input id="swalTemplateStart" class="swal2-input" type="time" value="${escapeAttr(toHm(isEdit ? existingTemplate.start_time : "08:00"))}">
          </div>
          <div class="template-field">
            <label>End Time</label>
            <input id="swalTemplateEnd" class="swal2-input" type="time" value="${escapeAttr(toHm(isEdit ? existingTemplate.end_time : "17:00"))}">
          </div>
        </div>
        <div class="template-route-panel">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <label style="margin:0">Route Checkpoints</label>
            <button id="swalTemplateAddRouteRow" type="button" class="btn template-add-route-btn">+ Add</button>
          </div>
          <div class="table-wrap" style="max-height:34vh;overflow:auto">
            <table class="data-table" style="min-width:360px">
              <thead>
                <tr><th>Seq</th><th>Checkpoint</th><th>Action</th></tr>
              </thead>
              <tbody id="swalTemplateRouteBody"></tbody>
            </table>
          </div>
        </div>
        <div class="template-guard-panel">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <label style="margin:0">Guards</label>
            <button id="swalTemplateAddGuardRow" type="button" class="btn template-add-route-btn">+ Add</button>
          </div>
          <div class="table-wrap" style="max-height:34vh;overflow:auto">
            <table class="data-table" style="min-width:300px">
              <thead>
                <tr><th>Guard</th><th>Action</th></tr>
              </thead>
              <tbody id="swalTemplateGuardBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: isEdit ? "Save" : "Add",
    cancelButtonText: "Cancel",
    didOpen: () => {
      const syncRowsFromDom = () => {
        const seqEls = Array.from(document.querySelectorAll(".route-seq"));
        const cpEls = Array.from(document.querySelectorAll(".route-cp"));
        if (!cpEls.length) return;
        const draft = cpEls.map((cpEl, idx) => ({
          seq_no: Number(seqEls[idx]?.value || 0),
          checkpoint_id: String(cpEl.value || "").trim()
        }));
        routeRows.splice(0, routeRows.length, ...draft);
      };
      const syncGuardRowsFromDom = () => {
        const guardEls = Array.from(document.querySelectorAll(".guard-select"));
        if (!guardEls.length) return;
        const draft = guardEls.map((guardEl) => ({
          guard_id: String(guardEl.value || "").trim()
        }));
        guardRows.splice(0, guardRows.length, ...draft);
      };

      const tableHtml = () => {
        if (!routeRows.length) return '<tr><td colspan="3">No checkpoints in route</td></tr>';
        return routeRows.map((r, i) => `
          <tr>
            <td><input class="swal2-input route-seq" data-idx="${i}" type="number" min="1" value="${r.seq_no}" style="width:90px;margin:0!important"></td>
            <td>
              <select class="swal2-select route-cp" data-idx="${i}" style="width:100%;margin:0!important">
                <option value="">Select checkpoint</option>
                ${cpOptions.replace(`value="${escapeAttr(r.checkpoint_id)}"`, `value="${escapeAttr(r.checkpoint_id)}" selected`)}
              </select>
            </td>
            <td><button type="button" class="btn row-btn btn-danger-soft route-del" data-idx="${i}">Delete</button></td>
          </tr>
        `).join("");
      };
      const guardTableHtml = () => {
        if (!guardOptions) return '<tr><td colspan="2">No guards available</td></tr>';
        if (!guardRows.length) return '<tr><td colspan="2">No guards selected</td></tr>';
        return guardRows.map((r, i) => `
          <tr>
            <td>
              <select class="swal2-select guard-select" data-idx="${i}" style="width:100%;margin:0!important">
                <option value="">Select guard</option>
                ${guardOptions.replace(`value="${escapeAttr(r.guard_id)}"`, `value="${escapeAttr(r.guard_id)}" selected`)}
              </select>
            </td>
            <td><button type="button" class="btn row-btn btn-danger-soft guard-del" data-idx="${i}">Delete</button></td>
          </tr>
        `).join("");
      };

      const rerender = () => {
        const body = document.getElementById("swalTemplateRouteBody");
        if (!body) return;
        body.innerHTML = tableHtml();
        Array.from(body.querySelectorAll(".route-del")).forEach((btn) => {
          btn.addEventListener("click", () => {
            syncRowsFromDom();
            const idx = Number(btn.getAttribute("data-idx"));
            if (Number.isFinite(idx) && idx >= 0) {
              routeRows.splice(idx, 1);
              rerender();
            }
          });
        });
      };
      const rerenderGuards = () => {
        const body = document.getElementById("swalTemplateGuardBody");
        if (!body) return;
        body.innerHTML = guardTableHtml();
        Array.from(body.querySelectorAll(".guard-del")).forEach((btn) => {
          btn.addEventListener("click", () => {
            syncGuardRowsFromDom();
            const idx = Number(btn.getAttribute("data-idx"));
            if (Number.isFinite(idx) && idx >= 0) {
              guardRows.splice(idx, 1);
              rerenderGuards();
            }
          });
        });
      };

      const addBtn = document.getElementById("swalTemplateAddRouteRow");
      if (addBtn) {
        addBtn.addEventListener("click", () => {
          syncRowsFromDom();
          routeRows.push({ seq_no: routeRows.length + 1, checkpoint_id: "" });
          rerender();
        });
      }
      const addGuardBtn = document.getElementById("swalTemplateAddGuardRow");
      if (addGuardBtn) {
        addGuardBtn.addEventListener("click", () => {
          syncGuardRowsFromDom();
          guardRows.push({ guard_id: "" });
          rerenderGuards();
        });
      }
      rerender();
      rerenderGuards();
    },
    preConfirm: () => {
      const template_id = document.getElementById("swalTemplateId").value.trim();
      const template_name = document.getElementById("swalTemplateName").value.trim();
      const rounds_per_shift = Number(document.getElementById("swalTemplateRounds").value || 1);
      const start_time = normalizeTime(document.getElementById("swalTemplateStart").value);
      const end_time = normalizeTime(document.getElementById("swalTemplateEnd").value);
      const status = document.getElementById("swalTemplateStatus").value;
      const guardIdsRaw = Array.from(document.querySelectorAll(".guard-select"))
        .map((node) => String(node.value || "").trim())
        .filter(Boolean);
      const guardIds = [];
      const uniq = {};
      guardIdsRaw.forEach((id) => {
        if (uniq[id]) return;
        uniq[id] = true;
        guardIds.push(id);
      });
      if (!template_id || !template_name || !start_time || !end_time || !Number.isFinite(rounds_per_shift) || rounds_per_shift < 1) {
        Swal.showValidationMessage("Please fill all required fields");
        return false;
      }
      if (!guardIds.length) {
        Swal.showValidationMessage("Please select at least 1 guard");
        return false;
      }

      const seqEls = Array.from(document.querySelectorAll(".route-seq"));
      const cpEls = Array.from(document.querySelectorAll(".route-cp"));
      if (!cpEls.length) {
        Swal.showValidationMessage("Please add at least 1 checkpoint in route");
        return false;
      }
      const routeItems = cpEls.map((cpEl, idx) => ({
        seq_no: Number(seqEls[idx]?.value || 0),
        checkpoint_id: String(cpEl.value || "").trim()
      }));
      if (routeItems.some((x) => !x.seq_no || !x.checkpoint_id)) {
        Swal.showValidationMessage("Each route row requires Seq and Checkpoint");
        return false;
      }

      return {
        payload: {
          template_id,
          template_name,
          shift_name: template_name,
          guard_id: guardIds[0],
          guard_ids: guardIds,
          rounds_per_shift: Math.floor(rounds_per_shift),
          start_time,
          end_time,
          status
        },
        routeItems
      };
    }
  });

  if (!result.isConfirmed || !result.value) return;
  try {
    await callApi("upsertShiftTemplate", { payload: result.value.payload });
    await callApi("replaceTemplateCheckpoints", {
      templateId: result.value.payload.template_id,
      items: result.value.routeItems
    });
    await loadTemplateData();
    notify("บันทึกข้อมูล Template สำเร็จ");
  } catch (err) {
    notify(`บันทึกข้อมูล Template ไม่สำเร็จ: ${err.message}`);
  }
}

async function openTemplateRouteSwal(template) {
  if (!template || !template.template_id) return;
  let rows = [];
  try {
    rows = await callApi("listTemplateCheckpoints", { templateId: template.template_id });
  } catch (err) {
    notify(`โหลด Route ของ Template ไม่สำเร็จ: ${err.message}`);
    return;
  }

  const cpOptions = (state.checkpoints || []).map((cp) => {
    return `<option value="${escapeAttr(cp.checkpoint_id)}">${escapeHtml(cp.checkpoint_id)} - ${escapeHtml(cp.checkpoint_name || "-")}</option>`;
  }).join("");

  const routeRows = (rows || []).map((r) => ({
    seq_no: Number(r.seq_no || 1),
    checkpoint_id: String(r.checkpoint_id || "")
  }));

  const tableHtml = () => {
    if (!routeRows.length) return '<tr><td colspan="3">No checkpoint route</td></tr>';
    return routeRows.map((r, i) => `
      <tr>
        <td><input class="swal2-input route-seq" data-idx="${i}" type="number" min="1" value="${r.seq_no}" style="width:90px;margin:0!important"></td>
        <td>
          <select class="swal2-select route-cp" data-idx="${i}" style="width:100%;margin:0!important">
            <option value="">Select checkpoint</option>
            ${cpOptions.replace(`value="${escapeAttr(r.checkpoint_id)}"`, `value="${escapeAttr(r.checkpoint_id)}" selected`)}
          </select>
        </td>
        <td><button type="button" class="btn row-btn route-del" data-idx="${i}">Delete</button></td>
      </tr>
    `).join("");
  };

  const result = await Swal.fire({
    title: `Template Route: ${escapeHtml(template.template_id)}`,
    width: "92vw",
    customClass: { popup: "swal-checkpoint-popup" },
    html: `
      <div style="display:grid;gap:10px;text-align:left">
        <div>Template: <strong>${escapeHtml(template.template_name || "-")}</strong></div>
        <div class="table-wrap" style="max-height:46vh;overflow:auto">
          <table class="data-table" style="min-width:760px">
            <thead>
              <tr><th>Seq</th><th>Checkpoint</th><th>Action</th></tr>
            </thead>
            <tbody id="swalRouteBody">${tableHtml()}</tbody>
          </table>
        </div>
        <button id="swalAddRouteRow" type="button" class="btn" style="width:160px">+ Add Checkpoint</button>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Save Route",
    cancelButtonText: "Cancel",
    didOpen: () => {
      const syncRowsFromDom = () => {
        const seqEls = Array.from(document.querySelectorAll(".route-seq"));
        const cpEls = Array.from(document.querySelectorAll(".route-cp"));
        if (!cpEls.length) return;
        const draft = cpEls.map((cpEl, idx) => ({
          seq_no: Number(seqEls[idx]?.value || 0),
          checkpoint_id: String(cpEl.value || "").trim()
        }));
        routeRows.splice(0, routeRows.length, ...draft);
      };

      const rerender = () => {
        const body = document.getElementById("swalRouteBody");
        if (!body) return;
        body.innerHTML = tableHtml();
        Array.from(body.querySelectorAll(".route-del")).forEach((btn) => {
          btn.addEventListener("click", () => {
            syncRowsFromDom();
            const idx = Number(btn.getAttribute("data-idx"));
            if (Number.isFinite(idx) && idx >= 0) {
              routeRows.splice(idx, 1);
              rerender();
            }
          });
        });
      };
      const addBtn = document.getElementById("swalAddRouteRow");
      if (addBtn) {
        addBtn.addEventListener("click", () => {
          syncRowsFromDom();
          routeRows.push({ seq_no: routeRows.length + 1, checkpoint_id: "" });
          rerender();
        });
      }
      rerender();
    },
    preConfirm: () => {
      const seqEls = Array.from(document.querySelectorAll(".route-seq"));
      const cpEls = Array.from(document.querySelectorAll(".route-cp"));
      if (!cpEls.length) {
        Swal.showValidationMessage("Please add at least 1 checkpoint");
        return false;
      }
      const items = cpEls.map((cpEl, idx) => ({
        seq_no: Number(seqEls[idx]?.value || 0),
        checkpoint_id: String(cpEl.value || "").trim()
      }));
      if (items.some((x) => !x.checkpoint_id || !x.seq_no)) {
        Swal.showValidationMessage("Each row requires Seq and Checkpoint");
        return false;
      }
      return items;
    }
  });

  if (!result.isConfirmed || !result.value) return;
  try {
    await callApi("replaceTemplateCheckpoints", { templateId: template.template_id, items: result.value });
    notify("บันทึก Route Template สำเร็จ");
  } catch (err) {
    notify(`บันทึก Route Template ไม่สำเร็จ: ${err.message}`);
  }
}

async function callApi(action, payload = {}) {
  startLoading();
  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action, ...payload })
    });
  } catch (err) {
    stopLoading();
    throw new Error(`Network error: ${err.message}`);
  }

  try {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    const json = JSON.parse(text);
    if (!json.ok) {
      throw new Error(json.error || "API error");
    }
    return json.data;
  } finally {
    stopLoading();
  }
}

function saveSession(obj) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj || {}));
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch (_) {
    return {};
  }
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

function switchView(name) {
  el["view-login"].classList.toggle("active", name === "login");
  el["view-dashboard"].classList.toggle("active", name === "dashboard");
}

function setText(node, text) {
  if (node) node.textContent = text;
}

function notify(message, icon) {
  const msg = String(message || "").trim();
  if (!msg) return;
  if (!window.Swal) return;
  const lower = msg.toLowerCase();
  const autoIcon = icon || (
    lower.includes("failed") ||
    lower.includes("error") ||
    lower.includes("ไม่สำเร็จ") ||
    lower.includes("not found")
      ? "error"
      : "success"
  );
  Swal.fire({
    toast: true,
    position: "bottom-end",
    icon: autoIcon,
    title: msg,
    showConfirmButton: false,
    timer: autoIcon === "error" ? 3500 : 2200,
    timerProgressBar: true
  });
}

function startLoading() {
  loadingCount += 1;
  if (loadingCount > 1) return;
  if (!window.Swal) return;
  Swal.fire({
    title: "Loading data...",
    text: "Please wait",
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading()
  });
}

function stopLoading() {
  loadingCount = Math.max(0, loadingCount - 1);
  if (loadingCount !== 0) return;
  if (!window.Swal) return;
  Swal.close();
}

function startTopClock() {
  const render = () => {
    const now = new Date();
    el.todayText.textContent = `Today: ${toYmd(now)} ${toHms(now)}`;
  };
  render();
  setInterval(render, 1000);
}

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildDateRangeLocal(endYmd, days) {
  const safeDays = Math.max(1, Number(days || 1));
  const end = new Date(`${String(endYmd).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(end.getTime())) return [toYmd(new Date())];
  const out = [];
  for (let i = safeDays - 1; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    out.push(toYmd(d));
  }
  return out;
}

function toHms(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function escapeHtml(input) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(input) {
  return escapeHtml(input).replaceAll("`", "");
}

function parseGuardIdsLocal(raw) {
  if (Array.isArray(raw)) {
    const uniq = {};
    const out = [];
    raw.forEach((x) => {
      const id = String(x || "").trim();
      if (!id || uniq[id]) return;
      uniq[id] = true;
      out.push(id);
    });
    return out;
  }

  const uniq = {};
  return String(raw || "")
    .split(",")
    .map((x) => String(x || "").trim())
    .filter((id) => {
      if (!id || uniq[id]) return false;
      uniq[id] = true;
      return true;
    });
}

function formatTemplateGuardNames(raw) {
  const ids = parseGuardIdsLocal(raw);
  if (!ids.length) return "-";

  const guardMap = {};
  (state.guards || []).forEach((g) => {
    const id = String(g.guard_id || "");
    if (!id) return;
    guardMap[id] = g;
  });

  return ids.map((id) => {
    const g = guardMap[id];
    if (!g) return id;
    return `${id} (${g.name || "-"})`;
  }).join(", ");
}

async function initCheckpointMapPicker(initialLat, initialLng) {
  const noticeEl = document.getElementById("swalCpMapNotice");
  const openGoogleBtn = document.getElementById("swalCpOpenGoogleBtn");
  const coordsInput = document.getElementById("swalCpCoords");
  if (!coordsInput) return;

  const hasInitial = Number.isFinite(initialLat) && Number.isFinite(initialLng) && initialLat !== 0 && initialLng !== 0;
  const center = hasInitial ? { lat: initialLat, lng: initialLng } : { ...DEFAULT_MAP_CENTER };

  const openGoogleMaps = () => {
    const parsed = parseCoordsText(String(coordsInput.value || ""));
    const hasCoords = !!parsed;
    const lat = parsed ? parsed.lat : 0;
    const lng = parsed ? parsed.lng : 0;
    const point = hasCoords ? { lat, lng } : center;
    const url = hasCoords
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${point.lat},${point.lng}`)}`
      : DEFAULT_GOOGLE_MAPS_URL;
    const left = Math.max(0, Math.round((window.screen.width - 1120) / 2));
    const top = Math.max(0, Math.round((window.screen.height - 760) / 2));
    const features = `width=1120,height=760,left=${left},top=${top},resizable=yes,scrollbars=yes,toolbar=yes,menubar=yes,location=yes,status=yes`;

    const popup = window.open("", "guardtour_map_popup", features);
    if (popup) {
      popup.location.replace(url);
      popup.focus();
      if (noticeEl) noticeEl.textContent = "Opened Google Maps in popup window.";
      return;
    }

    if (noticeEl) noticeEl.textContent = "Popup blocked by browser. Please allow popups for this site.";
  };

  if (openGoogleBtn) openGoogleBtn.addEventListener("click", openGoogleMaps);
}

function getInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "--";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toHm(value) {
  const raw = String(value || "").trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  const hh = String(Math.min(23, Math.max(0, Number(m[1])))).padStart(2, "0");
  const mm = String(Math.min(59, Math.max(0, Number(m[2])))).padStart(2, "0");
  return `${hh}:${mm}`;
}

function normalizeTime(value) {
  const hm = toHm(value);
  return hm ? `${hm}:00` : "";
}

function parseCoordsText(input) {
  const text = String(input || "").trim();
  if (!text) return null;
  const parts = text.split(",").map((x) => x.trim());
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function iconEdit() {
  return `
    <svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l9.06-9.06.92.92L5.92 19.58zM20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.3a1 1 0 0 0-1.41 0L15.13 5.13l3.75 3.75 1.83-1.84z"/>
    </svg>
  `;
}

function iconTrash() {
  return `
    <svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h12l-1 14H7L6 7zm3-4h6l1 2h4v2H4V5h4l1-2zm1 6v10h2V9h-2zm4 0v10h2V9h-2z"/>
    </svg>
  `;
}

function iconQr() {
  return `
    <svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8-2h2v2h-2v-2zm2 2h2v2h-2v-2zm-2 2h2v2h-2v-2zm4 0h2v4h-2v-2h-2v-2h2v-2h2v2z"/>
    </svg>
  `;
}


function generateNextTemplateId() {
  let maxId = 0;
  (state.templates || []).forEach((t) => {
    const raw = String(t.template_id || "").trim();
    const m = raw.match(/^TPL(\d+)$/i);
    if (!m) return;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > maxId) maxId = n;
  });
  return `TPL${String(maxId + 1).padStart(3, "0")}`;
}

function generateNextCheckpointId() {
  let maxId = 0;
  (state.checkpoints || []).forEach((cp) => {
    const raw = String(cp.checkpoint_id || "").trim();
    const m = raw.match(/^CP(\d+)$/i);
    if (!m) return;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > maxId) maxId = n;
  });
  const next = maxId + 1;
  return `CP${String(next).padStart(3, "0")}`;
}










