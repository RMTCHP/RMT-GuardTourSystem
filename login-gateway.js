const API_URL = "https://script.google.com/macros/s/AKfycbyGeCsJDJ8pmlmiCCXZS_eVLumVFfphMEqHhZ_MPQlwKH8_XfcEN2HXO9EaR2_GRdA/exec";
const GUARD_SESSION_KEY = "guardtour.session";
const ADMIN_SESSION_KEY = "guardtour.supervisor.session";

window.addEventListener("DOMContentLoaded", () => {
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");
  if (!usernameInput || !passwordInput || !loginBtn) return;

  loginBtn.addEventListener("click", () => handleLogin(usernameInput, passwordInput));
  [usernameInput, passwordInput].forEach((input) => input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleLogin(usernameInput, passwordInput);
    }
  }));
});

async function handleLogin(usernameInput, passwordInput) {
  const username = String(usernameInput.value || "").trim();
  const password = String(passwordInput.value || "");
  if (!username) {
    await showMessage("warning", "กรุณากรอกชื่อผู้ใช้", "โปรดกรอกชื่อผู้ใช้ก่อนเข้าสู่ระบบ");
    return;
  }
  if (!password) {
    await showMessage("warning", "กรุณากรอกรหัสผ่าน", "โปรดกรอกรหัสผ่านก่อนเข้าสู่ระบบ");
    return;
  }

  showLoading();

  try {
    const loginResult = await callApi("identifyLogin", { username, password });
    clearStoredSessions();

    if (String(loginResult?.role || "").toLowerCase() === "admin" && loginResult.user) {
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
        supervisor_id: loginResult.user.supervisor_id || "",
        username: loginResult.user.username || username,
        name: loginResult.user.name || "",
        email: loginResult.user.email || ""
      }));
      await showMessage("success", "เข้าสู่ระบบสำเร็จ", "เข้าสู่ระบบในสิทธิ์ Admin");
      window.location.href = "admin.html";
      return;
    }

    if (String(loginResult?.role || "").toLowerCase() === "guard" && loginResult.user) {
      localStorage.setItem(GUARD_SESSION_KEY, JSON.stringify({
        guardId: loginResult.user.guard_id || "",
        username: loginResult.user.username || username,
        activeShiftId: ""
      }));
      await showMessage("success", "เข้าสู่ระบบสำเร็จ", "เข้าสู่ระบบในสิทธิ์ รปภ");
      window.location.href = "Guard.html";
      return;
    }
    throw new Error("ไม่สามารถระบุสิทธิ์ผู้ใช้งานได้");
  } catch (err) {
    if (window.Swal) Swal.close();
    await showMessage("error", "เข้าสู่ระบบไม่สำเร็จ", err.message || "ไม่สามารถเข้าสู่ระบบได้");
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

function clearStoredSessions() {
  localStorage.removeItem(GUARD_SESSION_KEY);
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

function showLoading() {
  if (!window.Swal) return;
  Swal.fire({
    title: "กำลังตรวจสอบข้อมูล...",
    text: "โปรดรอสักครู่",
    allowOutsideClick: false,
    allowEscapeKey: false,
    customClass: {
      popup: "guard-swal",
      title: "guard-swal-title",
      htmlContainer: "guard-swal-text"
    },
    didOpen: () => Swal.showLoading()
  });
}

async function showMessage(icon, title, text) {
  if (!window.Swal) return;
  await Swal.fire({
    icon,
    title,
    text,
    confirmButtonText: "ตกลง",
    customClass: {
      popup: "guard-swal",
      title: "guard-swal-title",
      htmlContainer: "guard-swal-text",
      confirmButton: "guard-swal-confirm"
    },
    buttonsStyling: false
  });
}


