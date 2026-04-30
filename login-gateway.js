const API_URL = "https://script.google.com/macros/s/AKfycbz4Ztsb_gtS6c_dJkbpiVHicUaLi7AsJDq17tEp7A_PuAxApvGMOLaxcHHiVsJFnRs/exec";
const GUARD_SESSION_KEY = "guardtour.session";
const ADMIN_SESSION_KEY = "guardtour.supervisor.session";

window.addEventListener("DOMContentLoaded", () => {
  const userIdInput = document.getElementById("userId");
  const loginBtn = document.getElementById("loginBtn");
  const loginStatus = document.getElementById("loginStatus");

  if (!userIdInput || !loginBtn || !loginStatus) return;

  loginBtn.addEventListener("click", () => handleLogin(userIdInput, loginStatus));
  userIdInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleLogin(userIdInput, loginStatus);
    }
  });
});

async function handleLogin(userIdInput, loginStatus) {
  const userId = String(userIdInput.value || "").trim();
  if (!userId) {
    setStatus(loginStatus, "??????????????????????");
    await showMessage("warning", "??????????????????????", "???????????????????????????");
    return;
  }

  showLoading();
  setStatus(loginStatus, "??????????????????...");

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
      setStatus(loginStatus, "??????????? Admin ??????");
      window.location.href = `admin.html?supervisorId=${encodeURIComponent(userId)}`;
      return;
    }

    if (guardResult.status === "fulfilled") {
      localStorage.setItem(GUARD_SESSION_KEY, JSON.stringify({
        guardId: guardResult.value.guard_id || userId,
        activeShiftId: ""
      }));
      setStatus(loginStatus, "??????????? ??? ??????");
      window.location.href = `Guard.html?guardId=${encodeURIComponent(userId)}`;
      return;
    }

    const errorMessage = extractErrorMessage(adminResult, guardResult);
    throw new Error(errorMessage);
  } catch (err) {
    if (window.Swal) Swal.close();
    setStatus(loginStatus, `????????????????????: ${err.message}`);
    await showMessage("error", "????????????????????", err.message || "????????????????????????");
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
  return "????????????????????????";
}

function clearStoredSessions() {
  localStorage.removeItem(GUARD_SESSION_KEY);
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

function setStatus(node, message) {
  if (node) node.textContent = message || "";
}

function showLoading() {
  if (!window.Swal) return;
  Swal.fire({
    title: "????????????????",
    text: "?????????????",
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
    confirmButtonText: "????"
  });
}
