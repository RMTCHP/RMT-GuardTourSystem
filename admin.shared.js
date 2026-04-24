const API_URL = "https://script.google.com/macros/s/AKfycbw5n09onxcuAr9XG7k8j-3GhbumAD5zk2iptjU8-_uG-HHG849-DFNzVMgPk5n1vdE/exec";
const STORAGE_KEY = "guardtour.supervisor.session";
const DEFAULT_MAP_CENTER = { lat: 13.782472, lng: 100.971472 };
const DEFAULT_GOOGLE_MAPS_URL = "https://www.google.com/maps?q=13.782472,100.971472";

const state = {
  supervisor: null,
  guards: [],
  checkpoints: [],
  templates: [],
  templateRouteCache: {},
  liveLogsCache: {},
  dashboardSnapshotCache: {},
  liveLogs: [],
  shiftCheckpoints: {},
  charts: {},
  userTab: "admin",
  guardsLoaded: false,
  checkpointsLoaded: false,
  templatesLoaded: false,
  suppressLoading: false
};

const el = {};
let loadingCount = 0;

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
    throw new Error(`เครือข่ายมีปัญหา: ${err.message}`);
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

function switchView(name) {
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
    lower.includes("Ã Â¹â€žÃ Â¸Â¡Ã Â¹Ë†Ã Â¸ÂªÃ Â¸Â³Ã Â¹â‚¬Ã Â¸Â£Ã Â¹â€¡Ã Â¸Ë†") ||
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

function startLoading(title, text) {
  if (state.suppressLoading) return;
  loadingCount += 1;
  if (loadingCount > 1) return;
  if (!window.Swal) return;
  Swal.fire({
    title: title || "กำลังโหลดข้อมูล...",
    text: text || "โปรดรอสักครู่",
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading()
  });
}

function stopLoading(forceClose) {
  if (state.suppressLoading && !forceClose) return;
  if (forceClose) {
    loadingCount = 0;
    if (!window.Swal) return;
    Swal.close();
    return;
  }
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

















