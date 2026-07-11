async function ensureAdminsLoaded(silentMode, forceReload) {
  if (!state.supervisor) return [];
  if (state.adminsLoaded && !forceReload) {
    renderAdminTable(state.admins || []);
    return state.admins || [];
  }

  try {
    const rows = await callApi("listSupervisors", {});
    state.admins = Array.isArray(rows) ? rows : [];
    state.adminsLoaded = true;
    renderAdminTable(state.admins);
    return state.admins;
  } catch (err) {
    state.admins = [];
    state.adminsLoaded = false;
    renderAdminTable([]);
    if (!silentMode) notify(`โหลดข้อมูล Admin ไม่สำเร็จ: ${err.message}`, "error");
    return [];
  }
}

async function ensureGuardsLoaded(silentMode, forceReload) {
  if (!state.supervisor) return [];
  if (state.guardsLoaded && !forceReload) {
    renderGuardsTable(state.guards || []);
    return state.guards || [];
  }

  try {
    const rows = await callApi("listGuards", {});
    state.guards = Array.isArray(rows) ? rows : [];
    state.guardsLoaded = true;
    renderGuardsTable(state.guards);
    return state.guards;
  } catch (err) {
    state.guards = [];
    state.guardsLoaded = false;
    renderGuardsTable([]);
    if (!silentMode) notify(`โหลดข้อมูล รปภ ไม่สำเร็จ: ${err.message}`, "error");
    return [];
  }
}

async function ensureCheckpointsLoaded(silentMode, forceReload) {
  if (!state.supervisor) return [];
  if (state.checkpointsLoaded && !forceReload) {
    renderCheckpointsTable(state.checkpoints || []);
    return state.checkpoints || [];
  }

  try {
    const rows = await callApi("listCheckpoints", {});
    state.checkpoints = Array.isArray(rows) ? rows : [];
    state.checkpointsLoaded = true;
    renderCheckpointsTable(state.checkpoints);
    return state.checkpoints;
  } catch (err) {
    state.checkpoints = [];
    state.checkpointsLoaded = false;
    renderCheckpointsTable([]);
    if (!silentMode) notify(`โหลดข้อมูลจุดตรวจไม่สำเร็จ: ${err.message}`, "error");
    return [];
  }
}

async function ensureTemplatesLoaded(silentMode, forceReload) {
  if (!state.supervisor) return [];
  if (state.templatesLoaded && !forceReload) {
    renderTemplatesTable(state.templates || []);
    return state.templates || [];
  }

  try {
    const rows = await callApi("listShiftTemplates", {});
    state.templates = Array.isArray(rows) ? rows : [];
    state.templatesLoaded = true;
    renderTemplatesTable(state.templates);
    return state.templates;
  } catch (err) {
    state.templates = [];
    state.templatesLoaded = false;
    renderTemplatesTable([]);
    if (!silentMode) notify(`โหลดข้อมูล Template ไม่สำเร็จ: ${err.message}`, "error");
    return [];
  }
}

async function ensureAssignmentsLoaded(silentMode, forceReload) {
  if (!state.supervisor || !el.assignCalendarGrid) return [];
  const cacheKey = "__all__";

  if (!forceReload && Array.isArray(state.assignmentsByDateCache?.[cacheKey])) {
    state.assignments = state.assignmentsByDateCache[cacheKey];
    renderAssignmentsBoard(state.assignments);
    return state.assignments;
  }

  try {
    const rows = await callApi("listAssignments", {});
    state.assignments = Array.isArray(rows) ? rows : [];
    if (!state.assignmentsByDateCache) state.assignmentsByDateCache = {};
    state.assignmentsByDateCache[cacheKey] = state.assignments;
    state.assignmentsLoadedDate = cacheKey;
    renderAssignmentsBoard(state.assignments);
    return state.assignments;
  } catch (err) {
    state.assignments = [];
    renderAssignmentsBoard([]);
    if (!silentMode) notify(`โหลดข้อมูล Assign ไม่สำเร็จ: ${err.message}`, "error");
    return [];
  }
}

async function ensureShiftSettingsLoaded(silentMode, forceReload) {
  if (!state.supervisor) return [];
  if (state.shiftSettingsLoaded && !forceReload) {
    return state.shiftSettings || [];
  }

  try {
    const rows = await callApi("listShiftSettings", {});
    state.shiftSettings = Array.isArray(rows) ? rows : [];
    state.shiftSettingsLoaded = true;
    return state.shiftSettings;
  } catch (err) {
    state.shiftSettings = [];
    state.shiftSettingsLoaded = false;
    if (!silentMode) notify(`โหลดข้อมูล Shift Settings ไม่สำเร็จ: ${err.message}`, "error");
    return [];
  }
}

