const API_URL = "https://script.google.com/macros/s/AKfycbw5n09onxcuAr9XG7k8j-3GhbumAD5zk2iptjU8-_uG-HHG849-DFNzVMgPk5n1vdE/exec";

const STORAGE = {
  SESSION: "guardtour.session",
  QUEUE: "guardtour.queue",
  SYNC_META: "guardtour.syncmeta"
};

const state = {
  guard: null,
  shifts: [],
  shiftProgressMap: {},
  activeShift: null,
  activePlan: [],
  currentRound: 1,
  selectedPlanKey: "",
  scannedQr: "",
  gps: null,
  checkpointPhoto: "",
  incidentPhoto: "",
  incidentMode: "NONE",
  checkpointQrMap: {},
  doneCheckpointCounter: {},
  scanner: null,
  queue: [],
  syncing: false,
  lastSync: "-",
  suppressLoading: false,
  summaryCacheDate: "",
  summaryCache: null
};

const el = {};
let loadingCount = 0;

window.addEventListener("DOMContentLoaded", async () => {
  bindElements();
  bindEvents();
  state.queue = loadQueue();
  state.lastSync = loadSyncMeta().lastSync || "-";
  updateTodayText();
  setInterval(updateTodayText, 1000);
  refreshQueueBanner();

  if (!navigator.onLine) {
    console.warn("à¸­à¸¸à¸›à¸à¸£à¸“à¹Œà¸­à¸­à¸Ÿà¹„à¸¥à¸™à¹Œ: à¸šà¸±à¸™à¸—à¸¶à¸à¸„à¸´à¸§à¹„à¸§à¹‰à¸à¹ˆà¸­à¸™ à¹à¸¥à¹‰à¸§à¸‹à¸´à¸‡à¸à¹Œà¸ à¸²à¸¢à¸«à¸¥à¸±à¸‡à¹„à¸”à¹‰");
  }

  const guardIdFromUrl = readQueryParam("guardId");
  if (guardIdFromUrl) {
    saveSession({ guardId: guardIdFromUrl, activeShiftId: "" });
    clearQueryString();
  }

  hideGuardHeader();
  state.suppressLoading = true;
  showLoginLoadingSwal();
  await restoreSession();
});

function bindElements() {
  [
    "appRoot", "appHeader", "todayText", "guardBadge", "guardAvatar", "guardNameText", "guardIdText",
    "view-shifts", "view-tour", "view-dashboard",
    "logoutBtn", "shiftList", "tourTitle",
    "dbShiftTotal", "dbRoundProgress", "dbCheckedTotal", "dbIncidentTotal", "dashboardList", "syncNowBtn",
    "statTotal", "statDone", "qrReader", "manualQr",
    "actionQrCard", "actionGpsCard", "actionIncidentCard", "qrStepStatus",
    "gpsBtn", "gpsText", "photoInput", "photoPreview",
    "checkpointRemark", "submitCheckpointBtn", "checkpointStatus",
    "currentPointText", "checkinActionPanel", "checkpointListPanel", "backToCheckpointListBtn", "quickActionCards",
    "detailGpsPhoto", "detailSubmit", "detailIncident",
    "gpsStepStatus", "submitStepStatus", "incidentStepStatus",
    "roundTabs", "checkpointList", "incidentDetail",
    "incidentChoiceNone", "incidentChoiceHas", "incidentExtraFields",
    "submitIncidentBtn",
    "incidentStatus",
    "bottomNav", "navTour", "navDashboard"
  ].forEach((id) => {
    el[id] = document.getElementById(id);
  });
}

function bindEvents() {
  el.logoutBtn.addEventListener("click", onLogout);

  el.navTour.addEventListener("click", () => {
    if (!state.activeShift) return;
    switchView("tour");
  });
  el.navDashboard.addEventListener("click", async () => {
    switchView("dashboard");
    renderDashboard();
    await loadGuardDashboardSummary(true);
  });

  if (el.syncNowBtn) el.syncNowBtn.addEventListener("click", () => syncQueue(true));

  el.gpsBtn.addEventListener("click", loadGps);
  if (el.actionQrCard) el.actionQrCard.addEventListener("click", openQrScanCard);
  if (el.actionGpsCard) el.actionGpsCard.addEventListener("click", onCapturePhotoCard);
  if (el.actionIncidentCard) el.actionIncidentCard.addEventListener("click", () => openActionDetail("incident"));
  if (el.incidentChoiceNone) el.incidentChoiceNone.addEventListener("click", () => setIncidentMode("NONE"));
  if (el.incidentChoiceHas) el.incidentChoiceHas.addEventListener("click", () => setIncidentMode("HAS"));
  el.submitIncidentBtn.addEventListener("click", onSubmitIncident);
  if (el.backToCheckpointListBtn) {
    el.backToCheckpointListBtn.addEventListener("click", () => {
      const inStepDetail = (el.detailIncident && !el.detailIncident.classList.contains("hidden"))
        || (el.detailGpsPhoto && !el.detailGpsPhoto.classList.contains("hidden"));
      if (inStepDetail) {
        hideAllActionDetails();
        return;
      }
      state.selectedPlanKey = "";
      hideAllActionDetails();
      renderCheckpointList();
      refreshStats();
    });
  }
  window.addEventListener("online", async () => {
    await syncQueue(false);
  });

  window.addEventListener("offline", () => {
    refreshQueueBanner();
  });

  el.photoInput.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!state.gps) {
      try {
        setText(el.gpsText, "à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”à¸•à¸³à¹à¸«à¸™à¹ˆà¸‡...");
        await captureGps();
        setText(el.gpsText, `Lat: ${state.gps.lat.toFixed(6)}, Lng: ${state.gps.lng.toFixed(6)}`);
      } catch (err) {
        setText(el.gpsText, `à¹‚à¸«à¸¥à¸” GPS à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: ${err.message}`);
      }
    }
    state.checkpointPhoto = await fileToDataUrlWithWatermark(file, 1280, 0.8, {
      timestamp: new Date(),
      lat: state.gps ? state.gps.lat : null,
      lng: state.gps ? state.gps.lng : null
    });
    el.photoPreview.src = state.checkpointPhoto;
    el.photoPreview.classList.remove("hidden");
    setText(el.checkpointStatus, "à¸–à¹ˆà¸²à¸¢à¸£à¸¹à¸›à¸ªà¸³à¹€à¸£à¹‡à¸ˆ à¹à¸¥à¸°à¸›à¸£à¸°à¸—à¸±à¸šà¸¥à¸²à¸¢à¸™à¹‰à¸³à¹à¸¥à¹‰à¸§");
    updateActionCardsState();
  });

  if (el.incidentPhotoInput) {
    el.incidentPhotoInput.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      state.incidentPhoto = await fileToDataUrl(file, 1280, 0.75);
      if (el.incidentPhotoPreview) {
        el.incidentPhotoPreview.src = state.incidentPhoto;
        el.incidentPhotoPreview.classList.remove("hidden");
      }
    });
  }
}

