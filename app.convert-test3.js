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
    console.warn("อุ�›กร�“�Œออ�Ÿ�„ล�™�Œ: �šั�™�—ึก�„ิว�„ว�‰ก�ˆอ�™ แล�‰ว�‹ิ�‡ก�Œภายหลั�‡�„�”�‰");
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
        setText(el.gpsText, "กำลั�‡�‚หล�”�•ำแห�™�ˆ�‡...");
        await captureGps();
        setText(el.gpsText, `Lat: ${state.gps.lat.toFixed(6)}, Lng: ${state.gps.lng.toFixed(6)}`);
      } catch (err) {
        setText(el.gpsText, `�‚หล�” GPS �„ม�ˆสำ�€ร�‡�ˆ: ${err.message}`);
      }
    }
    state.checkpointPhoto = await fileToDataUrlWithWatermark(file, 1280, 0.8, {
      timestamp: new Date(),
      lat: state.gps ? state.gps.lat : null,
      lng: state.gps ? state.gps.lng : null
    });
    el.photoPreview.src = state.checkpointPhoto;
    el.photoPreview.classList.remove("hidden");
    setText(el.checkpointStatus, "�–�ˆายรู�›สำ�€ร�‡�ˆ และ�›ระ�—ั�šลาย�™�‰ำแล�‰ว");
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
    await showSwalMessage("error", "�€�‚�‰าสู�ˆระ�š�š�„ม�ˆสำ�€ร�‡�ˆ", `กู�‰�„ื�™�€�‹ส�Šั�™�„ม�ˆสำ�€ร�‡�ˆ: ${err.message}`);
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

  const guardName = guard.name || "�€�ˆ�‰าห�™�‰า�—ี�ˆ";
  const initials = String(guardName).trim().slice(0, 1).toUpperCase() || "ร";

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
    shift.profile_name || shift.template_name || shift.shift_name || "�—ั�ˆว�„�›"
  ).trim();
}

function displayShiftStatus(status) {
  const code = String(status || "OPEN").toUpperCase();
  if (code === "CLOSED") return "�›ิ�”แล�‰ว";
  return "�€�›ิ�”อยู�ˆ";
}

