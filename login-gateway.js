const API_URL = "https://script.google.com/macros/s/AKfycbz4pyRObSzSc-wwc1TONzRFAbfsbM2l3c9xSDQ4KSn0esapVLGfIe-qVO-VbuIm0_w/exec";
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
    await showMessage("warning", "กรุณากรอกรหัสผู้ใช้งาน", "โปรดกรอกรหัส รปภ หรือ Admin ก่อนเข้าสู่ระบบ");
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
      await showMessage("success", "เข้าสู่ระบบสำเร็จ", "เข้าสู่ระบบในสิทธิ์ Admin");
      window.location.href = `admin.html?supervisorId=${encodeURIComponent(userId)}`;
      return;
    }

    if (guardResult.status === "fulfilled") {
      localStorage.setItem(GUARD_SESSION_KEY, JSON.stringify({
        guardId: guardResult.value.guard_id || userId,
        activeShiftId: ""
      }));
      await showMessage("success", "เข้าสู่ระบบสำเร็จ", "เข้าสู่ระบบในสิทธิ์ รปภ");
      window.location.href = `Guard.html?guardId=${encodeURIComponent(userId)}`;
      return;
    }

    const errorMessage = extractErrorMessage(adminResult, guardResult);
    throw new Error(errorMessage);
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

function extractErrorMessage(adminResult, guardResult) {
  const adminMessage = adminResult.status === "rejected" ? String(adminResult.reason?.message || "") : "";
  const guardMessage = guardResult.status === "rejected" ? String(guardResult.reason?.message || "") : "";

  if (guardMessage && !/Supervisor not found|Invalid password/i.test(guardMessage)) {
    return guardMessage;
  }
  if (adminMessage && !/Guard not found or inactive/i.test(adminMessage)) {
    return adminMessage;
  }
  return "ไม่พบรหัสผู้ใช้งานในระบบ";
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
    didOpen: () => Swal.showLoading()
  });
}

async function showMessage(icon, title, text) {
  if (!window.Swal) return;
  await Swal.fire({
    icon,
    title,
    text,
    confirmButtonText: "ตกลง"
  });
}