async function restoreSession() {
  const session = loadSession();
  if (!session.guardId) {
    state.suppressLoading = false;
    if (window.Swal) Swal.close();
    window.location.href = "index.html";
    return;
  }

  try {
    const date = toYmd(new Date());
    await loadGuardBootstrap(session.guardId, date);
    renderShiftList();
    renderDashboard();
    await openAssignedRouteOrFallback(session.activeShiftId);
    state.suppressLoading = false;
    if (window.Swal) Swal.close();
  } catch (err) {
    clearSession();
    state.suppressLoading = false;
    if (window.Swal) Swal.close();
    await showSwalMessage("error", "à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ", `à¸à¸¹à¹‰à¸„à¸·à¸™à¹€à¸‹à¸ªà¸Šà¸±à¸™à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: ${err.message}`);
    window.location.href = "index.html";
  }
}
function onLogout() {
  stopQrScanner();
  state.guard = null;
  state.shifts = [];
  state.activeShift = null;
  state.activePlan = [];
  state.doneCheckpointCounter = {};

  clearSession();
  hideGuardHeader();
  window.location.href = "index.html";
}

function setGuardHeader(guard) {
  if (!guard) return;

  const guardName = guard.name || "à¹€à¸ˆà¹‰à¸²à¸«à¸™à¹‰à¸²à¸—à¸µà¹ˆ";
  const initials = String(guardName).trim().slice(0, 1).toUpperCase() || "à¸£";

  el.guardAvatar.textContent = initials;
  el.guardNameText.textContent = guardName;
  if (el.appHeader) el.appHeader.classList.remove("hidden");
  if (el.guardIdText) el.guardIdText.textContent = "";
  el.guardBadge.classList.remove("hidden");
  el.bottomNav.classList.remove("hidden");
}

function hideGuardHeader() {
  if (el.appHeader) el.appHeader.classList.add("hidden");
  el.guardBadge.classList.add("hidden");
  el.bottomNav.classList.add("hidden");
}

function getShiftProfile(shift) {
  return String(
    shift.profile_name || shift.template_name || shift.shift_name || "ทั่วไป"
  ).trim();
}

function displayShiftStatus(status) {
  const code = String(status || "OPEN").toUpperCase();
  if (code === "CLOSED") return "ปิดแล้ว";
  return "เปิดอยู่";
}

function renderShiftList() {
  const rows = state.shifts || [];

  if (!rows.length) {
    el.shiftList.innerHTML = '<div class="shift-card">ไม่พบเทมเพลตที่ผูกกับรหัสนี้ กรุณาตรวจสอบในหน้า Admin</div>';
    return;
  }

  el.shiftList.innerHTML = rows.map((s) => {
    const status = String(s.status || "OPEN").toUpperCase();
    const statusClass = status === "CLOSED" ? "badge badge-closed" : "badge badge-open";

    return `
      <div class="shift-card">
        <h4>${escapeHtml(getShiftProfile(s))}</h4>
        <p class="meta">เวลา ${escapeHtml(s.start_time || "-")} - ${escapeHtml(s.end_time || "-")}</p>
        <p class="meta">รหัสกะ: ${escapeHtml(s.shift_id || "")}</p>
        <span class="${statusClass}">${displayShiftStatus(status)}</span>
      </div>
    `;
  }).join("");
}