function renderShiftList() {
  const rows = state.shifts || [];

  if (!rows.length) {
    el.shiftList.innerHTML = '<div class="shift-card">�„ม�ˆ�ž�š�€�—ม�€�žล�•�—ี�ˆ�œูกกั�šรหัส�™ี�‰ กรุ�“า�•รว�ˆสอ�š�ƒ�™ห�™�‰า Admin</div>';
    return;
  }

  el.shiftList.innerHTML = rows.map((s) => {
    const status = String(s.status || "OPEN").toUpperCase();
    const statusClass = status === "CLOSED" ? "badge badge-closed" : "badge badge-open";

    return `
      <div class="shift-card">
        <h4>${escapeHtml(getShiftProfile(s))}</h4>
        <p class="meta">�€วลา ${escapeHtml(s.start_time || "-")} - ${escapeHtml(s.end_time || "-")}</p>
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

  setText(el.gpsText, "ยั�‡�„ม�ˆ�‚หล�” GPS");
  setText(el.checkpointStatus, "");
  setText(el.incidentStatus, "");
  setText(el.qrStepStatus, "ยั�‡�„ม�ˆสแก�™ QR");
  setText(el.gpsStepStatus, "ยั�‡�„ม�ˆ�–�ˆาย");
  setText(el.submitStepStatus, "รอ�‚�‰อมูล�ƒห�‰�„ร�š");
  setText(el.incidentStepStatus, "รอ�‚�‰อมูล�ƒห�‰�„ร�š");
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
    setText(el.currentPointText, "�„ม�ˆ�ž�š�ˆุ�”�•รว�ˆ�ƒ�™รอ�š�™ี�‰");
    if (el.checkinActionPanel) el.checkinActionPanel.classList.add("hidden");
    if (el.checkpointListPanel) el.checkpointListPanel.classList.remove("hidden");
    stopQrScanner();
    el.checkpointList.innerHTML = '<div class="checkpoint-card">�„ม�ˆมี�ˆุ�”�•รว�ˆ�ƒ�™กะ�™ี�‰</div>';
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

  el.dbShiftTotal.textContent = String(total);
  el.dbRoundProgress.textContent = `${roundsDone}/${roundsTotal} รอบ`;
  el.dbCheckedTotal.textContent = String(checkedTotal);
  el.dbIncidentTotal.textContent = String(incidentTotal);

  if (!state.shifts.length) {
    el.dashboardList.innerHTML = '<div class="dashboard-card">ยังไม่มีกะงานวันนี้</div>';
    return;
  }

  if (!rows.length) {
    el.dashboardList.innerHTML = state.shifts.map((s) => {
      const checkpointCount = Array.isArray(s.checkpoints) ? s.checkpoints.length : 0;
      const status = String(s.status || "OPEN").toUpperCase();
      const statusClass = status === "CLOSED" ? "badge badge-closed" : "badge badge-open";

      return `
        <div class="dashboard-card">
          <h4>${escapeHtml(getShiftProfile(s))}</h4>
          <p class="meta">เวลา ${escapeHtml(s.start_time || "-")} - ${escapeHtml(s.end_time || "-")}</p>
          <p class="meta">รอบที่ทำแล้ว 0/${Number(s.rounds_required || 1)} รอบ</p>
          <p class="meta">จุดตรวจทั้งหมด ${checkpointCount}</p>
          <span class="${statusClass}">${displayShiftStatus(status)}</span>
        </div>
      `;
    }).join("");
    return;
  }

  el.dashboardList.innerHTML = rows.map((row) => {
    const statusClass = row.done ? "badge badge-closed" : "badge badge-open";
    const statusText = row.done ? "ครบแล้ว" : "ยังไม่ครบ";
    return `
      <div class="dashboard-card">
        <h4>${escapeHtml(row.name)}</h4>
        <p class="meta">เวลา ${escapeHtml(row.start)} - ${escapeHtml(row.end)}</p>
        <p class="meta">รอบที่ทำแล้ว ${row.rounds_done}/${row.rounds_total} รอบ</p>
        <p class="meta">ตรวจแล้ว ${row.checked}/${row.expected} จุด</p>
        <p class="meta">ช้า ${row.late} | ผิดพลาด ${row.invalid} | เหตุ ${row.incidents}</p>
        <span class="${statusClass}">${statusText}</span>
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
    setText(el.gpsText, `�‚หล�” GPS �„ม�ˆสำ�€ร�‡�ˆ: ${err.message}`);
  }
}

async function onCapturePhotoCard() {
  const selectedItem = getSelectedPlanItem();
  if (!selectedItem) {
    setText(el.checkpointStatus, "กรุ�“า�€ลือก�ˆุ�”�•รว�ˆก�ˆอ�™");
    return;
  }
  if (el.photoInput) {
    el.photoInput.value = "";
    el.photoInput.click();
  }
}

function captureGps() {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("อุ�›กร�“�Œ�„ม�ˆรอ�‡รั�š GPS"));
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
    setText(el.checkpointStatus, "กรุ�“า�€ลือก�ˆุ�”�•รว�ˆ�ˆากรายการก�ˆอ�™ส�ˆ�‡");
    return;
  }

  const qrText = (state.scannedQr || "").trim();
  if (!qrText) {
    setText(el.checkpointStatus, "กรุ�“าก�” Card 1 �€�žื�ˆอสแก�™ QR ก�ˆอ�™");
    return;
  }

  if (!state.gps) {
    setText(el.checkpointStatus, "กรุ�“า�‚หล�” GPS ก�ˆอ�™ส�ˆ�‡");
    return;
  }

  if (!state.checkpointPhoto) {
    setText(el.checkpointStatus, "กรุ�“าแ�™�šรู�›�–�ˆายก�ˆอ�™ส�ˆ�‡");
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
    setText(el.checkpointStatus, "กำลั�‡ส�ˆ�‡�‚�‰อมูล...");
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
        setText(el.checkpointStatus, "�šั�™�—ึกแล�‰ว แ�•�ˆ�ˆุ�”�—ี�ˆสแก�™�„ม�ˆ�•ร�‡กั�š�ˆุ�”�—ี�ˆ�€ลือก");
      } else {
        setText(el.checkpointStatus, `ส�ˆ�‡�‚�‰อมูลสำ�€ร�‡�ˆ (${res.status})`);
      }
    } else {
      setText(el.checkpointStatus, `ส�ˆ�‡�‚�‰อมูลสำ�€ร�‡�ˆ (${res.status})`);
      invalidateGuardSummaryCache();
      if (isDashboardVisible()) await loadGuardDashboardSummary(true);
    }
    clearCheckpointDraft();
  } catch (err) {
    enqueueAction("submitCheckpoint", { payload });
    setText(el.checkpointStatus, `ส�ˆ�‡�„ม�ˆสำ�€ร�‡�ˆ: �šั�™�—ึก�„ิวออ�Ÿ�„ล�™�Œแล�‰ว (${err.message})`);
    clearCheckpointDraft();
  }
}

