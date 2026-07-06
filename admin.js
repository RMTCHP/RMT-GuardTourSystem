window.addEventListener("DOMContentLoaded", async () => {
  bindElements();
  bindEvents();

  startTopClock();
  if (el.reportDate) el.reportDate.value = toYmd(new Date());
  if (!state.assignCalendarMonth) {
    const now = new Date();
    state.assignCalendarMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (el.assignDate) el.assignDate.value = toYmd(new Date());

  const session = loadSession();
  if (session.supervisor_id) {
    startLoading("กำลังโหลดข้อมูล...", "โปรดรอสักครู่");
    state.suppressLoading = true;
    await login(true, session);
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
    "assignDate",
    "loadBtn",
    "kpiShifts",
    "kpiChecked",
    "kpiGuards",
    "kpiIncidents",
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
    "templatesTableBody",
    "assignShiftSettingsBtn",
    "assignPrevMonthBtn",
    "assignNextMonthBtn",
    "assignMonthLabel",
    "assignCalendarGrid"
  ].forEach((id) => {
    el[id] = document.getElementById(id);
  });
}

function bindEvents() {
  if (el.loadBtn) el.loadBtn.addEventListener("click", () => loadDashboard(false, true));
  if (el.assignPrevMonthBtn) {
    el.assignPrevMonthBtn.addEventListener("click", () => {
      const base = state.assignCalendarMonth || new Date();
      state.assignCalendarMonth = new Date(base.getFullYear(), base.getMonth() - 1, 1);
      ensureAssignmentsLoaded(false, true);
    });
  }
  if (el.assignNextMonthBtn) {
    el.assignNextMonthBtn.addEventListener("click", () => {
      const base = state.assignCalendarMonth || new Date();
      state.assignCalendarMonth = new Date(base.getFullYear(), base.getMonth() + 1, 1);
      ensureAssignmentsLoaded(false, true);
    });
  }
  if (el.topLogoutBtn) el.topLogoutBtn.addEventListener("click", logout);
  if (el.topUserBtn) {
    el.topUserBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleTopUserMenu();
    });
  }
  if (el.changePasswordBtn) el.changePasswordBtn.addEventListener("click", openChangePasswordSwal);

  document.addEventListener("click", (event) => {
    if (el.topUserMenuWrap && !el.topUserMenuWrap.contains(event.target)) {
      closeTopUserMenu();
    }
  });

  if (el.addUserBtn) {
    el.addUserBtn.addEventListener("click", () => {
      if (state.userTab === "admin") {
        openAddAdminSwal();
      } else {
        openAddUserSwal();
      }
    });
  }

  if (el.addCheckpointBtn) {
    el.addCheckpointBtn.addEventListener("click", async () => {
      await ensureCheckpointsLoaded(true);
      openCheckpointSwal();
    });
  }

  if (el.addTemplateBtn) {
    el.addTemplateBtn.addEventListener("click", async () => {
      await ensureCheckpointsLoaded(true, false);
      await ensureTemplatesLoaded(true, false);
      openTemplateSwal();
    });
  }

  if (el.assignShiftSettingsBtn) {
    el.assignShiftSettingsBtn.addEventListener("click", async () => {
      await ensureShiftSettingsLoaded(true, false);
      openShiftSettingsSwal();
    });
  }

  if (el.userTabAdmin) el.userTabAdmin.addEventListener("click", () => switchUserTab("admin"));
  if (el.userTabGuards) el.userTabGuards.addEventListener("click", () => switchUserTab("guards"));

  document.querySelectorAll(".menu-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.getAttribute("data-panel");
      switchFuncPanel(panel || "overview");
    });
  });
}

