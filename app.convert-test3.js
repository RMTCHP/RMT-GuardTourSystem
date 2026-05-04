const API_URL = "https://script.google.com/macros/s/AKfycbxtsnZc-dktCAdYEsMgsnldQ85v2SSWXy4XY4dhPKN4ckgo2wskfd6GlLDWCKHyTEQ/exec";

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
  checkinPassed: false,
  checkpointPhoto: "",
  incidentPhoto: "",
  incidentMode: "NONE",
  checkpointQrMap: {},
  checkpointMetaMap: {},
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
    console.warn("à¸­à¸¸ï¿½â€ºà¸à¸£ï¿½â€œï¿½Å’à¸­à¸­ï¿½Å¸ï¿½â€žà¸¥ï¿½â„¢ï¿½Å’: ï¿½Å¡à¸±ï¿½â„¢ï¿½â€”à¸¶à¸ï¿½â€žà¸´à¸§ï¿½â€žà¸§ï¿½â€°à¸ï¿½Ë†à¸­ï¿½â„¢ à¹à¸¥ï¿½â€°à¸§ï¿½â€¹à¸´ï¿½â€¡à¸ï¿½Å’à¸ à¸²à¸¢à¸«à¸¥à¸±ï¿½â€¡ï¿½â€žï¿½â€ï¿½â€°");
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
    "actionQrCard", "actionGpsCard", "actionIncidentCard",
    "gpsBtn", "gpsText",
    "checkpointRemark", "submitCheckpointBtn", "checkpointStatus",
    "currentPointText", "checkinActionPanel", "checkpointListPanel", "backToCheckpointListBtn", "quickActionCards",
    "detailGpsPhoto", "detailSubmit", "detailIncident",
    "submitStepStatus",
    "roundTabs", "checkpointList", "incidentDetail",
    "incidentChoiceNone", "incidentChoiceHas", "incidentExtraFields",
    "incidentPhotoBtn", "incidentPhotoInput", "incidentPhotoPreview",
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
  if (el.actionGpsCard) el.actionGpsCard.addEventListener("click", onCheckinCard);
  if (el.actionIncidentCard) el.actionIncidentCard.addEventListener("click", () => openActionDetail("incident"));
  if (el.incidentChoiceNone) el.incidentChoiceNone.addEventListener("click", () => setIncidentMode("NONE"));
  if (el.incidentChoiceHas) el.incidentChoiceHas.addEventListener("click", () => setIncidentMode("HAS"));
  el.submitIncidentBtn.addEventListener("click", onSubmitIncident);
  if (el.incidentPhotoBtn && el.incidentPhotoInput) {
    el.incidentPhotoBtn.addEventListener("click", () => {
      el.incidentPhotoInput.value = "";
      el.incidentPhotoInput.click();
    });
  }
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

  if (el.incidentPhotoInput) {
    el.incidentPhotoInput.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!state.gps) {
        try {
          await captureGps();
        } catch (_) {}
      }
      state.incidentPhoto = await fileToDataUrlWithWatermark(file, 1280, 0.8, {
        timestamp: new Date(),
        lat: state.gps ? state.gps.lat : null,
        lng: state.gps ? state.gps.lng : null
      });
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
    await showSwalMessage("error", "ï¿½â‚¬ï¿½â€šï¿½â€°à¸²à¸ªà¸¹ï¿½Ë†à¸£à¸°ï¿½Å¡ï¿½Å¡ï¿½â€žà¸¡ï¿½Ë†à¸ªà¸³ï¿½â‚¬à¸£ï¿½â€¡ï¿½Ë†", `à¸à¸¹ï¿½â€°ï¿½â€žà¸·ï¿½â„¢ï¿½â‚¬ï¿½â€¹à¸ªï¿½Å à¸±ï¿½â„¢ï¿½â€žà¸¡ï¿½Ë†à¸ªà¸³ï¿½â‚¬à¸£ï¿½â€¡ï¿½Ë†: ${err.message}`);
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

  const guardName = guard.name || "ï¿½â‚¬ï¿½Ë†ï¿½â€°à¸²à¸«ï¿½â„¢ï¿½â€°à¸²ï¿½â€”à¸µï¿½Ë†";
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
    shift.profile_name || shift.template_name || shift.shift_name || "ï¿½â€žà¸¡ï¿½Ë†à¸£à¸°ï¿½Å¡à¸¸"
  ).trim();
}

