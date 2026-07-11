window.addEventListener("DOMContentLoaded", async () => {
  bindElements();
  bindEvents();
  state.queue = loadQueue();
  state.lastSync = loadSyncMeta().lastSync || "-";
  updateTodayText();
  setInterval(updateTodayText, 1000);
  refreshQueueBanner();

  if (!navigator.onLine) {
    console.warn("อุปกรณ์ออฟไลน์: บันทึกคิวไว้ก่อน แล้วซิงก์ภายหลังได้");
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
    "logoutBtn", "shiftList", "tourTitle", "tourRoundSummary",
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
    "incidentPhotoBtn", "incidentPhotoInput", "incidentEvidenceList",
    "submitIncidentBtn",
    "incidentStatus",
    "bottomNav", "navTour", "navDashboard"
  ].forEach((id) => {
    el[id] = document.getElementById(id);
  });
}

function bindEvents() {
  el.logoutBtn.addEventListener("click", confirmLogout);
  if (el.guardBadge) el.guardBadge.addEventListener("click", confirmLogout);

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
      if (el.incidentPhotoBtn.disabled) return;
      const slot = addIncidentEvidenceItem(true);
      if (!slot) return;
      state.activeIncidentCaptureId = String(slot.id || "");
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
      const targetId = String(state.activeIncidentCaptureId || "").trim();
      const slot = state.incidentEvidenceItems.find((item) => String(item.id || "") === targetId);
      if (!slot) return;
      const selectedItem = getSelectedPlanItem();
      const roundNo = Number((selectedItem && selectedItem.round_no) || state.currentRound || 0);
      const seqNo = Number((selectedItem && selectedItem.seq_no) || 0);
      const checkpointName = String(
        (selectedItem && (selectedItem.checkpoint_name || selectedItem.checkpoint_id)) || "-"
      ).trim();
      const incidentDetail = String(slot.comment || "").trim();
      if (!state.gps) {
        try {
          await captureGps();
        } catch (_) {}
      }
      slot.photo = await fileToDataUrlWithWatermark(file, 1280, 0.8, {
        timestamp: new Date(),
        lat: state.gps ? state.gps.lat : null,
        lng: state.gps ? state.gps.lng : null,
        roundNo,
        seqNo,
        checkpointName,
        incidentDetail
      });
      renderIncidentEvidenceList();
      state.activeIncidentCaptureId = "";
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
    await loadGuardBootstrap(session.guardId, date, new Date().toISOString());
    renderShiftList();
    renderDashboard();
    await openAssignedRouteOrFallback(session.activeShiftId);
    state.suppressLoading = false;
    if (window.Swal) Swal.close();
  } catch (err) {
    clearSession();
    state.suppressLoading = false;
    if (window.Swal) Swal.close();
    await showSwalMessage("error", "เข้าสู่ระบบไม่สำเร็จ", `กู้คืนเซสชันไม่สำเร็จ: ${err.message}`);
    window.location.href = "index.html";
  }
}
async function confirmLogout() {
  if (!window.Swal) {
    onLogout();
    return;
  }
  const result = await Swal.fire({
    icon: "question",
    title: "ออกจากระบบ",
    text: "ต้องการออกจากระบบใช่หรือไม่",
    showCancelButton: true,
    confirmButtonText: "ออกจากระบบ",
    cancelButtonText: "ยกเลิก",
    customClass: {
      popup: "guard-swal",
      title: "guard-swal-title",
      htmlContainer: "guard-swal-text",
      confirmButton: "guard-swal-confirm",
      cancelButton: "guard-swal-cancel"
    },
    buttonsStyling: false
  });
  if (result.isConfirmed) onLogout();
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

  const guardName = guard.name || "เจ้าหน้าที่";
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
    shift.profile_name || shift.template_name || shift.shift_name || "ไม่ระบุ"
  ).trim();
}

function displayShiftStatus(status) {
  const code = String(status || "OPEN").toUpperCase();
  if (code === "CLOSED") return "ปิดกะแล้ว";
  if (code === "CANCELED") return "ยกเลิก";
  return "พร้อมตรวจ";
}