async function openShift(index) {
  stopQrScanner();
  const shift = state.shifts[index];
  if (!shift) return;

  state.activeShift = shift;
  state.activePlan = Array.isArray(shift.checkpoints) ? shift.checkpoints : [];
  state.currentRound = detectFirstRound(state.activePlan);
  state.selectedPlanKey = "";
  state.doneCheckpointCounter = {};
  state.scannedQr = "";
  state.gps = null;
  state.checkpointPhoto = "";
  state.incidentPhoto = "";
  state.incidentMode = "NONE";

  if (el.manualQr) el.manualQr.value = "";
  el.photoInput.value = "";
  if (el.incidentPhotoInput) el.incidentPhotoInput.value = "";
  el.photoPreview.classList.add("hidden");
  if (el.incidentPhotoPreview) el.incidentPhotoPreview.classList.add("hidden");

  setText(el.gpsText, "ยังไม่โหลด GPS");
  setText(el.checkpointStatus, "");
  setText(el.incidentStatus, "");
  setText(el.qrStepStatus, "ยังไม่สแกน QR");
  setText(el.gpsStepStatus, "ยังไม่ถ่าย");
  setText(el.submitStepStatus, "รอข้อมูลให้ครบ");
  setText(el.incidentStepStatus, "รอข้อมูลให้ครบ");
  setIncidentMode("NONE");
  hideAllActionDetails();

  el.tourTitle.textContent = `${getShiftProfile(shift)} (${formatShiftWindow(shift)})`;
  saveSession({ guardId: state.guard.guard_id, activeShiftId: shift.shift_id });
  state.doneCheckpointCounter = getShiftProgressCounter(shift);

  renderCheckpointList();
  refreshStats();
  refreshQueueBanner();

  el.navTour.disabled = false;
  switchView("tour");
}

function getShiftProgressCounter(shift) {
  if (!shift) return {};
  const counter = {};
  const progress = state.shiftProgressMap[String(shift.shift_id || "")] || {};
  Object.keys(progress).forEach((cpId) => {
    counter[String(cpId)] = Number(progress[cpId] || 0);
  });
  return counter;
}

function renderCheckpointList() {
  if (!state.activePlan.length) {
    el.roundTabs.innerHTML = "";
    setText(el.currentPointText, "ไม่พบจุดตรวจในรอบนี้");
    if (el.checkinActionPanel) el.checkinActionPanel.classList.add("hidden");
    if (el.checkpointListPanel) el.checkpointListPanel.classList.remove("hidden");
    stopQrScanner();
    el.checkpointList.innerHTML = '<div class="checkpoint-card">ไม่มีจุดตรวจในกะนี้</div>';
    return;
  }

  const planItems = buildPlanWithOccurrence(state.activePlan);
  const rounds = getRoundNumbers(planItems);
  if (!rounds.includes(state.currentRound)) state.currentRound = rounds[0];
  renderRoundTabs(rounds);

  const currentItems = planItems.filter((x) => Number(x.round_no || 1) === Number(state.currentRound));
  const firstPendingIdx = currentItems.findIndex((item) => !isPlanItemDone(item));
  if (state.selectedPlanKey && !currentItems.some((x) => getPlanItemKey(x) === state.selectedPlanKey)) {
    state.selectedPlanKey = "";
  }

  const selectedItem = currentItems.find((x) => getPlanItemKey(x) === state.selectedPlanKey) || null;
  if (selectedItem) {
    setText(
      el.currentPointText,
      `\u0e08\u0e38\u0e14\u0e17\u0e35\u0e48\u0e40\u0e25\u0e37\u0e2d\u0e01: ${selectedItem.checkpoint_name || selectedItem.checkpoint_id}`
    );
  } else {
    setText(el.currentPointText, "\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e08\u0e38\u0e14\u0e15\u0e23\u0e27\u0e08\u0e08\u0e32\u0e01\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e14\u0e49\u0e32\u0e19\u0e25\u0e48\u0e32\u0e07\u0e01\u0e48\u0e2d\u0e19");
  }
  toggleCheckinActionPanel(!!selectedItem);
  updateActionCardsState();

  el.checkpointList.innerHTML = currentItems.map((cp) => {
    const done = isPlanItemDone(cp);
    const key = getPlanItemKey(cp);
    const isSelected = key === state.selectedPlanKey;
    const idx = currentItems.findIndex((x) => getPlanItemKey(x) === key);
    const locked = firstPendingIdx >= 0 && idx > firstPendingIdx && !done;
    const disabled = done || locked;
    const statusMeta = getCheckpointStatusMeta({ done, locked, isSelected });

    return `
      <button type="button" class="checkpoint-card ${done ? "done" : ""} ${isSelected ? "active" : ""}" data-plan-key="${escapeAttr(key)}" ${disabled ? "disabled" : ""}>
        <div class="point-head">
          <div>
            <p class="point-label">\u0e08\u0e38\u0e14\u0e17\u0e35\u0e48</p>
            <h4 class="point-name">${escapeHtml(cp.checkpoint_name || cp.checkpoint_id)}</h4>
          </div>
          <strong class="point-no">${Number(cp.seq_no || 0)}</strong>
        </div>
        <div class="status-row">
          <span class="status-icon ${statusMeta.cls}" aria-hidden="true">${renderStatusIcon(statusMeta.type)}</span>
          <span class="status-text">${statusMeta.label}</span>
        </div>
      </button>
    `;
  }).join("");

  Array.from(el.checkpointList.querySelectorAll("[data-plan-key]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedPlanKey = String(btn.getAttribute("data-plan-key") || "");
      renderCheckpointList();
      refreshStats();
    });
  });
}