async function login(silentMode, sessionData) {
  const session = sessionData || loadSession();
  const supervisorId = String(session.supervisor_id || "").trim();

  if (!supervisorId) {
    window.location.href = "index.html";
    return false;
  }

  try {
    state.supervisor = {
      supervisor_id: supervisorId,
      username: session.username || supervisorId,
      name: session.name || supervisorId,
      email: session.email || ""
    };
    saveSession({
      supervisor_id: supervisorId,
      username: state.supervisor.username,
      name: state.supervisor.name,
      email: state.supervisor.email
    });
    el.topUserName.textContent = state.supervisor.name || state.supervisor.supervisor_id;
    el.topUserAvatar.textContent = getInitials(state.supervisor.name || state.supervisor.supervisor_id);
    switchView("dashboard");
    switchFuncPanel("overview");
    switchUserTab("admin");

    const admins = await ensureAdminsLoaded(true);
    const liveAdmin = (admins || []).find((row) => String(row.supervisor_id || "") === supervisorId);
    if (liveAdmin) {
      state.supervisor = {
        supervisor_id: liveAdmin.supervisor_id || supervisorId,
        username: liveAdmin.username || state.supervisor.username,
        name: liveAdmin.name || state.supervisor.name,
        email: liveAdmin.email || state.supervisor.email
      };
      saveSession(state.supervisor);
      el.topUserName.textContent = state.supervisor.name || state.supervisor.supervisor_id;
      el.topUserAvatar.textContent = getInitials(state.supervisor.name || state.supervisor.supervisor_id);
    }

    await ensureGuardsLoaded(true);
    await loadDashboard(true);
    return true;
  } catch (err) {
    if (silentMode) {
      state.supervisor = {
        supervisor_id: session.supervisor_id || supervisorId,
        username: session.username || supervisorId,
        name: session.name || session.supervisor_id || supervisorId,
        email: session.email || ""
      };
      el.topUserName.textContent = state.supervisor.name || state.supervisor.supervisor_id;
      el.topUserAvatar.textContent = getInitials(state.supervisor.name || state.supervisor.supervisor_id);
      switchView("dashboard");
      switchFuncPanel("overview");
      switchUserTab("admin");
      await ensureAdminsLoaded(true);
      notify(`กู้คืนเซสชันสำเร็จ (โหมดออฟไลน์): ${err.message}`, "warning");
      return false;
    }

    clearSession();
    window.location.href = "index.html";
    return false;
  }
}

function logout() {
  closeTopUserMenu();
  state.supervisor = null;
  state.admins = [];
  state.adminsLoaded = false;
  state.guards = [];
  state.guardsLoaded = false;
  state.checkpoints = [];
  state.checkpointsLoaded = false;
  state.templates = [];
  state.templatesLoaded = false;
  state.shiftSettings = [];
  state.shiftSettingsLoaded = false;
  state.assignments = [];
  state.assignmentsByDateCache = {};
  state.assignmentsLoadedDate = "";
  state.templateRouteCache = {};
  state.liveLogsCache = {};
  state.dashboardSnapshotCache = {};
  state.dashboardChartsCache = {};
  state.shiftCheckpoints = {};
  destroyAllCharts();
  clearSession();

  if (el.topUserName) el.topUserName.textContent = "-";
  if (el.topUserAvatar) el.topUserAvatar.textContent = "--";

  renderAdminTable([]);
  renderGuardsTable([]);
  renderCheckpointsTable([]);
  renderTemplatesTable([]);
  renderAssignmentsBoard([], "");
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
  if (!el.topUserMenu || !el.topUserBtn) return;
  el.topUserMenu.classList.remove("show");
  el.topUserBtn.setAttribute("aria-expanded", "false");
}

function switchFuncPanel(panelName) {
  state.activePanel = panelName;

  document.querySelectorAll(".func-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `panel-${panelName}`);
  });
  document.querySelectorAll(".menu-item").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-panel") === panelName);
  });

  if (panelName === "users") {
    Promise.all([ensureAdminsLoaded(true), ensureGuardsLoaded(true)]);
    return;
  }
  if (panelName === "overview") {
    loadDashboard(false, false);
    return;
  }
  if (panelName === "checkpoints") {
    ensureCheckpointsLoaded(true, false);
    return;
  }
  if (panelName === "templates") {
    loadTemplateData(true);
    return;
  }
  if (panelName === "assign") {
    Promise.all([
      ensureGuardsLoaded(true, false),
      ensureTemplatesLoaded(true, false),
      ensureShiftSettingsLoaded(true, false)
    ]).finally(() => {
      ensureAssignmentsLoaded(false, false);
    });
    return;
  }
}

function switchUserTab(tabName) {
  state.userTab = tabName === "guards" ? "guards" : "admin";
  if (el.userTabAdmin) el.userTabAdmin.classList.toggle("active", state.userTab === "admin");
  if (el.userTabGuards) el.userTabGuards.classList.toggle("active", state.userTab === "guards");
  if (el.userPaneAdmin) el.userPaneAdmin.classList.toggle("active", state.userTab === "admin");
  if (el.userPaneGuards) el.userPaneGuards.classList.toggle("active", state.userTab === "guards");
  if (state.userTab === "admin") ensureAdminsLoaded(true, false);
  if (state.userTab === "guards") ensureGuardsLoaded(true, false);
}
