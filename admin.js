window.addEventListener("DOMContentLoaded", async () => {
  bindElements();
  bindEvents();

  startTopClock();
  el.reportDate.value = toYmd(new Date());
  el.liveDate.value = toYmd(new Date());
  const supervisorIdFromUrl = readQueryParam("supervisorId");
  if (supervisorIdFromUrl) {
    saveSession({ supervisor_id: supervisorIdFromUrl });
    clearQueryString();
  }

  const session = loadSession();
  if (session.supervisor_id) {
    startLoading("กำลังโหลดข้อมูล...", "โปรดรอสักครู่");
    state.suppressLoading = true;
    await login(true, session.supervisor_id);
    state.suppressLoading = false;
    stopLoading(true);
    return;
  }

  window.location.href = "index.html";
});

function bindElements() {
  [
    "todayText",
    "topUserAvatar",
    "topUserName",
    "topUserMenuWrap",
    "topUserBtn",
    "topUserMenu",
    "changePasswordBtn",
    "topLogoutBtn",
    "view-dashboard",
    "reportDate",
    "liveDate",
    "liveGuardFilter",
    "liveStatusFilter",
    "liveRefreshBtn",
    "liveTableBody",
    "loadBtn",
    "kpiShifts",
    "kpiChecked",
    "kpiLate",
    "kpiMissed",
    "kpiIncidents",
    "kpiCompliance",
    "chartRangeDays",
    "chartCompliance",
    "chartOperations",
    "chartShiftType",
    "summaryList",
    "incidentList",
    "addUserBtn",
    "userTabAdmin",
    "userTabGuards",
    "userPaneAdmin",
    "userPaneGuards",
    "adminTableBody",
    "guardsTableBody",
    "addCheckpointBtn",
    "checkpointsTableBody",
    "addTemplateBtn",
    "templatesTableBody"
  ].forEach((id) => {
    el[id] = document.getElementById(id);
  });
}

function bindEvents() {
  el.loadBtn.addEventListener("click", loadDashboard);
  el.liveRefreshBtn.addEventListener("click", loadLiveLogs);
  el.liveDate.addEventListener("change", loadLiveLogs);
  el.liveGuardFilter.addEventListener("change", loadLiveLogs);
  el.liveStatusFilter.addEventListener("change", loadLiveLogs);
  el.chartRangeDays.addEventListener("change", loadDashboard);
  el.topLogoutBtn.addEventListener("click", logout);
  el.topUserBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleTopUserMenu();
  });
  el.changePasswordBtn.addEventListener("click", openChangePasswordSwal);
  document.addEventListener("click", (event) => {
    if (!el.topUserMenuWrap.contains(event.target)) {
      closeTopUserMenu();
    }
  });
  el.addUserBtn.addEventListener("click", () => {
    if (state.userTab === "admin") {
      openAddAdminSwal();
    } else {
      openAddUserSwal();
    }
  });
  el.addCheckpointBtn.addEventListener("click", async () => {
    await ensureCheckpointsLoaded(true);
    openCheckpointSwal();
  });
  el.addTemplateBtn.addEventListener("click", async () => {
    await Promise.all([ensureGuardsLoaded(true), ensureCheckpointsLoaded(true), ensureTemplatesLoaded(true)]);
    openTemplateSwal();
  });
  el.userTabAdmin.addEventListener("click", () => switchUserTab("admin"));
  el.userTabGuards.addEventListener("click", () => switchUserTab("guards"));
  document.querySelectorAll(".menu-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.getAttribute("data-panel");
      switchFuncPanel(panel || "overview");
    });
  });
}

async function login(silentMode, forcedSupervisorId) {
  const supervisorId = String(forcedSupervisorId || "").trim();

  if (!supervisorId) {
    window.location.href = "index.html";
    return false;
  }

  try {
    const data = await callApi("supervisorLogin", { supervisorId });
    state.supervisor = data;
    saveSession({
      supervisor_id: supervisorId,
      name: data.name || "",
      email: data.email || ""
    });
    el.topUserName.textContent = data.name || data.supervisor_id;
    el.topUserAvatar.textContent = getInitials(data.name || data.supervisor_id);
    switchView("dashboard");
    switchFuncPanel("overview");
    switchUserTab("admin");
    renderAdminTable();
    await ensureGuardsLoaded(true);
    await loadDashboard(true);
    return true;
  } catch (err) {
    if (silentMode) {
      const session = loadSession();
      state.supervisor = {
        supervisor_id: session.supervisor_id || supervisorId,
        name: session.name || session.supervisor_id || supervisorId,
        email: session.email || ""
      };
      el.topUserName.textContent = state.supervisor.name || state.supervisor.supervisor_id;
      el.topUserAvatar.textContent = getInitials(state.supervisor.name || state.supervisor.supervisor_id);
      switchView("dashboard");
      switchFuncPanel("overview");
      switchUserTab("admin");
      renderAdminTable();
      notify(`กู้คืนเซสชันสำเร็จ (โหมดออฟไลน์): ${err.message}`, "warning");
      return false;
    } else {
      clearSession();
      window.location.href = "index.html";
      return false;
    }
  }
}

function logout() {
  closeTopUserMenu();
  state.supervisor = null;
  state.guards = [];
  state.guardsLoaded = false;
  state.checkpoints = [];
  state.checkpointsLoaded = false;
  state.templates = [];
  state.templatesLoaded = false;
  state.shiftCheckpoints = {};
  destroyAllCharts();
  clearSession();
  el.topUserName.textContent = "-";
  el.topUserAvatar.textContent = "--";
  renderAdminTable();
  renderGuardsTable([]);
  renderCheckpointsTable([]);
  renderTemplatesTable([]);
  switchFuncPanel("overview");
  switchUserTab("admin");
  window.location.href = "index.html";
}

function toggleTopUserMenu() {
  const isOpen = el.topUserMenu.classList.contains("show");
  el.topUserMenu.classList.toggle("show", !isOpen);
  el.topUserBtn.setAttribute("aria-expanded", isOpen ? "false" : "true");
}

function closeTopUserMenu() {
  el.topUserMenu.classList.remove("show");
  el.topUserBtn.setAttribute("aria-expanded", "false");
}

function switchFuncPanel(panelName) {
  document.querySelectorAll(".func-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `panel-${panelName}`);
  });
  document.querySelectorAll(".menu-item").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-panel") === panelName);
  });

  if (panelName === "users") {
    ensureGuardsLoaded();
    return;
  }
  if (panelName === "checkpoints") {
    ensureCheckpointsLoaded();
    return;
  }
  if (panelName === "templates") {
    loadTemplateData();
    return;
  }
  if (panelName === "live") {
    ensureGuardsLoaded().finally(() => loadLiveLogs());
  }
}

function switchUserTab(tabName) {
  state.userTab = tabName === "guards" ? "guards" : "admin";
  el.userTabAdmin.classList.toggle("active", state.userTab === "admin");
  el.userTabGuards.classList.toggle("active", state.userTab === "guards");
  el.userPaneAdmin.classList.toggle("active", state.userTab === "admin");
  el.userPaneGuards.classList.toggle("active", state.userTab === "guards");
}