function renderShiftList() {
  const rows = state.shifts || [];

  if (!rows.length) {
    el.shiftList.innerHTML = '<div class="shift-card">ไม่พบงานที่ถูก Assign สำหรับรหัสนี้ กรุณาตรวจสอบเมนู Assign ในหน้า Admin</div>';
    return;
  }

  el.shiftList.innerHTML = rows.map((s) => {
    const status = String(s.status || "OPEN").toUpperCase();
    const statusClass = status === "CLOSED" ? "badge badge-closed" : "badge badge-open";
    const timingState = String(s.timing_state || "").toUpperCase();
    const timingText =
      timingState === "CURRENT" ? "กำลังเข้ากะ" :
      timingState === "UPCOMING" ? "รอเวลาเริ่มกะ" :
      timingState === "ENDED" ? "หมดเวลากะแล้ว" :
      displayShiftStatus(status);

    return `
      <div class="shift-card">
        <h4>${escapeHtml(getShiftProfile(s))}</h4>
        <p class="meta">เวลา ${escapeHtml(s.start_time || "-")} - ${escapeHtml(s.end_time || "-")}</p>
        <p class="meta">รหัสกะ: ${escapeHtml(s.shift_id || "")}</p>
        <span class="${statusClass}">${escapeHtml(timingText)}</span>
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
  state.incidentEvidenceItems = [];
  state.activeIncidentCaptureId = "";
  state.incidentMode = "NONE";

  if (el.manualQr) el.manualQr.value = "";
  if (el.incidentPhotoInput) el.incidentPhotoInput.value = "";

  setText(el.gpsText, "ยังไม่โหลด GPS");
  setText(el.checkpointStatus, "");
  setText(el.incidentStatus, "");
  setText(el.submitStepStatus, "รอการยืนยัน");
  setIncidentMode("NONE");
  hideAllActionDetails();

  el.tourTitle.textContent = `${getShiftProfile(shift)} (${formatShiftWindow(shift)})`;
  if (el.tourRoundSummary) {
    const roundsRequired = Math.max(1, Number(shift.rounds_required || 1));
    el.tourRoundSummary.textContent = `กะนี้ต้องตรวจทั้งหมด ${roundsRequired} รอบ`;
  }
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

function getCheckpointCheckerMeta(point) {
  if (!state.activeShift || !point) return null;
  const shiftMeta = state.shiftProgressMetaMap[String(state.activeShift.shift_id || "")] || {};
  const checkpointId = String(point.checkpoint_id || "").trim();
  return checkpointId ? (shiftMeta[checkpointId] || null) : null;
}

function renderCheckpointList() {
  if (!state.activePlan.length) {
    el.roundTabs.innerHTML = "";
    setText(el.currentPointText, "เลือกจุดตรวจจากรายการด้านล่างก่อน");
    if (el.checkinActionPanel) el.checkinActionPanel.classList.add("hidden");
    if (el.checkpointListPanel) el.checkpointListPanel.classList.remove("hidden");
    stopQrScanner();
    el.checkpointList.innerHTML = '<div class="checkpoint-card">ไม่พบจุดตรวจในรอบนี้</div>';
    return;
  }

  const planItems = buildPlanWithOccurrence(state.activePlan);
  const rounds = getRoundNumbers(planItems);
  if (!rounds.includes(state.currentRound)) state.currentRound = rounds[0];
  renderRoundTabs(rounds);

  const currentItems = planItems.filter((x) => Number(x.round_no || 1) === Number(state.currentRound));
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
    setText(el.currentPointText, "เลือกจุดตรวจจากรายการด้านล่างก่อน");
  }
  toggleCheckinActionPanel(!!selectedItem);
  updateActionCardsState();

  el.checkpointList.innerHTML = currentItems.map((cp) => {
    const done = isPlanItemDone(cp);
    const key = getPlanItemKey(cp);
    const isSelected = key === state.selectedPlanKey;
    const locked = false;
    const disabled = done;
    const statusMeta = getCheckpointStatusMeta({ done, locked, isSelected });
    const checkerMeta = getCheckpointCheckerMeta(cp);
    const checkerText = done && checkerMeta && checkerMeta.guard_name
      ? `ตรวจโดย: ${checkerMeta.guard_name}`
      : "";

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
        ${checkerText ? `<div class="status-subline">${escapeHtml(checkerText)}</div>` : ""}
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
  if (el.tourRoundSummary) {
    el.tourRoundSummary.textContent = `กะนี้ต้องตรวจทั้งหมด ${totalRounds} รอบ`;
  }
}

async function loadGps() {
  try {
    await captureGps();
    setText(el.gpsText, `Lat: ${state.gps.lat.toFixed(6)}, Lng: ${state.gps.lng.toFixed(6)}`);
    updateActionCardsState();
  } catch (err) {
    setText(el.gpsText, `โหลด GPS ไม่สำเร็จ: ${err.message}`);
  }
}

function addIncidentEvidenceItem(autoRender) {
  if (!Array.isArray(state.incidentEvidenceItems)) state.incidentEvidenceItems = [];
  if (state.incidentEvidenceItems.length >= 3) {
    if (window.Swal) {
      Swal.fire({
        icon: "warning",
        title: "เพิ่มได้สูงสุด 3 ชุด",
        text: "แต่ละเหตุสามารถแนบรูปพร้อมคอมเมนต์ได้ไม่เกิน 3 ชุด",
        confirmButtonText: "ตกลง"
      });
    }
    return null;
  }
  const item = { id: `EV-${Date.now()}-${Math.floor(Math.random() * 100000)}`, comment: "", photo: "" };
  state.incidentEvidenceItems.push(item);
  if (autoRender) renderIncidentEvidenceList();
  updateIncidentPhotoButtonState();
  return item;
}

function removeIncidentEvidenceItem(itemId) {
  state.incidentEvidenceItems = (state.incidentEvidenceItems || []).filter((item) => String(item.id || "") !== String(itemId || ""));
  renderIncidentEvidenceList();
  updateIncidentPhotoButtonState();
}

function renderIncidentEvidenceList() {
  if (!el.incidentEvidenceList) return;
  const items = Array.isArray(state.incidentEvidenceItems) ? state.incidentEvidenceItems : [];
  if (!items.length) {
    el.incidentEvidenceList.innerHTML = '<div class="incident-evidence-empty">กดปุ่ม + เพื่อเพิ่มรูปและคอมเมนต์</div>';
    return;
  }

  el.incidentEvidenceList.innerHTML = items.map((item, index) => `
    <div class="incident-evidence-card" data-evidence-id="${escapeAttr(item.id)}">
      <div class="incident-evidence-top">
        <strong class="incident-evidence-index">ชุดที่ ${index + 1}</strong>
        <div class="incident-evidence-actions">
          <button type="button" class="incident-evidence-camera" data-photo-evidence="${escapeAttr(item.id)}" title="ถ่ายรูป" aria-label="ถ่ายรูป">
            <span class="material-symbols-outlined">photo_camera</span>
          </button>
          <button type="button" class="incident-evidence-remove" data-remove-evidence="${escapeAttr(item.id)}" title="ลบชุดนี้" aria-label="ลบชุดนี้">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      </div>
      <div class="incident-evidence-preview-wrap ${item.photo ? "has-photo" : ""}">
        ${item.photo ? `<img src="${item.photo}" class="incident-evidence-preview" alt="ภาพเหตุผิดปกติ">` : '<div class="incident-evidence-placeholder"><span class="material-symbols-outlined">imagesmode</span></div>'}
      </div>
      <textarea class="incident-evidence-comment" data-comment-evidence="${escapeAttr(item.id)}" rows="2" placeholder="คอมเมนต์ใต้รูป">${escapeHtml(item.comment || "")}</textarea>
    </div>
  `).join("");

  el.incidentEvidenceList.querySelectorAll("[data-comment-evidence]").forEach((node) => {
    node.addEventListener("input", (event) => {
      const itemId = String(event.currentTarget.getAttribute("data-comment-evidence") || "");
      const item = state.incidentEvidenceItems.find((x) => String(x.id || "") === itemId);
      if (!item) return;
      item.comment = event.currentTarget.value || "";
      updateIncidentPhotoButtonState();
    });
  });

  el.incidentEvidenceList.querySelectorAll("[data-photo-evidence]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeIncidentCaptureId = String(btn.getAttribute("data-photo-evidence") || "");
      el.incidentPhotoInput.value = "";
      el.incidentPhotoInput.click();
    });
  });

  el.incidentEvidenceList.querySelectorAll("[data-remove-evidence]").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeIncidentEvidenceItem(String(btn.getAttribute("data-remove-evidence") || ""));
    });
  });
}

async function onCheckinCard() {
  const selectedItem = getSelectedPlanItem();
  if (!selectedItem) {
    setText(el.checkpointStatus, "กรุณาเลือกจุดตรวจก่อน");    return;
  }
  if (!state.scannedQr) {
    if (window.Swal) await Swal.fire({ icon: "warning", title: "กรุณาสแกน QR ก่อน", confirmButtonText: "ตกลง" });
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
          title: "คุณอยู่นอกพื้นที่จุดตรวจสอบ",
          text: check.message || "กรุณาอยู่ในรัศมีจุดตรวจแล้วลองใหม่อีกครั้ง",
          confirmButtonText: "ตกลง"
        });
      }
      setText(el.gpsText, `นอกพื้นที่ (${check.distanceM} ม.)`);
      return;
    }
    state.checkinPassed = true;
    setText(el.gpsText, `ผ่านการ Check in (${check.distanceM} ม.)`);
    updateActionCardsState();
    if (window.Swal) {
      await Swal.fire({
        icon: "success",
        title: "Check in สำเร็จ",
        text: "อยู่ในพื้นที่จุดตรวจแล้ว",
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
        title: "โหลดตำแหน่งไม่สำเร็จ",
        text: err.message || "กรุณาลองใหม่",
        confirmButtonText: "ตกลง"
      });
    }
  }
}

function captureGps() {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("อุปกรณ์ไม่รองรับ GPS"));
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

async function onSubmitIncident() {
  if (!state.activeShift || !state.guard) return;
  const selectedItem = getSelectedPlanItem();
  if (!selectedItem) {
    setText(el.incidentStatus, "กรุณาเลือกจุดตรวจก่อน");
    return;
  }

  const qrText = (state.scannedQr || "").trim();
  if (!qrText) {
    setText(el.incidentStatus, "กรุณาสแกน QR ก่อน");
    return;
  }
  if (!state.gps) {
    setText(el.incidentStatus, "กรุณา Check in ก่อน");
    return;
  }
  if (!state.checkinPassed) {
    setText(el.incidentStatus, "กรุณา Check in ให้ผ่านก่อน");
    return;
  }

  const hasAbnormal = state.incidentMode === "HAS";
  const evidenceItems = (state.incidentEvidenceItems || []).filter((item) => {
    return String(item.comment || "").trim() || String(item.photo || "").trim();
  });
  if (hasAbnormal && !evidenceItems.length) {
    setText(el.incidentStatus, "กรุณาเพิ่มรูปและคอมเมนต์อย่างน้อย 1 ชุด");
    return;
  }
  if (hasAbnormal && evidenceItems.some((item) => !String(item.comment || "").trim())) {
    setText(el.incidentStatus, "กรุณากรอกคอมเมนต์ใต้รูปให้ครบ");
    return;
  }
  if (hasAbnormal && evidenceItems.some((item) => !String(item.photo || "").trim())) {
    setText(el.incidentStatus, "กรุณาถ่ายรูปให้ครบทุกชุด");
    if (window.Swal) {
      await Swal.fire({
        icon: "warning",
        title: "กรุณาถ่ายรูปด้วย",
        text: "บางชุดยังไม่มีรูป กรุณาถ่ายรูปให้ครบก่อนบันทึก",
        confirmButtonText: "ตกลง"
      });
    }
    return;
  }

  const incidentDetailText = evidenceItems
    .map((item, index) => `ชุดที่ ${index + 1}: ${String(item.comment || "").trim()}`)
    .join("\n");
  const checkpointPhoto = (hasAbnormal && evidenceItems[0] && evidenceItems[0].photo)
    ? evidenceItems[0].photo
    : createCheckinProofImage_(state.gps);

  const checkpointPayload = {
    shift_id: state.activeShift.shift_id,
    guard_id: state.guard.guard_id,
    qr_text_scanned: qrText,
    gps_lat: state.gps.lat,
    gps_lng: state.gps.lng,
    photo_url: checkpointPhoto,
    remark: hasAbnormal ? `[มีเหตุ] ${incidentDetailText}` : "ไม่มีเหตุผิดปกติ"
  };

  try {
    setText(el.incidentStatus, "กำลังบันทึกจุดตรวจ...");
    const checkpointRes = await callApi("submitCheckpoint", { payload: checkpointPayload });
    await showCheckpointResultSwal(checkpointRes, selectedItem);

    if (hasAbnormal) {
      const incidentPayload = {
        shift_id: state.activeShift.shift_id,
        guard_id: state.guard.guard_id,
        type: "ABNORMAL",
        detail: incidentDetailText,
        photo_url: evidenceItems[0].photo || checkpointPhoto,
        photo_sets: evidenceItems.map((item, index) => ({
          seq_no: index + 1,
          comment: String(item.comment || "").trim(),
          photo_url: String(item.photo || "").trim()
        })),
        severity: "MEDIUM"
      };
      const incidentRes = await callApi("submitIncident", { payload: incidentPayload });
      setText(el.incidentStatus, `บันทึกสำเร็จ และแจ้งเหตุแล้ว (${incidentRes.incident_id})`);
    } else {
      setText(el.incidentStatus, `บันทึกสำเร็จ (${checkpointRes.status || "OK"})`);
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
          detail: incidentDetailText,
          photo_url: evidenceItems[0].photo || checkpointPhoto,
          photo_sets: evidenceItems.map((item, index) => ({
            seq_no: index + 1,
            comment: String(item.comment || "").trim(),
            photo_url: String(item.photo || "").trim()
          })),
          severity: "MEDIUM"
        }
      });
    }
    setText(el.incidentStatus, `ส่งไม่สำเร็จ: บันทึกคิวออฟไลน์แล้ว (${err.message})`);
    clearIncidentDraft();
    clearCheckpointDraft();
  }
}


async function refreshShiftPlan() {
  if (!state.guard) return;

  const date = toYmd(new Date());
  const activeShiftId = state.activeShift ? state.activeShift.shift_id : loadSession().activeShiftId;
  await loadGuardBootstrap(state.guard.guard_id, date, new Date().toISOString());
  invalidateGuardSummaryCache();
  renderShiftList();
  renderDashboard();
  await openAssignedRouteOrFallback(activeShiftId);
}

async function loadGuardBootstrap(guardId, date, moment) {
  const gid = String(guardId || "").trim();
  if (!gid || !date) return [];

  const data = await callApi("guardBootstrap", { guardId: gid, date, moment: moment || new Date().toISOString() });
  const checkpointRows = Array.isArray(data && data.checkpoint_meta_rows) ? data.checkpoint_meta_rows : [];
  state.guard = data && data.guard ? data.guard : null;
  state.shifts = Array.isArray(data && data.shifts) ? data.shifts : [];
  state.shiftProgressMap = data && data.progress_by_shift ? data.progress_by_shift : {};
  state.shiftProgressMetaMap = data && data.progress_meta_by_shift ? data.progress_meta_by_shift : {};
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
    await showSwalMessage("success", "ซิงก์ข้อมูลสำเร็จ", `ส่งข้อมูลสำเร็จ ${success} รายการ`);
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
    throw new Error(`เครือข่ายมีปัญหา: ${err.message}`);
  }

  try {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const json = JSON.parse(text);
    if (!json.ok) {
      throw new Error(json.error || "API ผิดพลาด");
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
  setText(el.gpsText, "ยังไม่โหลด GPS");
  if (el.checkpointRemark) el.checkpointRemark.value = "";
  updateActionCardsState();
}

function clearIncidentDraft() {
  state.incidentPhoto = "";
  state.incidentEvidenceItems = [];
  state.activeIncidentCaptureId = "";
  state.incidentMode = "NONE";
  if (el.incidentType) el.incidentType.value = "";
  if (el.incidentPhotoInput) el.incidentPhotoInput.value = "";
  if (el.incidentEvidenceList) el.incidentEvidenceList.innerHTML = "";
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
    return { ok: false, distanceM, message: `ระยะ ${distanceM} เมตร (เกินรัศมี ${radius} เมตร)` };
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
  ctx.fillText(`วันที่ ${new Date().toLocaleString("th-TH", { hour12: false })}`, 60, 210);
  ctx.fillText(`Lat: ${Number(gps.lat).toFixed(6)}  Lng: ${Number(gps.lng).toFixed(6)}`, 60, 280);
  ctx.fillText(`ผู้ตรวจ: ${state.guard ? (state.guard.name || state.guard.guard_id) : "-"}`, 60, 350);
  return canvas.toDataURL("image/jpeg", 0.85);
}






