function renderDashboard() {
  const total = state.shifts.length;
  const rows = state.summaryCache && Array.isArray(state.summaryCache.rows) ? state.summaryCache.rows : [];
  const checkedTotal = rows.reduce((sum, row) => sum + Number(row.checked || 0), 0);
  const incidentTotal = rows.reduce((sum, row) => sum + Number(row.incidents || 0), 0);
  const roundsDone = rows.length
    ? rows.reduce((sum, row) => sum + Number(row.rounds_done || 0), 0)
    : 0;
  const roundsTotal = rows.length
    ? rows.reduce((sum, row) => sum + Number(row.rounds_total || 0), 0)
    : (state.shifts || []).reduce((sum, sh) => sum + Number(sh.rounds_required || 1), 0);

  if (el.dbShiftTotal) el.dbShiftTotal.textContent = String(total);
  if (el.dbRoundProgress) el.dbRoundProgress.textContent = `${roundsDone}/${roundsTotal} \u0e23\u0e2d\u0e1a`;
  if (el.dbCheckedTotal) el.dbCheckedTotal.textContent = String(checkedTotal);
  if (el.dbIncidentTotal) el.dbIncidentTotal.textContent = String(incidentTotal);

  if (!state.shifts.length) {
    el.dashboardList.innerHTML = `
      <div class="dashboard-card dashboard-empty">
        <h4>\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e01\u0e30\u0e07\u0e32\u0e19\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a\u0e27\u0e31\u0e19\u0e19\u0e35\u0e49</h4>
        <p class="meta">\u0e01\u0e23\u0e38\u0e13\u0e32\u0e15\u0e23\u0e27\u0e08\u0e2a\u0e2d\u0e1a\u0e01\u0e32\u0e23 Assign \u0e07\u0e32\u0e19\u0e43\u0e19\u0e2b\u0e19\u0e49\u0e32 Admin</p>
      </div>
    `;
    return;
  }

  if (!rows.length) {
    el.dashboardList.innerHTML = state.shifts.map((sh) => {
      const checkpointCount = Array.isArray(sh.checkpoints) ? sh.checkpoints.length : 0;
      const roundsTotalLocal = Number(sh.rounds_required || 1);
      const status = String(sh.status || "OPEN").toUpperCase();
      const statusClass = status === "CLOSED" ? "badge badge-closed" : "badge badge-open";
      const roundPct = roundsTotalLocal > 0 ? 0 : 0;
      const checkPct = checkpointCount > 0 ? 0 : 0;

      return `
        <div class="dashboard-card dashboard-shift-card">
          <div class="dashboard-head">
            <h4>${escapeHtml(getShiftProfile(sh))}</h4>
            <span class="${statusClass}">${displayShiftStatus(status)}</span>
          </div>
          <p class="meta dashboard-time">\u0e40\u0e27\u0e25\u0e32 ${escapeHtml(sh.start_time || "-")} - ${escapeHtml(sh.end_time || "-")}</p>

          <div class="dashboard-progress-wrap">
            <div class="dashboard-progress-head"><span>\u0e04\u0e27\u0e32\u0e21\u0e04\u0e37\u0e1a\u0e2b\u0e19\u0e49\u0e32\u0e23\u0e2d\u0e1a</span><strong>0/${roundsTotalLocal}</strong></div>
            <div class="dashboard-progress-bar"><i style="width:${roundPct}%"></i></div>
          </div>
          <div class="dashboard-progress-wrap">
            <div class="dashboard-progress-head"><span>\u0e08\u0e38\u0e14\u0e17\u0e35\u0e48\u0e15\u0e23\u0e27\u0e08\u0e41\u0e25\u0e49\u0e27</span><strong>0/${checkpointCount}</strong></div>
            <div class="dashboard-progress-bar"><i style="width:${checkPct}%"></i></div>
          </div>

          <div class="dashboard-mini-grid">
            <div class="dashboard-mini-card mini-incident">
              <i class="material-symbols-outlined mini-icon" aria-hidden="true">notification_important</i>
              <span>\u0e40\u0e2b\u0e15\u0e38\u0e1c\u0e34\u0e14\u0e1b\u0e01\u0e15\u0e34</span><strong>0</strong>
            </div>
            <div class="dashboard-mini-card mini-late">
              <i class="material-symbols-outlined mini-icon" aria-hidden="true">schedule</i>
              <span>\u0e0a\u0e49\u0e32</span><strong>0</strong>
            </div>
            <div class="dashboard-mini-card mini-error">
              <i class="material-symbols-outlined mini-icon" aria-hidden="true">gpp_bad</i>
              <span>\u0e44\u0e21\u0e48\u0e1c\u0e48\u0e32\u0e19</span><strong>0</strong>
            </div>
          </div>
        </div>
      `;
    }).join("");
    return;
  }

  el.dashboardList.innerHTML = rows.map((row) => {
    const statusClass = row.done ? "badge badge-closed" : "badge badge-open";
    const statusText = row.done ? "\u0e04\u0e23\u0e1a\u0e41\u0e25\u0e49\u0e27" : "\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e04\u0e23\u0e1a";
    const roundsTotalLocal = Number(row.rounds_total || 0);
    const expectedLocal = Number(row.expected || 0);
    const roundPct = roundsTotalLocal > 0
      ? Math.min(100, Math.round((Number(row.rounds_done || 0) / roundsTotalLocal) * 100))
      : 0;
    const checkPct = expectedLocal > 0
      ? Math.min(100, Math.round((Number(row.checked || 0) / expectedLocal) * 100))
      : 0;
    return `
      <div class="dashboard-card dashboard-shift-card">
        <h4>${escapeHtml(row.name)}</h4>
        <div class="dashboard-head">
          <p class="meta dashboard-time">\u0e40\u0e27\u0e25\u0e32 ${escapeHtml(row.start)} - ${escapeHtml(row.end)}</p>
          <span class="${statusClass}">${statusText}</span>
        </div>

        <div class="dashboard-progress-wrap">
          <div class="dashboard-progress-head"><span>\u0e04\u0e27\u0e32\u0e21\u0e04\u0e37\u0e1a\u0e2b\u0e19\u0e49\u0e32\u0e23\u0e2d\u0e1a</span><strong>${row.rounds_done}/${row.rounds_total}</strong></div>
          <div class="dashboard-progress-bar"><i style="width:${roundPct}%"></i></div>
        </div>
        <div class="dashboard-progress-wrap">
          <div class="dashboard-progress-head"><span>\u0e08\u0e38\u0e14\u0e17\u0e35\u0e48\u0e15\u0e23\u0e27\u0e08\u0e41\u0e25\u0e49\u0e27</span><strong>${row.checked}/${row.expected}</strong></div>
          <div class="dashboard-progress-bar"><i style="width:${checkPct}%"></i></div>
        </div>

        <div class="dashboard-mini-grid">
          <div class="dashboard-mini-card mini-incident">
            <i class="material-symbols-outlined mini-icon" aria-hidden="true">notification_important</i>
            <span>\u0e40\u0e2b\u0e15\u0e38\u0e1c\u0e34\u0e14\u0e1b\u0e01\u0e15\u0e34</span><strong>${row.incidents}</strong>
          </div>
          <div class="dashboard-mini-card mini-late">
            <i class="material-symbols-outlined mini-icon" aria-hidden="true">schedule</i>
            <span>\u0e0a\u0e49\u0e32</span><strong>${row.late}</strong>
          </div>
          <div class="dashboard-mini-card mini-error">
            <i class="material-symbols-outlined mini-icon" aria-hidden="true">gpp_bad</i>
            <span>\u0e44\u0e21\u0e48\u0e1c\u0e48\u0e32\u0e19</span><strong>${row.invalid}</strong>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function loadGuardDashboardSummary(forceRefresh) {
  if (!state.guard) return;
  const cacheKey = getGuardSummaryCacheKey_();
  if (!forceRefresh && state.summaryCacheDate === cacheKey && state.summaryCache) return;

  try {
    const dates = getGuardRelevantSummaryDates_();
    const logResults = await Promise.allSettled(
      dates.map((date) => callApi("listCheckLogs", { date, guardId: state.guard.guard_id }))
    );
    const incidentResults = await Promise.allSettled(
      dates.map((date) => callApi("listIncidents", { date, guardId: state.guard.guard_id, status: "" }))
    );
    const logs = logResults.flatMap((res) => (
      res.status === "fulfilled" && Array.isArray(res.value) ? res.value : []
    ));
    const incidents = incidentResults.flatMap((res) => (
      res.status === "fulfilled" && Array.isArray(res.value) ? res.value : []
    ));
    const summary = buildGuardSummaryFromRows(logs, incidents);
    state.summaryCacheDate = cacheKey;
    state.summaryCache = summary;
    renderDashboard();
  } catch (_) {
    // keep fallback rendering from shifts only
  }
}

function getGuardRelevantSummaryDates_() {
  const dates = {};
  dates[toYmd(new Date())] = true;
  (state.shifts || []).forEach((shift) => {
    const startDate = String((shift && shift.date) || "").trim();
    const endDate = String((shift && shift.end_date) || "").trim();
    if (startDate) dates[startDate] = true;
    if (endDate) dates[endDate] = true;
  });
  return Object.keys(dates).filter(Boolean).sort();
}

function getGuardSummaryCacheKey_() {
  return getGuardRelevantSummaryDates_().join("|");
}

function buildGuardSummaryFromRows(logRows, incidentRows) {
  const shiftMap = {};
  const logCounterByShiftCp = {};
  (state.shifts || []).forEach((s) => {
    const shiftId = String(s.shift_id || "");
    const expected = Array.isArray(s.checkpoints) ? s.checkpoints.length : 0;
    const baseProgress = state.shiftProgressMap[shiftId] || {};
    const roundProgress = computeRoundProgressByCounter(s, baseProgress);
    shiftMap[shiftId] = {
      id: shiftId,
      name: getShiftProfile(s),
      start: String(s.start_time || "-"),
      end: String(s.end_time || "-"),
      expected,
      checked: 0,
      late: 0,
      invalid: 0,
      incidents: 0,
      rounds_total: Number(roundProgress.total || 0),
      rounds_done: Number(roundProgress.done || 0),
      done: false
    };
  });

  logRows.forEach((log) => {
    const shiftId = String(log.shift_id || "");
    if (!shiftMap[shiftId]) return;
    const status = String(log.status || "").toUpperCase();
    if (status === "ONTIME" || status === "LATE") {
      shiftMap[shiftId].checked += 1;
      if (status === "LATE") shiftMap[shiftId].late += 1;
      const cpId = String(log.checkpoint_id || "");
      if (cpId) {
        if (!logCounterByShiftCp[shiftId]) logCounterByShiftCp[shiftId] = {};
        logCounterByShiftCp[shiftId][cpId] = Number(logCounterByShiftCp[shiftId][cpId] || 0) + 1;
      }
    } else if (status.startsWith("INVALID")) {
      shiftMap[shiftId].invalid += 1;
    }
  });

  incidentRows.forEach((row) => {
    const shiftId = String(row.shift_id || "");
    if (!shiftMap[shiftId]) return;
    shiftMap[shiftId].incidents += 1;
  });

  const rows = Object.values(shiftMap).map((row) => {
    const shift = (state.shifts || []).find((s) => String(s.shift_id || "") === String(row.id || ""));
    if (shift) {
      const roundProgress = computeRoundProgressByCounter(shift, logCounterByShiftCp[row.id] || {});
      row.rounds_total = Number(roundProgress.total || row.rounds_total || 0);
      row.rounds_done = Number(roundProgress.done || 0);
    }
    row.done = row.expected > 0 && row.checked >= row.expected;
    return row;
  });
  const doneShifts = rows.filter((x) => x.done).length;
  return { rows, doneShifts };
}

function computeRoundProgressByCounter(shift, counterMap) {
  const checkpoints = Array.isArray(shift && shift.checkpoints) ? shift.checkpoints.slice() : [];
  if (!checkpoints.length) return { done: 0, total: 0 };

  checkpoints.sort((a, b) =>
    Number(a.round_no || 1) - Number(b.round_no || 1) ||
    Number(a.seq_no || 0) - Number(b.seq_no || 0)
  );

  const remaining = {};
  Object.keys(counterMap || {}).forEach((cpId) => {
    remaining[String(cpId)] = Number(counterMap[cpId] || 0);
  });

  const roundCounter = {};
  checkpoints.forEach((cp) => {
    const roundNo = Number(cp.round_no || 1);
    const cpId = String(cp.checkpoint_id || "");
    if (!roundCounter[roundNo]) roundCounter[roundNo] = { total: 0, done: 0 };
    roundCounter[roundNo].total += 1;

    if (cpId && Number(remaining[cpId] || 0) > 0) {
      roundCounter[roundNo].done += 1;
      remaining[cpId] = Number(remaining[cpId] || 0) - 1;
    }
  });

  const rounds = Object.keys(roundCounter).map((k) => roundCounter[k]);
  const total = rounds.length;
  const done = rounds.filter((r) => Number(r.total || 0) > 0 && Number(r.done || 0) >= Number(r.total || 0)).length;
  return { done, total };
}

function refreshQueueBanner() {
  // Queue runs in background; no dashboard KPI card for queue/sync anymore.
}

function invalidateGuardSummaryCache() {
  state.summaryCacheDate = "";
  state.summaryCache = null;
}

function isDashboardVisible() {
  return !!(el["view-dashboard"] && el["view-dashboard"].classList.contains("active"));
}