function displayShiftStatus(status) {
  const code = String(status || "OPEN").toUpperCase();
  if (code === "CLOSED") return "ï¿½â€ºà¸´ï¿½â€à¸à¸°à¹à¸¥ï¿½â€°à¸§";
  return "à¸à¸³à¸¥à¸±ï¿½â€¡ï¿½â€¢à¸£à¸§ï¿½Ë†";
}

function renderShiftList() {
  const rows = state.shifts || [];

  if (!rows.length) {
    el.shiftList.innerHTML = '<div class="shift-card">ï¿½â€žà¸¡ï¿½Ë†ï¿½Å¾ï¿½Å¡à¸à¸°ï¿½â€¡à¸²ï¿½â„¢ï¿½â€”à¸µï¿½Ë†ï¿½Å“à¸¹à¸à¸à¸±ï¿½Å¡à¸£à¸«à¸±à¸ªï¿½â„¢à¸µï¿½â€° à¸à¸£à¸¸ï¿½â€œà¸²ï¿½â€¢à¸£à¸§ï¿½Ë†à¸ªà¸­ï¿½Å¡ Template ï¿½Æ’ï¿½â„¢à¸«ï¿½â„¢ï¿½â€°à¸² Admin</div>';
    return;
  }

  el.shiftList.innerHTML = rows.map((s) => {
    const status = String(s.status || "OPEN").toUpperCase();
    const statusClass = status === "CLOSED" ? "badge badge-closed" : "badge badge-open";

    return `
      <div class="shift-card">
        <h4>${escapeHtml(getShiftProfile(s))}</h4>
        <p class="meta">ï¿½â‚¬à¸§à¸¥à¸² ${escapeHtml(s.start_time || "-")} - ${escapeHtml(s.end_time || "-")}</p>
        <p class="meta">à¸£à¸«à¸±à¸ªà¸à¸°: ${escapeHtml(s.shift_id || "")}</p>
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
  state.checkinPassed = false;
  state.checkpointPhoto = "";
  state.incidentPhoto = "";
  state.incidentMode = "NONE";

  if (el.manualQr) el.manualQr.value = "";
  if (el.incidentPhotoInput) el.incidentPhotoInput.value = "";
  if (el.incidentPhotoPreview) el.incidentPhotoPreview.classList.add("hidden");

  setText(el.gpsText, "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹‚à¸«à¸¥à¸” GPS");
  setText(el.checkpointStatus, "");
  setText(el.incidentStatus, "");
  setText(el.submitStepStatus, "à¸£à¸­à¸à¸²à¸£à¸¢à¸·ï¿½â„¢à¸¢à¸±ï¿½â„¢");
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
    setText(el.currentPointText, "ï¿½â‚¬à¸¥à¸·à¸­à¸ï¿½Ë†à¸¸ï¿½â€ï¿½â€¢à¸£à¸§ï¿½Ë†ï¿½Ë†à¸²à¸à¸£à¸²à¸¢à¸à¸²à¸£ï¿½â€ï¿½â€°à¸²ï¿½â„¢à¸¥ï¿½Ë†à¸²ï¿½â€¡à¸ï¿½Ë†à¸­ï¿½â„¢");
    if (el.checkinActionPanel) el.checkinActionPanel.classList.add("hidden");
    if (el.checkpointListPanel) el.checkpointListPanel.classList.remove("hidden");
    stopQrScanner();
    el.checkpointList.innerHTML = '<div class="checkpoint-card">ï¿½â€žà¸¡ï¿½Ë†ï¿½Å¾ï¿½Å¡ï¿½Ë†à¸¸ï¿½â€ï¿½â€¢à¸£à¸§ï¿½Ë†ï¿½Æ’ï¿½â„¢à¸£à¸­ï¿½Å¡ï¿½â„¢à¸µï¿½â€°</div>';
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
  if (el.dbRoundProgress) el.dbRoundProgress.textContent = `${roundsDone}/${roundsTotal} à¸£à¸­ï¿½Å¡`;
  if (el.dbCheckedTotal) el.dbCheckedTotal.textContent = String(checkedTotal);
  if (el.dbIncidentTotal) el.dbIncidentTotal.textContent = String(incidentTotal);

  if (!state.shifts.length) {
    el.dashboardList.innerHTML = `
      <div class="dashboard-card dashboard-empty">
        <h4>à¸¢à¸±ï¿½â€¡ï¿½â€žà¸¡ï¿½Ë†à¸¡à¸µà¸à¸°ï¿½â€¡à¸²ï¿½â„¢à¸ªà¸³à¸«à¸£à¸±ï¿½Å¡à¸§à¸±ï¿½â„¢ï¿½â„¢à¸µï¿½â€°</h4>
        <p class="meta">à¸à¸£à¸¸ï¿½â€œà¸²ï¿½â€¢à¸£à¸§ï¿½Ë†à¸ªà¸­ï¿½Å¡à¸à¸²à¸£ï¿½Å“à¸¹à¸ Template à¸à¸±ï¿½Å¡à¸£à¸«à¸±à¸ª à¸£ï¿½â€ºà¸  ï¿½Æ’ï¿½â„¢à¸«ï¿½â„¢ï¿½â€°à¸² Admin</p>
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
          <p class="meta dashboard-time">ï¿½â‚¬à¸§à¸¥à¸² ${escapeHtml(s.start_time || "-")} - ${escapeHtml(s.end_time || "-")}</p>

          <div class="dashboard-progress-wrap">
            <div class="dashboard-progress-head"><span>ï¿½â€žà¸§à¸²à¸¡ï¿½â€žà¸·ï¿½Å¡à¸«ï¿½â„¢ï¿½â€°à¸²à¸£à¸­ï¿½Å¡</span><strong>0/${roundsTotal}</strong></div>
            <div class="dashboard-progress-bar"><i style="width:${roundPct}%"></i></div>
          </div>
          <div class="dashboard-progress-wrap">
            <div class="dashboard-progress-head"><span>ï¿½Ë†à¸¸ï¿½â€ï¿½â€”à¸µï¿½Ë†ï¿½â€¢à¸£à¸§ï¿½Ë†à¹à¸¥ï¿½â€°à¸§</span><strong>0/${checkpointCount}</strong></div>
            <div class="dashboard-progress-bar"><i style="width:${checkPct}%"></i></div>
          </div>

          <div class="dashboard-mini-grid">
            <div class="dashboard-mini-card mini-incident">
              <i class="material-symbols-outlined mini-icon" aria-hidden="true">notification_important</i>
              <span>ï¿½â‚¬à¸«ï¿½â€¢à¸¸ï¿½Å“à¸´ï¿½â€ï¿½â€ºà¸ï¿½â€¢à¸´</span><strong>0</strong>
            </div>
            <div class="dashboard-mini-card mini-late">
              <i class="material-symbols-outlined mini-icon" aria-hidden="true">schedule</i>
              <span>ï¿½Å ï¿½â€°à¸²</span><strong>0</strong>
            </div>
            <div class="dashboard-mini-card mini-error">
              <i class="material-symbols-outlined mini-icon" aria-hidden="true">gpp_bad</i>
              <span>ï¿½â€žà¸¡ï¿½Ë†ï¿½Å“ï¿½Ë†à¸²ï¿½â„¢</span><strong>0</strong>
            </div>
          </div>
        </div>
      `;
    }).join("");
    return;
  }

  el.dashboardList.innerHTML = rows.map((row) => {
    const statusClass = row.done ? "badge badge-closed" : "badge badge-open";
    const statusText = row.done ? "ï¿½â‚¬à¸ªà¸£ï¿½â€¡ï¿½Ë†à¸ªà¸´ï¿½â€°ï¿½â„¢" : "à¸à¸³à¸¥à¸±ï¿½â€¡ï¿½â€à¸³ï¿½â‚¬ï¿½â„¢à¸´ï¿½â„¢à¸à¸²à¸£";
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
          <p class="meta dashboard-time">ï¿½â‚¬à¸§à¸¥à¸² ${escapeHtml(row.start)} - ${escapeHtml(row.end)}</p>
          <span class="${statusClass}">${statusText}</span>
        </div>

        <div class="dashboard-progress-wrap">
          <div class="dashboard-progress-head"><span>ï¿½â€žà¸§à¸²à¸¡ï¿½â€žà¸·ï¿½Å¡à¸«ï¿½â„¢ï¿½â€°à¸²à¸£à¸­ï¿½Å¡</span><strong>${row.rounds_done}/${row.rounds_total}</strong></div>
          <div class="dashboard-progress-bar"><i style="width:${roundPct}%"></i></div>
        </div>
        <div class="dashboard-progress-wrap">
          <div class="dashboard-progress-head"><span>ï¿½Ë†à¸¸ï¿½â€ï¿½â€”à¸µï¿½Ë†ï¿½â€¢à¸£à¸§ï¿½Ë†à¹à¸¥ï¿½â€°à¸§</span><strong>${row.checked}/${row.expected}</strong></div>
          <div class="dashboard-progress-bar"><i style="width:${checkPct}%"></i></div>
        </div>

        <div class="dashboard-mini-grid">
          <div class="dashboard-mini-card mini-incident">
            <i class="material-symbols-outlined mini-icon" aria-hidden="true">notification_important</i>
            <span>ï¿½â‚¬à¸«ï¿½â€¢à¸¸ï¿½Å“à¸´ï¿½â€ï¿½â€ºà¸ï¿½â€¢à¸´</span><strong>${row.incidents}</strong>
          </div>
          <div class="dashboard-mini-card mini-late">
            <i class="material-symbols-outlined mini-icon" aria-hidden="true">schedule</i>
            <span>ï¿½Å ï¿½â€°à¸²</span><strong>${row.late}</strong>
          </div>
          <div class="dashboard-mini-card mini-error">
            <i class="material-symbols-outlined mini-icon" aria-hidden="true">gpp_bad</i>
            <span>ï¿½â€žà¸¡ï¿½Ë†ï¿½Å“ï¿½Ë†à¸²ï¿½â„¢</span><strong>${row.invalid}</strong>
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

async function onCheckinCard() {
  const selectedItem = getSelectedPlanItem();
  if (!selectedItem) {
    setText(el.checkpointStatus, "à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸à¸ˆà¸¸à¸”à¸•à¸£à¸§à¸ˆà¸à¹ˆà¸­à¸™");
    return;
  }
  if (!state.scannedQr) {
    if (window.Swal) await Swal.fire({ icon: "warning", title: "à¸à¸£à¸¸à¸“à¸²à¸ªà¹à¸à¸™ QR à¸à¹ˆà¸­à¸™", confirmButtonText: "à¸•à¸à¸¥à¸‡" });
    return;
  }

  try {
    await captureGps();
    const check = validateGpsForSelectedCheckpoint(selectedItem, state.gps);
    if (!check.ok) {
      state.checkinPassed = false;
      updateActionCardsState();
      if (window.Swal) {
        await Swal.fire({
          icon: "error",
          title: "à¸„à¸¸à¸“à¸­à¸¢à¸¹à¹ˆà¸™à¸­à¸à¸žà¸·à¹‰à¸™à¸—à¸µà¹ˆà¸ˆà¸¸à¸”à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸š",
          text: check.message || "à¸à¸£à¸¸à¸“à¸²à¸­à¸¢à¸¹à¹ˆà¹ƒà¸™à¸£à¸±à¸¨à¸¡à¸µà¸ˆà¸¸à¸”à¸•à¸£à¸§à¸ˆà¹à¸¥à¹‰à¸§à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆà¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡",
          confirmButtonText: "à¸•à¸à¸¥à¸‡"
        });
      }
      setText(el.gpsText, `à¸™à¸­à¸à¸žà¸·à¹‰à¸™à¸—à¸µà¹ˆ (${check.distanceM} à¸¡.)`);
      return;
    }
    state.checkinPassed = true;
    setText(el.gpsText, `à¸œà¹ˆà¸²à¸™à¸à¸²à¸£ Check in (${check.distanceM} à¸¡.)`);
    updateActionCardsState();
    if (window.Swal) {
      await Swal.fire({
        icon: "success",
        title: "Check in à¸ªà¸³à¹€à¸£à¹‡à¸ˆ",
        text: "à¸­à¸¢à¸¹à¹ˆà¹ƒà¸™à¸žà¸·à¹‰à¸™à¸—à¸µà¹ˆà¸ˆà¸¸à¸”à¸•à¸£à¸§à¸ˆà¹à¸¥à¹‰à¸§",
        timer: 1400,
        showConfirmButton: false
      });
    }
  } catch (err) {
    state.checkinPassed = false;
    updateActionCardsState();
    if (window.Swal) {
      await Swal.fire({
        icon: "error",
        title: "à¹‚à¸«à¸¥à¸”à¸•à¸³à¹à¸«à¸™à¹ˆà¸‡à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ",
        text: err.message || "à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆ",
        confirmButtonText: "à¸•à¸à¸¥à¸‡"
      });
    }
  }
}

function captureGps() {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("à¸­à¸¸ï¿½â€ºà¸à¸£ï¿½â€œï¿½Å’ï¿½â€žà¸¡ï¿½Ë†à¸£à¸­ï¿½â€¡à¸£à¸±ï¿½Å¡ GPS"));
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
    setText(el.checkpointStatus, "à¸à¸£à¸¸ï¿½â€œà¸²ï¿½â‚¬à¸¥à¸·à¸­à¸ï¿½Ë†à¸¸ï¿½â€ï¿½â€¢à¸£à¸§ï¿½Ë†ï¿½Ë†à¸²à¸à¸£à¸²à¸¢à¸à¸²à¸£à¸ï¿½Ë†à¸­ï¿½â„¢à¸ªï¿½Ë†ï¿½â€¡");
    return;
  }

  const qrText = (state.scannedQr || "").trim();
  if (!qrText) {
    setText(el.checkpointStatus, "à¸à¸£à¸¸ï¿½â€œà¸²à¸ï¿½â€ Card 1 ï¿½â‚¬ï¿½Å¾à¸·ï¿½Ë†à¸­à¸ªà¹à¸ï¿½â„¢ QR à¸ï¿½Ë†à¸­ï¿½â„¢");
    return;
  }

  if (!state.gps) {
    setText(el.checkpointStatus, "à¸à¸£à¸¸ï¿½â€œà¸²ï¿½â€šà¸«à¸¥ï¿½â€ GPS à¸ï¿½Ë†à¸­ï¿½â„¢à¸ªï¿½Ë†ï¿½â€¡");
    return;
  }

  if (!state.checkpointPhoto) {
    setText(el.checkpointStatus, "à¸à¸£à¸¸ï¿½â€œà¸²à¹ï¿½â„¢ï¿½Å¡à¸£à¸¹ï¿½â€ºï¿½â€“ï¿½Ë†à¸²à¸¢à¸ï¿½Ë†à¸­ï¿½â„¢à¸ªï¿½Ë†ï¿½â€¡");
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
    setText(el.checkpointStatus, "à¸à¸³à¸¥à¸±ï¿½â€¡à¸ªï¿½Ë†ï¿½â€¡ï¿½â€šï¿½â€°à¸­à¸¡à¸¹à¸¥...");
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
        setText(el.checkpointStatus, "ï¿½Å¡à¸±ï¿½â„¢ï¿½â€”à¸¶à¸à¹à¸¥ï¿½â€°à¸§ à¹ï¿½â€¢ï¿½Ë†ï¿½Ë†à¸¸ï¿½â€ï¿½â€”à¸µï¿½Ë†à¸ªà¹à¸ï¿½â„¢ï¿½â€žà¸¡ï¿½Ë†ï¿½â€¢à¸£ï¿½â€¡à¸à¸±ï¿½Å¡ï¿½Ë†à¸¸ï¿½â€ï¿½â€”à¸µï¿½Ë†ï¿½â‚¬à¸¥à¸·à¸­à¸");
      } else {
        setText(el.checkpointStatus, `à¸ªï¿½Ë†ï¿½â€¡ï¿½â€šï¿½â€°à¸­à¸¡à¸¹à¸¥à¸ªà¸³ï¿½â‚¬à¸£ï¿½â€¡ï¿½Ë† (${res.status})`);
      }
    } else {
      setText(el.checkpointStatus, `à¸ªï¿½Ë†ï¿½â€¡ï¿½â€šï¿½â€°à¸­à¸¡à¸¹à¸¥à¸ªà¸³ï¿½â‚¬à¸£ï¿½â€¡ï¿½Ë† (${res.status})`);
      invalidateGuardSummaryCache();
      if (isDashboardVisible()) await loadGuardDashboardSummary(true);
    }
    clearCheckpointDraft();
  } catch (err) {
    enqueueAction("submitCheckpoint", { payload });
    setText(el.checkpointStatus, `à¸ªï¿½Ë†ï¿½â€¡ï¿½â€žà¸¡ï¿½Ë†à¸ªà¸³ï¿½â‚¬à¸£ï¿½â€¡ï¿½Ë†: ï¿½Å¡à¸±ï¿½â„¢ï¿½â€”à¸¶à¸ï¿½â€žà¸´à¸§à¸­à¸­ï¿½Å¸ï¿½â€žà¸¥ï¿½â„¢ï¿½Å’à¹à¸¥ï¿½â€°à¸§ (${err.message})`);
    clearCheckpointDraft();
  }
}

async function onSubmitIncident() {
  if (!state.activeShift || !state.guard) return;
  const selectedItem = getSelectedPlanItem();
  if (!selectedItem) {
    setText(el.incidentStatus, "à¸à¸£à¸¸ï¿½â€œà¸²ï¿½â‚¬à¸¥à¸·à¸­à¸ï¿½Ë†à¸¸ï¿½â€ï¿½â€¢à¸£à¸§ï¿½Ë†à¸ï¿½Ë†à¸­ï¿½â„¢");
    return;
  }

  const qrText = (state.scannedQr || "").trim();
  if (!qrText) {
    setText(el.incidentStatus, "à¸à¸£à¸¸ï¿½â€œà¸²à¸ªà¹à¸ï¿½â„¢ QR à¸ï¿½Ë†à¸­ï¿½â„¢");
    return;
  }
  if (!state.gps) {
    setText(el.incidentStatus, "à¸à¸£à¸¸à¸“à¸² Check in à¸à¹ˆà¸­à¸™");
    return;
  }
  if (!state.checkinPassed) {
    setText(el.incidentStatus, "à¸à¸£à¸¸à¸“à¸² Check in à¹ƒà¸«à¹‰à¸œà¹ˆà¸²à¸™à¸à¹ˆà¸­à¸™");
    return;
  }

  const hasAbnormal = state.incidentMode === "HAS";
  const detail = (el.incidentDetail ? el.incidentDetail.value : "").trim();
  if (hasAbnormal && !detail) {
    setText(el.incidentStatus, "à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”");
    return;
  }
  if (hasAbnormal && !state.incidentPhoto) {
    setText(el.incidentStatus, "à¸à¸£à¸¸à¸“à¸²à¸–à¹ˆà¸²à¸¢à¸ à¸²à¸žà¹€à¸«à¸•à¸¸à¸œà¸´à¸”à¸›à¸à¸•à¸´");
    return;
  }

  const checkpointPhoto = state.incidentPhoto || createCheckinProofImage_(state.gps);

  const checkpointPayload = {
    shift_id: state.activeShift.shift_id,
    guard_id: state.guard.guard_id,
    qr_text_scanned: qrText,
    gps_lat: state.gps.lat,
    gps_lng: state.gps.lng,
    photo_url: checkpointPhoto,
    remark: hasAbnormal ? `[à¸¡à¸µï¿½â‚¬à¸«ï¿½â€¢à¸¸] ${detail}` : "ï¿½â€žà¸¡ï¿½Ë†à¸¡à¸µï¿½â‚¬à¸«ï¿½â€¢à¸¸ï¿½Å“à¸´ï¿½â€ï¿½â€ºà¸ï¿½â€¢à¸´"
  };

  try {
    setText(el.incidentStatus, "à¸à¸³à¸¥à¸±ï¿½â€¡ï¿½Å¡à¸±ï¿½â„¢ï¿½â€”à¸¶à¸ï¿½Ë†à¸¸ï¿½â€ï¿½â€¢à¸£à¸§ï¿½Ë†...");
    const checkpointRes = await callApi("submitCheckpoint", { payload: checkpointPayload });
    await showCheckpointResultSwal(checkpointRes, selectedItem);

    if (hasAbnormal) {
      const incidentPayload = {
        shift_id: state.activeShift.shift_id,
        guard_id: state.guard.guard_id,
        type: "ABNORMAL",
        detail,
        photo_url: state.incidentPhoto || checkpointPhoto,
        severity: "MEDIUM"
      };
      const incidentRes = await callApi("submitIncident", { payload: incidentPayload });
      setText(el.incidentStatus, `ï¿½Å¡à¸±ï¿½â„¢ï¿½â€”à¸¶à¸à¸ªà¸³ï¿½â‚¬à¸£ï¿½â€¡ï¿½Ë† à¹à¸¥à¸°à¹ï¿½Ë†ï¿½â€°ï¿½â€¡ï¿½â‚¬à¸«ï¿½â€¢à¸¸à¹à¸¥ï¿½â€°à¸§ (${incidentRes.incident_id})`);
    } else {
      setText(el.incidentStatus, `ï¿½Å¡à¸±ï¿½â„¢ï¿½â€”à¸¶à¸à¸ªà¸³ï¿½â‚¬à¸£ï¿½â€¡ï¿½Ë† (${checkpointRes.status || "OK"})`);
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
          photo_url: state.incidentPhoto || checkpointPhoto,
          severity: "MEDIUM"
        }
      });
    }
    setText(el.incidentStatus, `à¸ªï¿½Ë†ï¿½â€¡ï¿½â€žà¸¡ï¿½Ë†à¸ªà¸³ï¿½â‚¬à¸£ï¿½â€¡ï¿½Ë†: ï¿½Å¡à¸±ï¿½â„¢ï¿½â€”à¸¶à¸ï¿½â€žà¸´à¸§à¸­à¸­ï¿½Å¸ï¿½â€žà¸¥ï¿½â„¢ï¿½Å’à¹à¸¥ï¿½â€°à¸§ (${err.message})`);
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
  let checkpointRows = [];
  try {
    checkpointRows = await callApi("listCheckpoints", {});
  } catch (_) {
    checkpointRows = [];
  }
  state.guard = data && data.guard ? data.guard : null;
  state.shifts = Array.isArray(data && data.shifts) ? data.shifts : [];
  state.shiftProgressMap = data && data.progress_by_shift ? data.progress_by_shift : {};
  state.checkpointQrMap = data && data.checkpoint_qr_map ? data.checkpoint_qr_map : {};
  state.checkpointMetaMap = buildCheckpointMetaMap(checkpointRows, state.shifts);
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
    await showSwalMessage("success", "ï¿½â€¹à¸´ï¿½â€¡à¸ï¿½Å’ï¿½â€šï¿½â€°à¸­à¸¡à¸¹à¸¥à¸ªà¸³ï¿½â‚¬à¸£ï¿½â€¡ï¿½Ë†", `à¸ªï¿½Ë†ï¿½â€¡ï¿½â€šï¿½â€°à¸­à¸¡à¸¹à¸¥à¸ªà¸³ï¿½â‚¬à¸£ï¿½â€¡ï¿½Ë† ${success} à¸£à¸²à¸¢à¸à¸²à¸£`);
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
    throw new Error(`ï¿½â‚¬ï¿½â€žà¸£à¸·à¸­ï¿½â€šï¿½Ë†à¸²à¸¢à¸¡à¸µï¿½â€ºà¸±à¸à¸«à¸²: ${err.message}`);
  }

  try {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const json = JSON.parse(text);
    if (!json.ok) {
      throw new Error(json.error || "API ï¿½Å“à¸´ï¿½â€ï¿½Å¾à¸¥à¸²ï¿½â€");
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
  state.checkinPassed = false;
  state.checkpointPhoto = "";

  if (el.manualQr) el.manualQr.value = "";
  setText(el.gpsText, "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹‚à¸«à¸¥à¸” GPS");
  if (el.checkpointRemark) el.checkpointRemark.value = "";
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

function buildCheckpointMetaMap(checkpointRows, shifts) {
  const map = {};
  (Array.isArray(checkpointRows) ? checkpointRows : []).forEach((cp) => {
    const id = String(cp.checkpoint_id || "").trim();
    if (!id) return;
    map[id] = {
      lat: Number(cp.lat),
      lng: Number(cp.lng),
      radius_m: Number(cp.radius_m || 50)
    };
  });
  (Array.isArray(shifts) ? shifts : []).forEach((shift) => {
    (Array.isArray(shift.checkpoints) ? shift.checkpoints : []).forEach((cp) => {
      const id = String(cp.checkpoint_id || "").trim();
      if (!id) return;
      if (!map[id]) map[id] = {};
      if (!Number.isFinite(map[id].lat)) map[id].lat = Number(cp.lat);
      if (!Number.isFinite(map[id].lng)) map[id].lng = Number(cp.lng);
      if (!Number.isFinite(map[id].radius_m)) map[id].radius_m = Number(cp.radius_m || 50);
    });
  });
  return map;
}

function validateGpsForSelectedCheckpoint(selectedItem, gps) {
  const cpId = String((selectedItem && selectedItem.checkpoint_id) || "").trim();
  const meta = state.checkpointMetaMap ? state.checkpointMetaMap[cpId] : null;
  if (!cpId || !meta || !Number.isFinite(meta.lat) || !Number.isFinite(meta.lng)) {
    return { ok: true, distanceM: 0, message: "" };
  }
  const distanceM = Math.round(haversineMeters_(gps.lat, gps.lng, meta.lat, meta.lng));
  const radius = Number(meta.radius_m || 50);
  if (distanceM > radius) {
    return { ok: false, distanceM, message: `à¸£à¸°à¸¢à¸° ${distanceM} à¹€à¸¡à¸•à¸£ (à¹€à¸à¸´à¸™à¸£à¸±à¸¨à¸¡à¸µ ${radius} à¹€à¸¡à¸•à¸£)` };
  }
  return { ok: true, distanceM, message: "" };
}

function haversineMeters_(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function createCheckinProofImage_(gps) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 500;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0f2f55";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.font = '700 48px "Public Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText("CHECK IN", 60, 120);
  ctx.font = '500 34px "Public Sans", "Noto Sans Thai", sans-serif';
  ctx.fillText(`à¸§à¸±à¸™à¸—à¸µà¹ˆ ${new Date().toLocaleString("th-TH", { hour12: false })}`, 60, 210);
  ctx.fillText(`Lat: ${Number(gps.lat).toFixed(6)}  Lng: ${Number(gps.lng).toFixed(6)}`, 60, 280);
  ctx.fillText(`à¸œà¸¹à¹‰à¸•à¸£à¸§à¸ˆ: ${state.guard ? (state.guard.name || state.guard.guard_id) : "-"}`, 60, 350);
  return canvas.toDataURL("image/jpeg", 0.85);
}