function refreshStats() {
  const planItems = buildPlanWithOccurrence(state.activePlan);
  const rounds = getRoundNumbers(planItems);
  const totalRounds = rounds.length;
  const doneRounds = rounds.filter((r) => isRoundDone(r)).length;
  el.statTotal.textContent = `${totalRounds} \u0e23\u0e2d\u0e1a`;
  el.statDone.textContent = `${doneRounds} \u0e23\u0e2d\u0e1a`;
}

function renderDashboard() {
  const total = state.shifts.length;
  const rows = state.summaryCache && Array.isArray(state.summaryCache.rows) ? state.summaryCache.rows : [];
  const checkedTotal = rows.reduce((sum, row) => sum + Number(row.checked || 0), 0);
  const incidentTotal = rows.reduce((sum, row) => sum + Number(row.incidents || 0), 0);
  const roundsDone = rows.length
    ? rows.reduce((sum, row) => sum + Number(row.rounds_done || 0), 0)
    : 0;
  const roundsTotal = rows.length
    ? rows.reduce((sum, row) => sum + Number(row.rounds_total || 0), 0)
    : (state.shifts || []).reduce((sum, s) => sum + Number(s.rounds_required || 1), 0);

  if (el.dbShiftTotal) el.dbShiftTotal.textContent = String(total);
  if (el.dbRoundProgress) el.dbRoundProgress.textContent = `${roundsDone}/${roundsTotal} รอบ`;
  if (el.dbCheckedTotal) el.dbCheckedTotal.textContent = String(checkedTotal);
  if (el.dbIncidentTotal) el.dbIncidentTotal.textContent = String(incidentTotal);

  if (!state.shifts.length) {
    el.dashboardList.innerHTML = `
      <div class="dashboard-card dashboard-empty">
        <h4>ยังไม่มีกะงานวันนี้</h4>
        <p class="meta">กรุณาตรวจสอบการผูก Template กับรหัส รปภ ในหน้า Admin</p>
      </div>
    `;
    return;
  }

  if (!rows.length) {
    el.dashboardList.innerHTML = state.shifts.map((s) => {
      const checkpointCount = Array.isArray(s.checkpoints) ? s.checkpoints.length : 0;
      const roundsTotal = Number(s.rounds_required || 1);
      const status = String(s.status || "OPEN").toUpperCase();
      const statusClass = status === "CLOSED" ? "badge badge-closed" : "badge badge-open";
      const roundPct = roundsTotal > 0 ? 0 : 0;
      const checkPct = checkpointCount > 0 ? 0 : 0;

      return `
        <div class="dashboard-card dashboard-shift-card">
          <div class="dashboard-head">
            <h4>${escapeHtml(getShiftProfile(s))}</h4>
            <span class="${statusClass}">${displayShiftStatus(status)}</span>
          </div>
          <p class="meta dashboard-time">เวลา ${escapeHtml(s.start_time || "-")} - ${escapeHtml(s.end_time || "-")}</p>

          <div class="dashboard-progress-wrap">
            <div class="dashboard-progress-head"><span>ความคืบหน้ารอบ</span><strong>0/${roundsTotal}</strong></div>
            <div class="dashboard-progress-bar"><i style="width:${roundPct}%"></i></div>
          </div>
          <div class="dashboard-progress-wrap">
            <div class="dashboard-progress-head"><span>จุดตรวจแล้ว</span><strong>0/${checkpointCount}</strong></div>
            <div class="dashboard-progress-bar"><i style="width:${checkPct}%"></i></div>
          </div>

          <div class="dashboard-mini-grid">
            <div class="dashboard-mini-card mini-incident">
              <i class="material-symbols-outlined mini-icon" aria-hidden="true">notification_important</i>
              <span>แจ้งเหตุ</span><strong>0</strong>
            </div>
            <div class="dashboard-mini-card mini-late">
              <i class="material-symbols-outlined mini-icon" aria-hidden="true">schedule</i>
              <span>ช้า</span><strong>0</strong>
            </div>
            <div class="dashboard-mini-card mini-error">
              <i class="material-symbols-outlined mini-icon" aria-hidden="true">gpp_bad</i>
              <span>ผิดพลาด</span><strong>0</strong>
            </div>
          </div>
        </div>
      `;
    }).join("");
    return;
  }

  el.dashboardList.innerHTML = rows.map((row) => {
    const statusClass = row.done ? "badge badge-closed" : "badge badge-open";
    const statusText = row.done ? "ครบแล้ว" : "ยังไม่ครบ";
    const roundsTotalLocal = Number(row.rounds_total || 0);
    const expectedLocal = Number(row.expected || 0);
    const roundPct = roundsTotalLocal > 0
      ? Math.min(100, Math.round((Number(row.rounds_done || 0) / roundsTotalLocal) * 100))
      : 0;
    const checkPct = expectedLocal > 0
      ? Math.min(100, Math.round((Number(row.checked || 0) / expectedLocal) * 100))
      : 0;
    return `
      <div class="dashboard-card dashboard-shift-card">
        <h4>${escapeHtml(row.name)}</h4>
        <div class="dashboard-head">
          <p class="meta dashboard-time">เวลา ${escapeHtml(row.start)} - ${escapeHtml(row.end)}</p>
          <span class="${statusClass}">${statusText}</span>
        </div>

        <div class="dashboard-progress-wrap">
          <div class="dashboard-progress-head"><span>ความคืบหน้ารอบ</span><strong>${row.rounds_done}/${row.rounds_total}</strong></div>
          <div class="dashboard-progress-bar"><i style="width:${roundPct}%"></i></div>
        </div>
        <div class="dashboard-progress-wrap">
          <div class="dashboard-progress-head"><span>จุดตรวจแล้ว</span><strong>${row.checked}/${row.expected}</strong></div>
          <div class="dashboard-progress-bar"><i style="width:${checkPct}%"></i></div>
        </div>

        <div class="dashboard-mini-grid">
          <div class="dashboard-mini-card mini-incident">
            <i class="material-symbols-outlined mini-icon" aria-hidden="true">notification_important</i>
            <span>แจ้งเหตุ</span><strong>${row.incidents}</strong>
          </div>
          <div class="dashboard-mini-card mini-late">
            <i class="material-symbols-outlined mini-icon" aria-hidden="true">schedule</i>
            <span>ช้า</span><strong>${row.late}</strong>
          </div>
          <div class="dashboard-mini-card mini-error">
            <i class="material-symbols-outlined mini-icon" aria-hidden="true">gpp_bad</i>
            <span>ผิดพลาด</span><strong>${row.invalid}</strong>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function loadGuardDashboardSummary(forceRefresh) {
  if (!state.guard) return;
  const date = toYmd(new Date());
  if (!forceRefresh && state.summaryCacheDate === date && state.summaryCache) return;

  try {
    const [logsRes, incidentsRes] = await Promise.allSettled([
      callApi("listCheckLogs", { date, guardId: state.guard.guard_id }),
      callApi("listIncidents", { date, guardId: state.guard.guard_id, status: "" })
    ]);
    const logs = logsRes.status === "fulfilled" && Array.isArray(logsRes.value) ? logsRes.value : [];
    const incidents = incidentsRes.status === "fulfilled" && Array.isArray(incidentsRes.value) ? incidentsRes.value : [];
    const summary = buildGuardSummaryFromRows(logs, incidents);
    state.summaryCacheDate = date;
    state.summaryCache = summary;
    renderDashboard();
  } catch (_) {
    // keep fallback rendering from shifts only
  }
}

function buildGuardSummaryFromRows(logRows, incidentRows) {
  const shiftMap = {};
  const logCounterByShiftCp = {};
  (state.shifts || []).forEach((s) => {
    const shiftId = String(s.shift_id || "");
    const expected = Array.isArray(s.checkpoints) ? s.checkpoints.length : 0;
    const baseProgress = state.shiftProgressMap[shiftId] || {};
    const roundProgress = computeRoundProgressByCounter(s, baseProgress);
    shiftMap[shiftId] = {
      id: shiftId,
      name: getShiftProfile(s),
      start: String(s.start_time || "-"),
      end: String(s.end_time || "-"),
      expected,
      checked: 0,
      late: 0,
      invalid: 0,
      incidents: 0,
      rounds_total: Number(roundProgress.total || 0),
      rounds_done: Number(roundProgress.done || 0),
      done: false
    };
  });

  logRows.forEach((log) => {
    const shiftId = String(log.shift_id || "");
    if (!shiftMap[shiftId]) return;
    const status = String(log.status || "").toUpperCase();
    if (status === "ONTIME" || status === "LATE") {
      shiftMap[shiftId].checked += 1;
      if (status === "LATE") shiftMap[shiftId].late += 1;
      const cpId = String(log.checkpoint_id || "");
      if (cpId) {
        if (!logCounterByShiftCp[shiftId]) logCounterByShiftCp[shiftId] = {};
        logCounterByShiftCp[shiftId][cpId] = Number(logCounterByShiftCp[shiftId][cpId] || 0) + 1;
      }
    } else if (status.startsWith("INVALID")) {
      shiftMap[shiftId].invalid += 1;
    }
  });

  incidentRows.forEach((row) => {
    const shiftId = String(row.shift_id || "");
    if (!shiftMap[shiftId]) return;
    shiftMap[shiftId].incidents += 1;
  });

  const rows = Object.values(shiftMap).map((row) => {
    const shift = (state.shifts || []).find((s) => String(s.shift_id || "") === String(row.id || ""));
    if (shift) {
      const roundProgress = computeRoundProgressByCounter(shift, logCounterByShiftCp[row.id] || {});
      row.rounds_total = Number(roundProgress.total || row.rounds_total || 0);
      row.rounds_done = Number(roundProgress.done || 0);
    }
    row.done = row.expected > 0 && row.checked >= row.expected;
    return row;
  });
  const doneShifts = rows.filter((x) => x.done).length;
  return { rows, doneShifts };
}

function computeRoundProgressByCounter(shift, counterMap) {
  const checkpoints = Array.isArray(shift && shift.checkpoints) ? shift.checkpoints.slice() : [];
  if (!checkpoints.length) return { done: 0, total: 0 };

  checkpoints.sort((a, b) =>
    Number(a.round_no || 1) - Number(b.round_no || 1) ||
    Number(a.seq_no || 0) - Number(b.seq_no || 0)
  );

  const remaining = {};
  Object.keys(counterMap || {}).forEach((cpId) => {
    remaining[String(cpId)] = Number(counterMap[cpId] || 0);
  });

  const roundCounter = {};
  checkpoints.forEach((cp) => {
    const roundNo = Number(cp.round_no || 1);
    const cpId = String(cp.checkpoint_id || "");
    if (!roundCounter[roundNo]) roundCounter[roundNo] = { total: 0, done: 0 };
    roundCounter[roundNo].total += 1;

    if (cpId && Number(remaining[cpId] || 0) > 0) {
      roundCounter[roundNo].done += 1;
      remaining[cpId] = Number(remaining[cpId] || 0) - 1;
    }
  });

  const rounds = Object.keys(roundCounter).map((k) => roundCounter[k]);
  const total = rounds.length;
  const done = rounds.filter((r) => Number(r.total || 0) > 0 && Number(r.done || 0) >= Number(r.total || 0)).length;
  return { done, total };
}

function refreshQueueBanner() {
  // Queue runs in background; no dashboard KPI card for queue/sync anymore.
}

function invalidateGuardSummaryCache() {
  state.summaryCacheDate = "";
  state.summaryCache = null;
}

function isDashboardVisible() {
  return !!(el["view-dashboard"] && el["view-dashboard"].classList.contains("active"));
}

async function loadGps() {
  try {
    await captureGps();
    setText(el.gpsText, `Lat: ${state.gps.lat.toFixed(6)}, Lng: ${state.gps.lng.toFixed(6)}`);
    updateActionCardsState();
  } catch (err) {
    setText(el.gpsText, `à¹‚à¸«à¸¥à¸” GPS à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: ${err.message}`);
  }
}

async function onCapturePhotoCard() {
  const selectedItem = getSelectedPlanItem();
  if (!selectedItem) {
    setText(el.checkpointStatus, "à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸à¸ˆà¸¸à¸”à¸•à¸£à¸§à¸ˆà¸à¹ˆà¸­à¸™");
    return;
  }
  if (el.photoInput) {
    el.photoInput.value = "";
    el.photoInput.click();
  }
}

function captureGps() {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("à¸­à¸¸à¸›à¸à¸£à¸“à¹Œà¹„à¸¡à¹ˆà¸£à¸­à¸‡à¸£à¸±à¸š GPS"));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.gps = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        resolve(state.gps);
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

async function onSubmitCheckpoint() {
  if (!state.activeShift || !state.guard) return;
  const selectedItem = getSelectedPlanItem();
  if (!selectedItem) {
    setText(el.checkpointStatus, "à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸à¸ˆà¸¸à¸”à¸•à¸£à¸§à¸ˆà¸ˆà¸²à¸à¸£à¸²à¸¢à¸à¸²à¸£à¸à¹ˆà¸­à¸™à¸ªà¹ˆà¸‡");
    return;
  }

  const qrText = (state.scannedQr || "").trim();
  if (!qrText) {
    setText(el.checkpointStatus, "à¸à¸£à¸¸à¸“à¸²à¸à¸” Card 1 à¹€à¸žà¸·à¹ˆà¸­à¸ªà¹à¸à¸™ QR à¸à¹ˆà¸­à¸™");
    return;
  }

  if (!state.gps) {
    setText(el.checkpointStatus, "à¸à¸£à¸¸à¸“à¸²à¹‚à¸«à¸¥à¸” GPS à¸à¹ˆà¸­à¸™à¸ªà¹ˆà¸‡");
    return;
  }

  if (!state.checkpointPhoto) {
    setText(el.checkpointStatus, "à¸à¸£à¸¸à¸“à¸²à¹à¸™à¸šà¸£à¸¹à¸›à¸–à¹ˆà¸²à¸¢à¸à¹ˆà¸­à¸™à¸ªà¹ˆà¸‡");
    return;
  }

  const payload = {
    shift_id: state.activeShift.shift_id,
    guard_id: state.guard.guard_id,
    qr_text_scanned: qrText,
    gps_lat: state.gps.lat,
    gps_lng: state.gps.lng,
    photo_url: state.checkpointPhoto,
    remark: el.checkpointRemark ? el.checkpointRemark.value.trim() : ""
  };

  try {
    setText(el.checkpointStatus, "à¸à¸³à¸¥à¸±à¸‡à¸ªà¹ˆà¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥...");
    const res = await callApi("submitCheckpoint", { payload });
    await showCheckpointResultSwal(res, selectedItem);

    if (res.checkpoint_id) {
      const key = String(res.checkpoint_id);
      const valid = String(res.status || "") === "ONTIME" || String(res.status || "") === "LATE";
      if (valid) {
        state.doneCheckpointCounter[key] = Number(state.doneCheckpointCounter[key] || 0) + 1;
      }

      moveToNextRoundIfCurrentDone();
      state.selectedPlanKey = "";
      renderCheckpointList();
      refreshStats();
      invalidateGuardSummaryCache();
      if (isDashboardVisible()) await loadGuardDashboardSummary(true);

      if (String(selectedItem.checkpoint_id || "") !== String(res.checkpoint_id || "")) {
        setText(el.checkpointStatus, "à¸šà¸±à¸™à¸—à¸¶à¸à¹à¸¥à¹‰à¸§ à¹à¸•à¹ˆà¸ˆà¸¸à¸”à¸—à¸µà¹ˆà¸ªà¹à¸à¸™à¹„à¸¡à¹ˆà¸•à¸£à¸‡à¸à¸±à¸šà¸ˆà¸¸à¸”à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸");
      } else {
        setText(el.checkpointStatus, `à¸ªà¹ˆà¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¸³à¹€à¸£à¹‡à¸ˆ (${res.status})`);
      }
    } else {
      setText(el.checkpointStatus, `à¸ªà¹ˆà¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¸³à¹€à¸£à¹‡à¸ˆ (${res.status})`);
      invalidateGuardSummaryCache();
      if (isDashboardVisible()) await loadGuardDashboardSummary(true);
    }
    clearCheckpointDraft();
  } catch (err) {
    enqueueAction("submitCheckpoint", { payload });
    setText(el.checkpointStatus, `à¸ªà¹ˆà¸‡à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: à¸šà¸±à¸™à¸—à¸¶à¸à¸„à¸´à¸§à¸­à¸­à¸Ÿà¹„à¸¥à¸™à¹Œà¹à¸¥à¹‰à¸§ (${err.message})`);
    clearCheckpointDraft();
  }
}

async function onSubmitIncident() {
  if (!state.activeShift || !state.guard) return;
  const selectedItem = getSelectedPlanItem();
  if (!selectedItem) {
    setText(el.incidentStatus, "à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸à¸ˆà¸¸à¸”à¸•à¸£à¸§à¸ˆà¸à¹ˆà¸­à¸™");
    return;
  }

  const qrText = (state.scannedQr || "").trim();
  if (!qrText) {
    setText(el.incidentStatus, "à¸à¸£à¸¸à¸“à¸²à¸ªà¹à¸à¸™ QR à¸à¹ˆà¸­à¸™");
    return;
  }
  if (!state.gps) {
    setText(el.incidentStatus, "à¸à¸£à¸¸à¸“à¸²à¹‚à¸«à¸¥à¸” GPS à¸à¹ˆà¸­à¸™");
    return;
  }
  if (!state.checkpointPhoto) {
    setText(el.incidentStatus, "à¸à¸£à¸¸à¸“à¸²à¸–à¹ˆà¸²à¸¢à¸£à¸¹à¸›à¸à¹ˆà¸­à¸™");
    return;
  }

  const hasAbnormal = state.incidentMode === "HAS";
  const detail = (el.incidentDetail ? el.incidentDetail.value : "").trim();
  if (hasAbnormal && !detail) {
    setText(el.incidentStatus, "à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”");
    return;
  }

  const checkpointPayload = {
    shift_id: state.activeShift.shift_id,
    guard_id: state.guard.guard_id,
    qr_text_scanned: qrText,
    gps_lat: state.gps.lat,
    gps_lng: state.gps.lng,
    photo_url: state.checkpointPhoto,
    remark: hasAbnormal ? `[à¸¡à¸µà¹€à¸«à¸•à¸¸] ${detail}` : "à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸«à¸•à¸¸à¸œà¸´à¸”à¸›à¸à¸•à¸´"
  };

  try {
    setText(el.incidentStatus, "à¸à¸³à¸¥à¸±à¸‡à¸šà¸±à¸™à¸—à¸¶à¸à¸ˆà¸¸à¸”à¸•à¸£à¸§à¸ˆ...");
    const checkpointRes = await callApi("submitCheckpoint", { payload: checkpointPayload });
    await showCheckpointResultSwal(checkpointRes, selectedItem);

    if (hasAbnormal) {
      const incidentPayload = {
        shift_id: state.activeShift.shift_id,
        guard_id: state.guard.guard_id,
        type: "ABNORMAL",
        detail,
        photo_url: state.checkpointPhoto,
        severity: "MEDIUM"
      };
      const incidentRes = await callApi("submitIncident", { payload: incidentPayload });
      setText(el.incidentStatus, `à¸šà¸±à¸™à¸—à¸¶à¸à¸ªà¸³à¹€à¸£à¹‡à¸ˆ à¹à¸¥à¸°à¹à¸ˆà¹‰à¸‡à¹€à¸«à¸•à¸¸à¹à¸¥à¹‰à¸§ (${incidentRes.incident_id})`);
    } else {
      setText(el.incidentStatus, `à¸šà¸±à¸™à¸—à¸¶à¸à¸ªà¸³à¹€à¸£à¹‡à¸ˆ (${checkpointRes.status || "OK"})`);
    }

    if (checkpointRes && checkpointRes.checkpoint_id) {
      const key = String(checkpointRes.checkpoint_id);
      const valid = String(checkpointRes.status || "") === "ONTIME" || String(checkpointRes.status || "") === "LATE";
      if (valid) {
        state.doneCheckpointCounter[key] = Number(state.doneCheckpointCounter[key] || 0) + 1;
      }
      moveToNextRoundIfCurrentDone();
    }

    state.selectedPlanKey = "";
    renderCheckpointList();
    refreshStats();
    invalidateGuardSummaryCache();
    if (isDashboardVisible()) await loadGuardDashboardSummary(true);
    clearIncidentDraft();
    clearCheckpointDraft();
  } catch (err) {
    enqueueAction("submitCheckpoint", { payload: checkpointPayload });
    if (hasAbnormal) {
      enqueueAction("submitIncident", {
        payload: {
          shift_id: state.activeShift.shift_id,
          guard_id: state.guard.guard_id,
          type: "ABNORMAL",
          detail,
          photo_url: state.checkpointPhoto,
          severity: "MEDIUM"
        }
      });
    }
    setText(el.incidentStatus, `à¸ªà¹ˆà¸‡à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: à¸šà¸±à¸™à¸—à¸¶à¸à¸„à¸´à¸§à¸­à¸­à¸Ÿà¹„à¸¥à¸™à¹Œà¹à¸¥à¹‰à¸§ (${err.message})`);
    clearIncidentDraft();
    clearCheckpointDraft();
  }
}


async function refreshShiftPlan() {
  if (!state.guard) return;

  const date = toYmd(new Date());
  const activeShiftId = state.activeShift ? state.activeShift.shift_id : loadSession().activeShiftId;
  await loadGuardBootstrap(state.guard.guard_id, date);
  invalidateGuardSummaryCache();
  renderShiftList();
  renderDashboard();
  await openAssignedRouteOrFallback(activeShiftId);
}

async function loadGuardBootstrap(guardId, date) {
  const gid = String(guardId || "").trim();
  if (!gid || !date) return [];

  const data = await callApi("guardBootstrap", { guardId: gid, date });
  state.guard = data && data.guard ? data.guard : null;
  state.shifts = Array.isArray(data && data.shifts) ? data.shifts : [];
  state.shiftProgressMap = data && data.progress_by_shift ? data.progress_by_shift : {};
  state.checkpointQrMap = data && data.checkpoint_qr_map ? data.checkpoint_qr_map : {};
  if (state.guard) setGuardHeader(state.guard);
  return state.shifts;
}

async function syncQueue(showMessage) {
  if (state.syncing || !state.queue.length) {
    refreshQueueBanner();
    return;
  }

  if (!navigator.onLine) {
    refreshQueueBanner();
    return;
  }

  state.syncing = true;
  let success = 0;
  const rest = [];

  for (const item of state.queue) {
    try {
      await callApi(item.action, item.payload);
      success += 1;
    } catch (_) {
      rest.push(item);
    }
  }

  state.queue = rest;
  saveQueue(state.queue);

  state.lastSync = fmtDateTimeLocal(new Date());
  saveSyncMeta({ lastSync: state.lastSync });

  state.syncing = false;
  refreshQueueBanner();
  renderDashboard();

  if (state.guard) {
    try {
      await refreshShiftPlan();
    } catch (_) {
      // ignore
    }
  }

  if (showMessage && success > 0) {
    await showSwalMessage("success", "à¸‹à¸´à¸‡à¸à¹Œà¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¸³à¹€à¸£à¹‡à¸ˆ", `à¸ªà¹ˆà¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¸³à¹€à¸£à¹‡à¸ˆ ${success} à¸£à¸²à¸¢à¸à¸²à¸£`);
  }
}

function enqueueAction(action, payload) {
  state.queue.push({
    id: makeId(),
    action,
    payload,
    createdAt: new Date().toISOString()
  });

  saveQueue(state.queue);
  refreshQueueBanner();
  renderDashboard();
}

async function callApi(action, payload = {}) {
  startLoading();
  let response;

  try {
    const body = JSON.stringify({ action, ...payload });
    response = await fetch(API_URL, {
      method: "POST",
      body
    });
  } catch (err) {
    stopLoading();
    throw new Error(`à¹€à¸„à¸£à¸·à¸­à¸‚à¹ˆà¸²à¸¢à¸¡à¸µà¸›à¸±à¸à¸«à¸²: ${err.message}`);
  }

  try {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const json = JSON.parse(text);
    if (!json.ok) {
      throw new Error(json.error || "API à¸œà¸´à¸”à¸žà¸¥à¸²à¸”");
    }

    return json.data;
  } finally {
    stopLoading();
  }
}


function stopQrScanner() {
  if (!state.scanner) return;

  state.scanner.stop().catch(() => {}).finally(() => {
    state.scanner.clear();
    state.scanner = null;
  });
}

function switchView(name) {
  ["shifts", "tour", "dashboard"].forEach((v) => {
    if (el[`view-${v}`]) {
      el[`view-${v}`].classList.toggle("active", v === name);
    }
  });
  if (el.appRoot) {
    el.appRoot.classList.toggle("login-mode", false);
  }

  if (name !== "tour") {
    stopQrScanner();
  }

  setNavActive(name);
}

function setNavActive(view) {
  if (!el.bottomNav || el.bottomNav.classList.contains("hidden")) return;

  const map = {
    tour: "navTour",
    dashboard: "navDashboard"
  };

  ["navTour", "navDashboard"].forEach((id) => {
    el[id].classList.toggle("active", id === map[view]);
  });

  el.navTour.disabled = !state.activeShift;
}

function clearCheckpointDraft() {
  state.scannedQr = "";
  state.gps = null;
  state.checkpointPhoto = "";

  if (el.manualQr) el.manualQr.value = "";
  setText(el.gpsText, "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹‚à¸«à¸¥à¸” GPS");
  if (el.checkpointRemark) el.checkpointRemark.value = "";
  el.photoInput.value = "";
  el.photoPreview.classList.add("hidden");
  updateActionCardsState();
}

function clearIncidentDraft() {
  state.incidentPhoto = "";
  state.incidentMode = "NONE";
  if (el.incidentType) el.incidentType.value = "";
  if (el.incidentDetail) el.incidentDetail.value = "";
  if (el.incidentPhotoInput) el.incidentPhotoInput.value = "";
  if (el.incidentPhotoPreview) el.incidentPhotoPreview.classList.add("hidden");
  setIncidentMode("NONE");
}