function renderAssignmentsBoard(rows) {
  if (!el.assignCalendarGrid || !el.assignMonthLabel) return;

  const monthBase = state.assignCalendarMonth || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthStart = new Date(monthBase.getFullYear(), monthBase.getMonth(), 1);
  const monthEnd = new Date(monthBase.getFullYear(), monthBase.getMonth() + 1, 0);
  const firstWeekday = monthStart.getDay();
  const totalDays = monthEnd.getDate();
  const list = Array.isArray(rows) ? rows : [];
  const todayKey = toYmd(new Date());
  const cells = [];

  el.assignMonthLabel.textContent = formatAssignMonthEnglish(monthStart);

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push('<div class="assign-day-placeholder" aria-hidden="true"></div>');
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    const dateKey = toYmd(date);
    const dayRows = list.filter((row) => String(row.assign_date || "") === dateKey);
    const dayShiftRows = dayRows.filter((row) => String(row.shift_code || "").toUpperCase() === "DAY");
    const nightShiftRows = dayRows.filter((row) => String(row.shift_code || "").toUpperCase() === "NIGHT");
    const hasDayAssignment = dayShiftRows.length > 0;
    const hasNightAssignment = nightShiftRows.length > 0;
    const hasAnyAssignment = hasDayAssignment || hasNightAssignment;
    const isFullyAssigned = hasDayAssignment && hasNightAssignment;
    const cellClasses = [
      "assign-day-cell",
      dateKey === todayKey ? "is-today" : "",
      hasAnyAssignment ? "has-assignment" : "is-unassigned",
      hasAnyAssignment ? (isFullyAssigned ? "is-fully-assigned" : "is-partial-assigned") : ""
    ].filter(Boolean).join(" ");

    cells.push(`
      <button class="${cellClasses}" type="button" data-assign-date="${escapeAttr(dateKey)}">
        <div class="assign-day-head">
          <span class="assign-day-num">${day}</span>
          ${dateKey === todayKey ? '<span class="assign-day-badge">วันนี้</span>' : ""}
        </div>
        <div class="assign-day-body">
          ${renderAssignShiftPill("DAY", dayShiftRows)}
          ${renderAssignShiftPill("NIGHT", nightShiftRows)}
        </div>
      </button>
    `);
  }

  const trailing = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < trailing; i += 1) {
    cells.push('<div class="assign-day-placeholder" aria-hidden="true"></div>');
  }

  el.assignCalendarGrid.innerHTML = cells.join("");
  bindAssignmentCalendarActions();
}

function renderAssignShiftPill(shiftCode, rows) {
  const list = Array.isArray(rows) ? rows : [];
  const isDay = String(shiftCode || "").toUpperCase() === "DAY";
  const shiftLabel = isDay ? "กะกลางวัน" : "กะกลางคืน";
  const iconSvg = isDay
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zm10.45 0l1.41 1.42 1.8-1.8-1.42-1.41-1.79 1.79zM12 4h1V1h-2v3h1zm7 9h3v-2h-3v2zm-7 7h-1v3h2v-3h-1zm8.45-2.05l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zM4 11H1v2h3v-2zm2.76 6.95l-1.79 1.8 1.41 1.41 1.8-1.79-1.42-1.42zM12 6a6 6 0 100 12 6 6 0 000-12z"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.74 15.35A9 9 0 0112.65 3.26 9 9 0 1019 19.61a8.96 8.96 0 001.74-4.26z"/></svg>';

  if (!list.length) {
    const emptyTitle = `${shiftLabel}: ยังไม่ได้ Assign`;
    return `
      <div class="assign-shift-pill is-empty is-${isDay ? "day" : "night"}" title="${escapeAttr(emptyTitle)}" aria-label="${escapeAttr(emptyTitle)}">
        <span class="assign-shift-icon">${iconSvg}</span>
      </div>
    `;
  }

  const templateNames = [...new Set(
    list.map((row) => String(row.template_label || row.template_id || "").trim()).filter(Boolean)
  )];
  const maxRoundsRequired = list.reduce((max, row) => {
    const rounds = Math.max(1, Number(row.rounds_required || 1));
    return Math.max(max, rounds);
  }, 1);
  const title = `${shiftLabel}: ${templateNames[0] || "-"} / รปภ ${list.length} คน / ${maxRoundsRequired} รอบ`;

  return `
    <div class="assign-shift-pill is-assigned is-${isDay ? "day" : "night"}" title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}">
      <span class="assign-shift-icon">${iconSvg}</span>
      <span class="assign-shift-round-badge">${maxRoundsRequired}</span>
    </div>
  `;
}

function bindAssignmentCalendarActions() {
  document.querySelectorAll("[data-assign-date]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dateKey = String(btn.getAttribute("data-assign-date") || "").trim();
      if (!dateKey) return;
      if (el.assignDate) el.assignDate.value = dateKey;
      openAssignDaySwal(dateKey);
    });
  });
}

function formatAssignMonthEnglish(date) {
  const d = Object.prototype.toString.call(date) === "[object Date]" ? date : new Date(date);
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(d);
}