async function onSubmitIncident() {
  if (!state.activeShift || !state.guard) return;
  const selectedItem = getSelectedPlanItem();
  if (!selectedItem) {
    setText(el.incidentStatus, "กรุ�“า�€ลือก�ˆุ�”�•รว�ˆก�ˆอ�™");
    return;
  }

  const qrText = (state.scannedQr || "").trim();
  if (!qrText) {
    setText(el.incidentStatus, "กรุ�“าสแก�™ QR ก�ˆอ�™");
    return;
  }
  if (!state.gps) {
    setText(el.incidentStatus, "กรุ�“า�‚หล�” GPS ก�ˆอ�™");
    return;
  }
  if (!state.checkpointPhoto) {
    setText(el.incidentStatus, "กรุ�“า�–�ˆายรู�›ก�ˆอ�™");
    return;
  }

  const hasAbnormal = state.incidentMode === "HAS";
  const detail = (el.incidentDetail ? el.incidentDetail.value : "").trim();
  if (hasAbnormal && !detail) {
    setText(el.incidentStatus, "กรุ�“ากรอกรายละ�€อีย�”");
    return;
  }

  const checkpointPayload = {
    shift_id: state.activeShift.shift_id,
    guard_id: state.guard.guard_id,
    qr_text_scanned: qrText,
    gps_lat: state.gps.lat,
    gps_lng: state.gps.lng,
    photo_url: state.checkpointPhoto,
    remark: hasAbnormal ? `[มี�€ห�•ุ] ${detail}` : "�„ม�ˆมี�€ห�•ุ�œิ�”�›ก�•ิ"
  };

  try {
    setText(el.incidentStatus, "กำลั�‡�šั�™�—ึก�ˆุ�”�•รว�ˆ...");
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
      setText(el.incidentStatus, `�šั�™�—ึกสำ�€ร�‡�ˆ และแ�ˆ�‰�‡�€ห�•ุแล�‰ว (${incidentRes.incident_id})`);
    } else {
      setText(el.incidentStatus, `�šั�™�—ึกสำ�€ร�‡�ˆ (${checkpointRes.status || "OK"})`);
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
    setText(el.incidentStatus, `ส�ˆ�‡�„ม�ˆสำ�€ร�‡�ˆ: �šั�™�—ึก�„ิวออ�Ÿ�„ล�™�Œแล�‰ว (${err.message})`);
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
    await showSwalMessage("success", "�‹ิ�‡ก�Œ�‚�‰อมูลสำ�€ร�‡�ˆ", `ส�ˆ�‡�‚�‰อมูลสำ�€ร�‡�ˆ ${success} รายการ`);
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
    throw new Error(`�€�„รือ�‚�ˆายมี�›ัญหา: ${err.message}`);
  }

  try {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const json = JSON.parse(text);
    if (!json.ok) {
      throw new Error(json.error || "API �œิ�”�žลา�”");
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
  setText(el.gpsText, "ยั�‡�„ม�ˆ�‚หล�” GPS");
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

function saveSession(obj) {
  localStorage.setItem(STORAGE.SESSION, JSON.stringify(obj || {}));
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE.SESSION) || "{}");
  } catch (_) {
    return {};
  }
}

function clearSession() {
  localStorage.removeItem(STORAGE.SESSION);
}

function readQueryParam(key) {
  try {
    const params = new URLSearchParams(window.location.search || "");
    return String(params.get(key) || "").trim();
  } catch (_) {
    return "";
  }
}

