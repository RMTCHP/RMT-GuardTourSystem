// Guard helper functions extracted from app.js

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

  setText(el.qrStepStatus, hasQr ? "สแกนแล้ว" : "ยังไม่สแกน");
  setText(el.gpsStepStatus, hasPhoto ? "ถ่ายแล้ว" : "ยังไม่ถ่าย");
  setText(el.incidentStepStatus, hasQr && hasGps && hasPhoto ? "พร้อมยืนยัน" : "รอข้อมูลให้ครบ");
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
    setText(el.checkpointStatus, "กรุณาเลือกจุดตรวจก่อน");
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
  let title = "บันทึกข้อมูลสำเร็จ";
  let text = "ตรวจจุดเรียบร้อย";

  if (status === "INVALID_GPS") {
    icon = "error";
    title = "สแกนสำเร็จ แต่ตำแหน่งไม่ถูกต้อง";
    text = "GPS ไม่อยู่ในรัศมีจุดตรวจ กรุณาไปที่จุดตรวจจริงแล้วสแกนใหม่";
  } else if (status === "INVALID_QR" || isWrongPoint) {
    icon = "error";
    title = "สแกน QR ไม่ตรงจุด";
    text = "QR ที่สแกนไม่ตรงกับจุดตรวจที่เลือก กรุณาตรวจสอบแล้วสแกนใหม่";
  } else if (status === "LATE") {
    icon = "warning";
    title = "บันทึกสำเร็จ (ช้า)";
    text = "ตรวจจุดสำเร็จ แต่เกินเวลาที่กำหนด";
  } else if (status === "ONTIME") {
    icon = "success";
    title = "บันทึกสำเร็จ";
    text = "ตรวจจุดสำเร็จตามเวลา";
  } else if (status) {
    icon = "info";
    title = "บันทึกสำเร็จ";
    text = "สถานะ: " + status;
  }

  await Swal.fire({
    icon,
    title,
    text,
    confirmButtonText: "ตกลง"
  });
}
async function openQrScanCard() {
  const selectedItem = getSelectedPlanItem();
  if (!selectedItem) {
    setText(el.checkpointStatus, "กรุณาเลือกจุดตรวจก่อนสแกน QR");
    return;
  }
  if (!window.Swal || !window.Html5Qrcode) {
    setText(el.checkpointStatus, "อุปกรณ์ไม่รองรับสแกนกล้อง");
    return;
  }

  const readerId = "swalQrReader";
  let scanner = null;
  await Swal.fire({
    title: "สแกน QR จุดตรวจ",
    html: `<div id="${readerId}" style="min-height:280px;border-radius:10px;overflow:hidden;background:#0a1f37"></div>`,
    showCancelButton: true,
    confirmButtonText: "ปิด",
    cancelButtonText: "ยกเลิก",
    didOpen: () => {
      scanner = new Html5Qrcode(readerId);
      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (decodedText) => {
          const expectedQr = getExpectedQrForSelectedPoint(selectedItem);
          const actualQr = String(decodedText || "").trim();
          if (expectedQr && actualQr !== expectedQr) {
            setText(el.checkpointStatus, "สแกน QR ไม่ตรงจุด");
            if (navigator && typeof navigator.vibrate === "function") {
              navigator.vibrate([180, 120, 180]);
            }
            if (window.Swal && Swal.isVisible()) {
              Swal.showValidationMessage("สแกน QR ไม่ตรงจุด");
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
          setText(el.qrStepStatus, `สแกนแล้ว: ${decodedText}`);
          updateActionCardsState();
          Swal.close();
        },
        () => {}
      ).catch(() => {
        setText(el.checkpointStatus, "เปิดกล้องไม่สำเร็จ");
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
    reader.onerror = () => reject(new Error("à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸­à¹ˆà¸²à¸™à¹„à¸Ÿà¸¥à¹Œà¹„à¸”à¹‰"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¸£à¸¹à¸›à¹„à¸”à¹‰"));
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
    im.onerror = () => reject(new Error("à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸›à¸£à¸°à¸¡à¸§à¸¥à¸œà¸¥à¸£à¸¹à¸›à¹„à¸”à¹‰"));
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

  const lines = [`à¸§à¸±à¸™à¸—à¸µà¹ˆ ${dateText}`, gpsText];
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












