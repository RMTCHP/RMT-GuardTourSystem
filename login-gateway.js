const API_URL = "https://script.google.com/macros/s/AKfycbwv90Jc3klv-TM6cJd88lWkpuru7hYDZRQ_s-zey13-GBWByV3JaoPSc8OqHuWqadQ/exec";
const GUARD_SESSION_KEY = "guardtour.session";
const ADMIN_SESSION_KEY = "guardtour.supervisor.session";

window.addEventListener("DOMContentLoaded", () => {
  const userIdInput = document.getElementById("userId");
  const loginBtn = document.getElementById("loginBtn");
  if (!userIdInput || !loginBtn) return;

  loginBtn.addEventListener("click", () => handleLogin(userIdInput));
  userIdInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleLogin(userIdInput);
    }
  });
});

async function handleLogin(userIdInput) {
  const userId = String(userIdInput.value || "").trim();
  if (!userId) {
    await showMessage("warning", "à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸£à¸«à¸±à¸ªà¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸‡à¸²à¸™", "à¹‚à¸›à¸£à¸”à¸à¸£à¸­à¸à¸£à¸«à¸±à¸ª à¸£à¸›à¸  à¸«à¸£à¸·à¸­ Admin à¸à¹ˆà¸­à¸™à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸š");
    return;
  }

  showLoading();

  try {
    const [adminResult, guardResult] = await Promise.allSettled([
      callApi("supervisorLogin", { supervisorId: userId }),
      callApi("loginGuard", { guardId: userId })
    ]);

    clearStoredSessions();

    if (adminResult.status === "fulfilled") {
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
        supervisor_id: adminResult.value.supervisor_id || userId,
        name: adminResult.value.name || "",
        email: adminResult.value.email || ""
      }));
      await showMessage("success", "à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¸ªà¸³à¹€à¸£à¹‡à¸ˆ", "à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¹ƒà¸™à¸ªà¸´à¸—à¸˜à¸´à¹Œ Admin");
      window.location.href = `admin.html?supervisorId=${encodeURIComponent(userId)}`;
      return;
    }

    if (guardResult.status === "fulfilled") {
      localStorage.setItem(GUARD_SESSION_KEY, JSON.stringify({
        guardId: guardResult.value.guard_id || userId,
        activeShiftId: ""
      }));
      await showMessage("success", "à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¸ªà¸³à¹€à¸£à¹‡à¸ˆ", "à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¹ƒà¸™à¸ªà¸´à¸—à¸˜à¸´à¹Œ à¸£à¸›à¸ ");
      window.location.href = `Guard.html?guardId=${encodeURIComponent(userId)}`;
      return;
    }

    const errorMessage = extractErrorMessage(adminResult, guardResult);
    throw new Error(errorMessage);
  } catch (err) {
    if (window.Swal) Swal.close();
    await showMessage("error", "à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ", err.message || "à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¹„à¸”à¹‰");
  }
}

async function callApi(action, payload) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.error || "API error");
  }

  return result.data;
}

function extractErrorMessage(adminResult, guardResult) {
  const adminMessage = adminResult.status === "rejected" ? String(adminResult.reason?.message || "") : "";
  const guardMessage = guardResult.status === "rejected" ? String(guardResult.reason?.message || "") : "";

  if (guardMessage && !/Supervisor not found|Invalid password/i.test(guardMessage)) {
    return guardMessage;
  }
  if (adminMessage && !/Guard not found or inactive/i.test(adminMessage)) {
    return adminMessage;
  }
  return "à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸«à¸±à¸ªà¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¹ƒà¸™à¸£à¸°à¸šà¸š";
}

function clearStoredSessions() {
  localStorage.removeItem(GUARD_SESSION_KEY);
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

function showLoading() {
  if (!window.Swal) return;
  Swal.fire({
    title: "à¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸‚à¹‰à¸­à¸¡à¸¹à¸¥...",
    text: "à¹‚à¸›à¸£à¸”à¸£à¸­à¸ªà¸±à¸à¸„à¸£à¸¹à¹ˆ",
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => Swal.showLoading()
  });
}

async function showMessage(icon, title, text) {
  if (!window.Swal) return;
  await Swal.fire({
    icon,
    title,
    text,
    confirmButtonText: "à¸•à¸à¸¥à¸‡"
  });
}