function clearQueryString() {
  try {
    const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
    window.history.replaceState({}, document.title, cleanUrl);
  } catch (_) {
    // ignore
  }
}

function saveQueue(queue) {
  localStorage.setItem(STORAGE.QUEUE, JSON.stringify(queue || []));
}

function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE.QUEUE) || "[]");
  } catch (_) {
    return [];
  }
}

function saveSyncMeta(meta) {
  localStorage.setItem(STORAGE.SYNC_META, JSON.stringify(meta || {}));
}

function loadSyncMeta() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE.SYNC_META) || "{}");
  } catch (_) {
    return {};
  }
}

function makeId() {
  return `Q-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

function setText(node, text) {
  if (node) node.textContent = text;
}

function showLoginLoadingSwal() {
  if (!window.Swal) return;
  Swal.fire({
    title: "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25...",
    text: "\u0e01\u0e23\u0e38\u0e13\u0e32\u0e23\u0e2d\u0e2a\u0e31\u0e01\u0e04\u0e23\u0e39\u0e48",
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading()
  });
}

async function showSwalMessage(icon, title, text) {
  if (!window.Swal) return;
  await Swal.fire({
    icon: icon || "info",
    title: title || "",
    text: text || "",
    confirmButtonText: "\u0e15\u0e01\u0e25\u0e07"
  });
}
function startLoading() {
  if (state.suppressLoading) return;
  loadingCount += 1;
  if (loadingCount > 1) return;
  if (!window.Swal) return;

  Swal.fire({
    title: "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25...",
    text: "\u0e01\u0e23\u0e38\u0e13\u0e32\u0e23\u0e2d\u0e2a\u0e31\u0e01\u0e04\u0e23\u0e39\u0e48",
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading()
  });
}

function stopLoading() {
  if (state.suppressLoading) return;
  loadingCount = Math.max(0, loadingCount - 1);
  if (loadingCount !== 0) return;
  if (!window.Swal) return;
  Swal.close();
}

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDate(date) {
  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function getPlanItemKey(item) {
  return `${String(item.checkpoint_id || "")}__${Number(item._occurrence || 0)}__${Number(item.round_no || 1)}`;
}

function isPlanItemDone(item) {
  const doneCount = Number(state.doneCheckpointCounter[String(item.checkpoint_id || "")] || 0);
  return doneCount >= Number(item._occurrence || 0);
}

function getSelectedPlanItem() {
  const planItems = buildPlanWithOccurrence(state.activePlan);
  const currentItems = planItems.filter((x) => Number(x.round_no || 1) === Number(state.currentRound));
  return currentItems.find((x) => getPlanItemKey(x) === state.selectedPlanKey) || null;
}

function detectFirstRound(plan) {
  const rounds = getRoundNumbers(Array.isArray(plan) ? plan : []);
  return rounds[0] || 1;
}

function getRoundNumbers(planItems) {
  const set = {};
  (Array.isArray(planItems) ? planItems : []).forEach((x) => {
    const r = Number(x.round_no || 1);
    if (Number.isFinite(r) && r > 0) set[r] = true;
  });

  const required = Number(state.activeShift && state.activeShift.rounds_required);
  if (Number.isFinite(required) && required > 0) {
    for (let i = 1; i <= required; i += 1) set[i] = true;
  }

  const rounds = Object.keys(set)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  return rounds.length ? rounds : [1];
}

function renderRoundTabs(rounds) {
  if (!el.roundTabs) return;
  el.roundTabs.innerHTML = rounds.map((r, idx) => {
    const active = Number(r) === Number(state.currentRound) ? "chip active" : "chip";
    let locked = false;
    if (idx > 0) {
      const prevRound = Number(rounds[idx - 1]);
      locked = !isRoundDone(prevRound);
    }
    return `<button type="button" class="${active}" data-round="${r}" ${locked ? "disabled" : ""}>\u0e23\u0e2d\u0e1a ${r}</button>`;
  }).join("");
  Array.from(el.roundTabs.querySelectorAll("[data-round]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      state.currentRound = Number(btn.getAttribute("data-round") || 1);
      state.selectedPlanKey = "";
      renderCheckpointList();
      refreshStats();
    });
  });
}

function buildPlanWithOccurrence(plan) {
  const seenCounter = {};
  return (plan || []).map((cp) => {
    const checkpointId = String(cp.checkpoint_id || "");
    seenCounter[checkpointId] = Number(seenCounter[checkpointId] || 0) + 1;
    return { ...cp, _occurrence: seenCounter[checkpointId] };
  });
}

function moveToNextRoundIfCurrentDone() {
  const planItems = buildPlanWithOccurrence(state.activePlan);
  const rounds = getRoundNumbers(planItems);
  const currentItems = planItems.filter((x) => Number(x.round_no || 1) === Number(state.currentRound));
  if (!currentItems.length) return;
  const doneAll = currentItems.every((item) => {
    const doneCount = Number(state.doneCheckpointCounter[String(item.checkpoint_id || "")] || 0);
    return doneCount >= Number(item._occurrence || 0);
  });
  if (!doneAll) return;
  const idx = rounds.indexOf(Number(state.currentRound));
  if (idx >= 0 && idx < rounds.length - 1) {
    state.currentRound = rounds[idx + 1];
  }
}

function isRoundDone(roundNo) {
  const planItems = buildPlanWithOccurrence(state.activePlan).filter((x) => Number(x.round_no || 1) === Number(roundNo));
  if (!planItems.length) return false;
  return planItems.every((item) => isPlanItemDone(item));
}

function getCheckpointStatusMeta({ done, locked, isSelected }) {
  if (done) return { type: "ok", label: "\u0e15\u0e23\u0e27\u0e08\u0e41\u0e25\u0e49\u0e27", cls: "ok" };
  if (locked) return { type: "wait", label: "\u0e23\u0e2d\u0e01\u0e48\u0e2d\u0e19", cls: "wait" };
  if (isSelected) return { type: "focus", label: "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e15\u0e23\u0e27\u0e08\u0e08\u0e38\u0e14\u0e19\u0e35\u0e49", cls: "focus" };
  return { type: "ready", label: "\u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e15\u0e23\u0e27\u0e08", cls: "ready" };
}

function renderStatusIcon(type) {
  if (type === "ok") {
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M20 7 9 18l-5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  if (type === "wait") {
    return '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/><path d="M12 8v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  if (type === "focus") {
    return '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/><path d="M9 12h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
}

function toggleCheckinActionPanel(show) {
  if (!el.checkinActionPanel) return;
  el.checkinActionPanel.classList.toggle("hidden", !show);
  if (el.checkpointListPanel) el.checkpointListPanel.classList.toggle("hidden", show);
  if (el.backToCheckpointListBtn) el.backToCheckpointListBtn.classList.toggle("hidden", !show);
  if (!show) hideAllActionDetails();
}

function updateActionCardsState() {
  const selectedItem = getSelectedPlanItem();
  const hasSelected = !!selectedItem;
  const hasQr = !!String(state.scannedQr || "").trim();
  const hasGps = !!state.gps;
  const hasPhoto = !!state.checkpointPhoto;

  setCardEnabled(el.actionQrCard, hasSelected && !hasQr);
  setCardEnabled(el.actionGpsCard, hasSelected);
  setCardEnabled(el.actionIncidentCard, hasSelected);
  setCardDone(el.actionQrCard, hasQr);
  setCardDone(el.actionGpsCard, hasPhoto);

  setText(el.qrStepStatus, hasQr ? "สแก�™แล�‰ว" : "ยั�‡�„ม�ˆสแก�™");
  setText(el.gpsStepStatus, hasPhoto ? "�–�ˆายแล�‰ว" : "ยั�‡�„ม�ˆ�–�ˆาย");
  setText(el.incidentStepStatus, hasQr && hasGps && hasPhoto ? "�žร�‰อมยื�™ยั�™" : "รอ�‚�‰อมูล�ƒห�‰�„ร�š");
}

function setCardEnabled(node, enabled) {
  if (!node) return;
  node.disabled = !enabled;
  node.classList.toggle("disabled", !enabled);
}

function setCardDone(node, done) {
  if (!node) return;
  node.classList.toggle("done", !!done);
}

function openActionDetail(name) {
  const selectedItem = getSelectedPlanItem();
  if (!selectedItem) {
    setText(el.checkpointStatus, "กรุ�“า�€ลือก�ˆุ�”�•รว�ˆก�ˆอ�™");
    return;
  }
  hideAllActionDetails();
  if (name === "gps" && el.detailGpsPhoto) el.detailGpsPhoto.classList.remove("hidden");
  if (name === "incident" && el.detailIncident) {
    if (el.quickActionCards) el.quickActionCards.classList.add("hidden");
    el.detailIncident.classList.remove("hidden");
    setIncidentMode(state.incidentMode || "NONE");
  }
}

function hideAllActionDetails() {
  if (el.quickActionCards) el.quickActionCards.classList.remove("hidden");
  if (el.detailGpsPhoto) el.detailGpsPhoto.classList.add("hidden");
  if (el.detailIncident) el.detailIncident.classList.add("hidden");
}

function setIncidentMode(mode) {
  state.incidentMode = mode === "HAS" ? "HAS" : "NONE";
  if (el.incidentChoiceNone) el.incidentChoiceNone.classList.toggle("active", state.incidentMode === "NONE");
  if (el.incidentChoiceHas) el.incidentChoiceHas.classList.toggle("active", state.incidentMode === "HAS");
  if (el.incidentExtraFields) el.incidentExtraFields.classList.toggle("hidden", state.incidentMode !== "HAS");
}


async function showCheckpointResultSwal(res, selectedItem) {
  if (!window.Swal || !res) return;

  const status = String(res.status || "").toUpperCase();
  const isWrongPoint = String((selectedItem && selectedItem.checkpoint_id) || "") !== String(res.checkpoint_id || "");

  let icon = "success";
  let title = "�šั�™�—ึก�‚�‰อมูลสำ�€ร�‡�ˆ";
  let text = "�•รว�ˆ�ˆุ�”�€รีย�šร�‰อย";

  if (status === "INVALID_GPS") {
    icon = "error";
    title = "สแก�™สำ�€ร�‡�ˆ แ�•�ˆ�•ำแห�™�ˆ�‡�„ม�ˆ�–ูก�•�‰อ�‡";
    text = "GPS �„ม�ˆอยู�ˆ�ƒ�™รัศมี�ˆุ�”�•รว�ˆ กรุ�“า�„�›�—ี�ˆ�ˆุ�”�•รว�ˆ�ˆริ�‡แล�‰วสแก�™�ƒหม�ˆ";
  } else if (status === "INVALID_QR" || isWrongPoint) {
    icon = "error";
    title = "สแก�™ QR �„ม�ˆ�•ร�‡�ˆุ�”";
    text = "QR �—ี�ˆสแก�™�„ม�ˆ�•ร�‡กั�š�ˆุ�”�•รว�ˆ�—ี�ˆ�€ลือก กรุ�“า�•รว�ˆสอ�šแล�‰วสแก�™�ƒหม�ˆ";
  } else if (status === "LATE") {
    icon = "warning";
    title = "�šั�™�—ึกสำ�€ร�‡�ˆ (�Š�‰า)";
    text = "�•รว�ˆ�ˆุ�”สำ�€ร�‡�ˆ แ�•�ˆ�€กิ�™�€วลา�—ี�ˆกำห�™�”";
  } else if (status === "ONTIME") {
    icon = "success";
    title = "�šั�™�—ึกสำ�€ร�‡�ˆ";
    text = "�•รว�ˆ�ˆุ�”สำ�€ร�‡�ˆ�•าม�€วลา";
  } else if (status) {
    icon = "info";
    title = "�šั�™�—ึกสำ�€ร�‡�ˆ";
    text = "ส�–า�™ะ: " + status;
  }

  await Swal.fire({
    icon,
    title,
    text,
    confirmButtonText: "�•กล�‡"
  });
}
async function openQrScanCard() {
  const selectedItem = getSelectedPlanItem();
  if (!selectedItem) {
    setText(el.checkpointStatus, "กรุ�“า�€ลือก�ˆุ�”�•รว�ˆก�ˆอ�™สแก�™ QR");
    return;
  }
  if (!window.Swal || !window.Html5Qrcode) {
    setText(el.checkpointStatus, "อุ�›กร�“�Œ�„ม�ˆรอ�‡รั�šสแก�™กล�‰อ�‡");
    return;
  }

  const readerId = "swalQrReader";
  let scanner = null;
  await Swal.fire({
    title: "สแก�™ QR �ˆุ�”�•รว�ˆ",
    html: `<div id="${readerId}" style="min-height:280px;border-radius:10px;overflow:hidden;background:#0a1f37"></div>`,
    showCancelButton: true,
    confirmButtonText: "�›ิ�”",
    cancelButtonText: "ยก�€ลิก",
    didOpen: () => {
      scanner = new Html5Qrcode(readerId);
      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (decodedText) => {
          const expectedQr = getExpectedQrForSelectedPoint(selectedItem);
          const actualQr = String(decodedText || "").trim();
          if (expectedQr && actualQr !== expectedQr) {
            setText(el.checkpointStatus, "สแก�™ QR �„ม�ˆ�•ร�‡�ˆุ�”");
            if (navigator && typeof navigator.vibrate === "function") {
              navigator.vibrate([180, 120, 180]);
            }
            if (window.Swal && Swal.isVisible()) {
              Swal.showValidationMessage("สแก�™ QR �„ม�ˆ�•ร�‡�ˆุ�”");
              const vm = Swal.getValidationMessage ? Swal.getValidationMessage() : null;
              if (vm) {
                vm.style.fontSize = "1.06rem";
                vm.style.fontWeight = "800";
                vm.style.color = "#b91c1c";
                vm.style.background = "#fee2e2";
                vm.style.border = "1px solid #fecaca";
                vm.style.borderRadius = "10px";
                vm.style.padding = "10px 12px";
                vm.style.marginTop = "10px";
              }
            }
            return;
          }
          state.scannedQr = actualQr;
          if (el.manualQr) el.manualQr.value = decodedText;
          setText(el.qrStepStatus, `สแก�™แล�‰ว: ${decodedText}`);
          updateActionCardsState();
          Swal.close();
        },
        () => {}
      ).catch(() => {
        setText(el.checkpointStatus, "�€�›ิ�”กล�‰อ�‡�„ม�ˆสำ�€ร�‡�ˆ");
      });
    },
    willClose: () => {
      if (!scanner) return;
      scanner.stop().catch(() => {}).finally(() => {
        scanner.clear();
      });
    }
  });
}

function getExpectedQrForSelectedPoint(selectedItem) {
  if (!selectedItem) return "";
  const cpId = String(selectedItem.checkpoint_id || "").trim();
  if (!cpId) return "";
  return String(state.checkpointQrMap[cpId] || cpId).trim();
}

async function openAssignedRouteOrFallback(activeShiftId) {
  if (!state.shifts.length) {
    switchView("shifts");
    return;
  }

  if (activeShiftId) {
    const idx = state.shifts.findIndex((s) => String(s.shift_id) === String(activeShiftId));
    if (idx >= 0) {
      await openShift(idx);
      return;
    }
  }

  const openIndex = state.shifts.findIndex((s) => String(s.status || "").toUpperCase() !== "CLOSED");
  await openShift(openIndex >= 0 ? openIndex : 0);
}

function formatTime(date) {
  return date.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

function formatShiftWindow(shift) {
  const dateRaw = shift && shift.date ? shift.date : "";
  const dateParts = extractDateParts(dateRaw);
  const dd = dateParts ? dateParts.dd : "--";
  const monthText = dateParts ? toThaiMonthShort(dateParts.mm) : "--";
  const yy = dateParts ? dateParts.yy : "--";
  const start = String((shift && shift.start_time) || "-").slice(0, 5);
  const end = String((shift && shift.end_time) || "-").slice(0, 5);
  return `${dd} ${monthText} ${yy} ${start} - ${end}`;
}

function toThaiMonthShort(mm) {
  const m = Number(mm);
  const months = ["\u0e21.\u0e04.", "\u0e01.\u0e1e.", "\u0e21\u0e35.\u0e04.", "\u0e40\u0e21.\u0e22.", "\u0e1e.\u0e04.", "\u0e21\u0e34.\u0e22.", "\u0e01.\u0e04.", "\u0e2a.\u0e04.", "\u0e01.\u0e22.", "\u0e15.\u0e04.", "\u0e1e.\u0e22.", "\u0e18.\u0e04."];
  if (!Number.isFinite(m) || m < 1 || m > 12) return "--";
  return months[m - 1];
}

function extractDateParts(value) {
  if (!value) return null;

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    const y = String(value.getFullYear());
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return { dd: d, mm: m, yy: y.slice(2) };
  }

  const raw = String(value).trim();
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    return { dd: ymd[3], mm: ymd[2], yy: ymd[1].slice(2) };
  }

  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) {
    return { dd: dmy[1], mm: dmy[2], yy: dmy[3].slice(2) };
  }

  // ISO datetime (e.g. 2026-04-20T17:00:00.000Z) should be converted to local date.
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const isoDate = new Date(raw);
    if (!isNaN(isoDate.getTime())) {
      const y = String(isoDate.getFullYear());
      const m = String(isoDate.getMonth() + 1).padStart(2, "0");
      const day = String(isoDate.getDate()).padStart(2, "0");
      return { dd: day, mm: m, yy: y.slice(2) };
    }
  }

  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return { dd: day, mm: m, yy: y.slice(2) };
  }

  return null;
}

function updateTodayText() {
  const now = new Date();
  el.todayText.textContent = `\u0e27\u0e31\u0e19\u0e19\u0e35\u0e49 ${formatDate(now)} ${formatTime(now)}`;
}

function fmtDateTimeLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function normalizeTime(value) {
  const s = String(value || "").trim();
  if (!s) return "00:00:00";
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return s;
  const hh = String(Math.min(23, Math.max(0, Number(m[1])))).padStart(2, "0");
  const mm = String(Math.min(59, Math.max(0, Number(m[2])))).padStart(2, "0");
  const ss = String(Math.min(59, Math.max(0, Number(m[3] || 0)))).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function parseGuardIdsLocal(raw) {
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

function makeShiftIdFromTemplate(templateId, dateStr, guardId) {
  const d = String(dateStr || "").replace(/-/g, "");
  const g = String(guardId || "").trim();
  if (g) return `${String(templateId)}-${g}-${d}`;
  return `${String(templateId)}-${d}`;
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

async function fileToDataUrl(file, maxSize, quality) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("�„ม�ˆสามาร�–อ�ˆา�™�„�Ÿล�Œ�„�”�‰"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("�„ม�ˆสามาร�–�›ระมวล�œลรู�›�„�”�‰"));
    im.src = dataUrl;
  });

  const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

async function fileToDataUrlWithWatermark(file, maxSize, quality, meta) {
  const dataUrl = await fileToDataUrl(file, maxSize, quality);
  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("�„ม�ˆสามาร�–�›ระมวล�œลรู�›�„�”�‰"));
    im.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, img.width, img.height);

  const dt = meta && meta.timestamp ? meta.timestamp : new Date();
  const dateText = dt.toLocaleString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const lat = Number(meta && meta.lat);
  const lng = Number(meta && meta.lng);
  const gpsText = Number.isFinite(lat) && Number.isFinite(lng)
    ? `Lat ${lat.toFixed(6)} | Lng ${lng.toFixed(6)}`
    : "Lat - | Lng -";

  const lines = [`วั�™�—ี�ˆ ${dateText}`, gpsText];
  const pad = Math.max(10, Math.round(canvas.width * 0.018));
  const fontSize = Math.max(14, Math.round(canvas.width * 0.03));
  const lineGap = Math.max(6, Math.round(fontSize * 0.4));
  const boxHeight = pad * 2 + lines.length * fontSize + (lines.length - 1) * lineGap;
  const boxY = canvas.height - boxHeight - pad;

  ctx.fillStyle = "rgba(9, 22, 35, 0.62)";
  ctx.fillRect(pad, boxY, canvas.width - pad * 2, boxHeight);

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${fontSize}px "Segoe UI", "Noto Sans Thai", sans-serif`;
  ctx.textBaseline = "top";

  let y = boxY + pad;
  lines.forEach((line) => {
    ctx.fillText(line, pad * 2, y);
    y += fontSize + lineGap;
  });

  return canvas.toDataURL("image/jpeg", quality);
}












