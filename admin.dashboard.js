async function loadDashboard(silentMode) {
  if (!state.supervisor) return;

  const date = el.reportDate.value || toYmd(new Date());
  const days = Number(el.chartRangeDays.value || 30);
  if (!silentMode) notify("กำลังโหลด Dashboard...");

  try {
    const [snapshot, chartData] = await Promise.all([
      buildDailyDashboardSnapshot(date),
      callApi("getDashboardCharts", {
        supervisorId: state.supervisor.supervisor_id,
        endDate: date,
        days
      })
    ]);

    const kpi = snapshot.kpi || {};
    el.kpiShifts.textContent = String(kpi.total_shifts || 0);
    el.kpiChecked.textContent = String(kpi.total_checked_points || 0);
    el.kpiLate.textContent = String(kpi.total_late_points || 0);
    el.kpiMissed.textContent = String(kpi.total_missed_points || 0);
    el.kpiIncidents.textContent = String(kpi.total_incidents || 0);
    el.kpiCompliance.textContent = `${Number(kpi.avg_compliance_pct || 0).toFixed(2)}%`;

    renderSummary(snapshot.summaryRows || []);
    renderIncidents(snapshot.incidents || []);

    const hasApiCharts = hasDashboardChartData(chartData);
    if (hasApiCharts) {
      renderDashboardCharts(chartData || {});
      if (!silentMode) notify("โหลด Dashboard สำเร็จ");
      return;
    }

    const fallback = await buildFallbackDashboardFromLogs(date, days);
    renderDashboardCharts(fallback.charts || {});
    if (!silentMode) notify("โหลด Dashboard สำเร็จ");
  } catch (err) {
    notify(`โหลด Dashboard ไม่สำเร็จ: ${err.message}`);
  }
}

function renderSummary(rows) {
  if (!rows.length) {
    el.summaryList.innerHTML = '<div class="item">No shift data</div>';
    return;
  }
  el.summaryList.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Shift</th>
            <th>Guard</th>
            <th>Time</th>
            <th>Total</th>
            <th>Checked</th>
            <th>Late</th>
            <th>Missed</th>
            <th>Invalid</th>
            <th>Incidents</th>
            <th>Compliance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td>${escapeHtml(r.shift_name || r.shift_id || "-")}</td>
              <td>${escapeHtml(formatGuardDisplay(r.guard_id, r.guard_name))}</td>
              <td>${escapeHtml(formatShiftTimeRange(r.start_time, r.end_time))}</td>
              <td>${Number(r.total_points || 0)}</td>
              <td>${Number(r.checked_points || 0)}</td>
              <td>${Number(r.late_points || 0)}</td>
              <td>${Number(r.missed_points || 0)}</td>
              <td>${Number(r.invalid_points || 0)}</td>
              <td>${Number(r.incidents_count || 0)}</td>
              <td>${Number(r.compliance_pct || 0).toFixed(2)}%</td>
              <td>${escapeHtml(r.status || "-")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderIncidents(rows) {
  if (!rows.length) {
    el.incidentList.innerHTML = '<div class="item">No incidents</div>';
    return;
  }
  el.incidentList.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Guard</th>
            <th>Shift</th>
            <th>Type</th>
            <th>Severity</th>
            <th>Detail</th>
            <th>Photo</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => {
            const photoUrl = String(r.photo_url || "").trim();
            const photoCell = photoUrl
              ? `<a class="btn row-btn" href="${escapeAttr(photoUrl)}" target="_blank" rel="noopener">View</a>`
              : "-";
            return `
              <tr>
                <td>${escapeHtml(r.incident_time || "-")}</td>
                <td>${escapeHtml(formatGuardDisplay(r.guard_id, r.guard_name))}</td>
                <td>${escapeHtml(r.shift_name || r.shift_id || "-")}</td>
                <td>${escapeHtml(r.type || "-")}</td>
                <td>${escapeHtml(r.severity || "-")}</td>
                <td>${escapeHtml(r.detail || "-")}</td>
                <td>${photoCell}</td>
                <td>${escapeHtml(r.status || "-")}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function buildDailyDashboardSnapshot(date) {
  const supervisorId = state.supervisor?.supervisor_id || "";
  const [shifts, logs, incidents, templates] = await Promise.all([
    callApi("listShifts", { date, supervisorId }),
    callApi("listCheckLogs", { supervisorId, date, guardId: "", status: "" }),
    callApi("listIncidents", { supervisorId, date, guardId: "", status: "" }),
    callApi("listShiftTemplates", { supervisorId })
  ]);

  const shiftRows = Array.isArray(shifts) ? shifts : [];
  const logRows = Array.isArray(logs) ? logs : [];
  const incidentRows = Array.isArray(incidents) ? incidents : [];
  const templateRows = Array.isArray(templates) ? templates : [];
  const activeTemplateCount = templateRows.filter((row) => String(row.status || "").toUpperCase() === "ACTIVE").length;
  const shiftMapById = {};
  shiftRows.forEach((shift) => {
    shiftMapById[String(shift.shift_id || "")] = shift;
  });

  // Some days already have logs even when Shifts rows are missing or not yet aligned.
  // Build a union set so dashboard cards always reflect actual activity in the system.
  logRows.forEach((log) => {
    const shiftId = String(log.shift_id || "").trim();
    if (!shiftId || shiftMapById[shiftId]) return;
    shiftMapById[shiftId] = {
      shift_id: shiftId,
      date,
      guard_id: String(log.guard_id || ""),
      shift_name: shiftId,
      start_time: "",
      end_time: "",
      rounds_required: 0,
      template_id: "",
      status: "OPEN"
    };
  });

  const snapshotShifts = Object.values(shiftMapById);

  const routeResults = await Promise.allSettled(
    snapshotShifts.map((shift) => callApi("listShiftCheckpoints", { shiftId: shift.shift_id }))
  );

  const guardMap = {};
  (state.guards || []).forEach((g) => {
    guardMap[String(g.guard_id || "")] = g;
  });

  const routeMap = {};
  snapshotShifts.forEach((shift, index) => {
    const result = routeResults[index];
    routeMap[String(shift.shift_id || "")] = result.status === "fulfilled" && Array.isArray(result.value)
      ? result.value
      : [];
  });

  const logsByShift = {};
  logRows.forEach((log) => {
    const shiftId = String(log.shift_id || "");
    if (!logsByShift[shiftId]) logsByShift[shiftId] = [];
    logsByShift[shiftId].push(log);
  });

  const incidentsByShift = {};
  incidentRows.forEach((row) => {
    const shiftId = String(row.shift_id || "");
    if (!incidentsByShift[shiftId]) incidentsByShift[shiftId] = [];
    incidentsByShift[shiftId].push(row);
  });

  const summaryRows = snapshotShifts.map((shift) => {
    const shiftId = String(shift.shift_id || "");
    const routeRows = routeMap[shiftId] || [];
    const shiftLogs = logsByShift[shiftId] || [];
    const shiftIncidents = incidentsByShift[shiftId] || [];
    const expectedCount = {};
    const checkedCount = {};
    const lateCount = {};

    routeRows.forEach((row) => {
      const cp = String(row.checkpoint_id || "");
      if (!cp) return;
      expectedCount[cp] = Number(expectedCount[cp] || 0) + 1;
    });

    shiftLogs.forEach((log) => {
      const cp = String(log.checkpoint_id || "");
      const status = String(log.status || "").toUpperCase();
      if (!cp) return;
      if (status === "ONTIME" || status === "LATE") {
        checkedCount[cp] = Number(checkedCount[cp] || 0) + 1;
      }
      if (status === "LATE") {
        lateCount[cp] = Number(lateCount[cp] || 0) + 1;
      }
    });

    const totalPoints = routeRows.length || shiftLogs.filter((log) => {
      const status = String(log.status || "").toUpperCase();
      return status === "ONTIME" || status === "LATE" || status.startsWith("INVALID");
    }).length;
    const checkedPoints = Object.keys(expectedCount).reduce((sum, cp) => {
      return sum + Math.min(Number(expectedCount[cp] || 0), Number(checkedCount[cp] || 0));
    }, 0);
    const latePoints = Object.keys(expectedCount).reduce((sum, cp) => {
      return sum + Math.min(Number(expectedCount[cp] || 0), Number(lateCount[cp] || 0));
    }, 0);
    const checkedFromLogs = shiftLogs.filter((log) => {
      const status = String(log.status || "").toUpperCase();
      return status === "ONTIME" || status === "LATE";
    }).length;
    const lateFromLogs = shiftLogs.filter((log) => String(log.status || "").toUpperCase() === "LATE").length;
    const invalidPoints = shiftLogs.filter((log) => String(log.status || "").toUpperCase().startsWith("INVALID")).length;
    const effectiveCheckedPoints = routeRows.length ? checkedPoints : checkedFromLogs;
    const effectiveLatePoints = routeRows.length ? latePoints : lateFromLogs;
    const missedPoints = Math.max(0, totalPoints - effectiveCheckedPoints);
    const compliancePct = totalPoints ? Number(((effectiveCheckedPoints / totalPoints) * 100).toFixed(2)) : 0;
    const guardId = String(shift.guard_id || "");
    const guardName = guardMap[guardId]?.name || "";

    return {
      shift_id: shiftId,
      shift_name: shift.shift_name || shiftId,
      guard_id: guardId,
      guard_name: guardName,
      start_time: shift.start_time || "",
      end_time: shift.end_time || "",
      total_points: totalPoints,
      checked_points: effectiveCheckedPoints,
      late_points: effectiveLatePoints,
      missed_points: missedPoints,
      invalid_points: invalidPoints,
      incidents_count: shiftIncidents.length,
      compliance_pct: compliancePct,
      status: shift.status || "OPEN"
    };
  });

  const incidentTableRows = incidentRows.map((row) => {
    const shiftId = String(row.shift_id || "");
    const shift = snapshotShifts.find((item) => String(item.shift_id || "") === shiftId);
    const guardId = String(row.guard_id || "");
    return {
      ...row,
      shift_name: shift?.shift_name || shiftId,
      guard_name: guardMap[guardId]?.name || ""
    };
  });

  const totalShifts = activeTemplateCount;
  const totalChecked = summaryRows.reduce((sum, row) => sum + Number(row.checked_points || 0), 0);
  const totalLate = summaryRows.reduce((sum, row) => sum + Number(row.late_points || 0), 0);
  const totalMissed = summaryRows.reduce((sum, row) => sum + Number(row.missed_points || 0), 0);
  const avgCompliancePct = summaryRows.length
    ? summaryRows.reduce((sum, row) => sum + Number(row.compliance_pct || 0), 0) / summaryRows.length
    : 0;

  return {
    kpi: {
      total_shifts: totalShifts,
      total_checked_points: totalChecked,
      total_late_points: totalLate,
      total_missed_points: totalMissed,
      total_incidents: incidentTableRows.length,
      avg_compliance_pct: Number(avgCompliancePct.toFixed(2))
    },
    summaryRows,
    incidents: incidentTableRows
  };
}

function formatGuardDisplay(guardId, guardName) {
  const id = String(guardId || "").trim();
  const name = String(guardName || "").trim();
  if (id && name) return `${id} - ${name}`;
  return id || name || "-";
}

function formatShiftTimeRange(startTime, endTime) {
  const start = String(startTime || "").trim();
  const end = String(endTime || "").trim();
  if (!start && !end) return "-";
  if (!end) return start;
  if (!start) return end;
  return `${start} - ${end}`;
}

function renderDashboardCharts(data) {
  if (!window.Chart) return;

  const complianceTrend = Array.isArray(data.compliance_trend) ? data.compliance_trend : [];
  const dailyOps = Array.isArray(data.daily_operations) ? data.daily_operations : [];
  const byShiftType = Array.isArray(data.shift_type_performance) ? data.shift_type_performance : [];

  upsertChart("compliance", el.chartCompliance, {
    type: "line",
    data: {
      labels: complianceTrend.map((x) => String(x.date || "").slice(5)),
      datasets: [{
        label: "Compliance %",
        data: complianceTrend.map((x) => Number(x.compliance_pct || 0)),
        borderColor: "#1b9aaa",
        backgroundColor: "rgba(27,154,170,0.16)",
        tension: 0.3,
        fill: true
      }]
    },
    options: baseChartOptions({
      scales: { y: { beginAtZero: true, max: 100 } }
    })
  });

  upsertChart("ops", el.chartOperations, {
    type: "bar",
    data: {
      labels: dailyOps.map((x) => String(x.date || "").slice(5)),
      datasets: [
        { label: "Checked", data: dailyOps.map((x) => Number(x.checked || 0)), backgroundColor: "#2e8b57" },
        { label: "Missed", data: dailyOps.map((x) => Number(x.missed || 0)), backgroundColor: "#e76f51" },
        { label: "Invalid", data: dailyOps.map((x) => Number(x.invalid || 0)), backgroundColor: "#f4a261" }
      ]
    },
    options: baseChartOptions({
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true }
      }
    })
  });

  upsertChart("shiftType", el.chartShiftType, {
    type: "bar",
    data: {
      labels: byShiftType.map((x) => x.shift_type || "UNKNOWN"),
      datasets: [
        {
          label: "Avg Compliance %",
          data: byShiftType.map((x) => Number(x.avg_compliance_pct || 0)),
          backgroundColor: "#4c78a8"
        },
        {
          label: "Incidents",
          data: byShiftType.map((x) => Number(x.incidents || 0)),
          backgroundColor: "#f58518"
        }
      ]
    },
    options: baseChartOptions({ scales: { y: { beginAtZero: true } } })
  });
}

function hasDashboardChartData(data) {
  if (!data || typeof data !== "object") return false;
  if (Array.isArray(data.compliance_trend) && data.compliance_trend.length) return true;
  if (Array.isArray(data.daily_operations) && data.daily_operations.length) return true;
  if (Array.isArray(data.shift_type_performance) && data.shift_type_performance.length) return true;
  return false;
}

async function buildFallbackDashboardFromLogs(endDate, days) {
  const safeDays = Math.max(1, Number(days || 30));
  const dates = buildDateRangeLocal(endDate, safeDays);

  const responses = await Promise.allSettled(
    dates.map((date) => callApi("listCheckLogs", {
      supervisorId: state.supervisor?.supervisor_id || "",
      date,
      guardId: "",
      status: ""
    }))
  );

  const allLogs = [];
  responses.forEach((res) => {
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      allLogs.push(...res.value);
    }
  });

  const dayStats = {};
  dates.forEach((d) => {
    dayStats[d] = { checked: 0, late: 0, invalid: 0, total: 0 };
  });

  const shiftMap = {};
  const checkpointIssueMap = {};
  const shiftTypeMap = {
    DAY: { total: 0, checked: 0, invalid: 0 },
    NIGHT: { total: 0, checked: 0, invalid: 0 }
  };

  allLogs.forEach((log) => {
    const status = String(log.status || "").toUpperCase();
    const scanTime = String(log.scan_time || "");
    const dateKey = scanTime.slice(0, 10);
    const cpKey = String(log.checkpoint_id || "");
    const shiftId = String(log.shift_id || "");

    if (!dayStats[dateKey]) {
      dayStats[dateKey] = { checked: 0, late: 0, invalid: 0, total: 0 };
    }

    dayStats[dateKey].total += 1;

    if (status === "ONTIME" || status === "LATE") {
      dayStats[dateKey].checked += 1;
      if (status === "LATE") dayStats[dateKey].late += 1;
    } else if (status.startsWith("INVALID")) {
      dayStats[dateKey].invalid += 1;
      if (cpKey) checkpointIssueMap[cpKey] = Number(checkpointIssueMap[cpKey] || 0) + 1;
    }

    if (shiftId) {
      if (!shiftMap[shiftId]) {
        shiftMap[shiftId] = {
          shift_id: shiftId,
          guard_id: String(log.guard_id || "-"),
          total_points: 0,
          checked_points: 0,
          late_points: 0,
          missed_points: 0,
          incidents_count: 0,
          compliance_pct: 0
        };
      }
      shiftMap[shiftId].total_points += 1;
      if (status === "ONTIME" || status === "LATE") {
        shiftMap[shiftId].checked_points += 1;
      }
      if (status === "LATE") {
        shiftMap[shiftId].late_points += 1;
      }
    }

    const hh = Number(scanTime.slice(11, 13) || 0);
    const type = (hh >= 18 || hh < 6) ? "NIGHT" : "DAY";
    shiftTypeMap[type].total += 1;
    if (status === "ONTIME" || status === "LATE") shiftTypeMap[type].checked += 1;
    if (status.startsWith("INVALID")) shiftTypeMap[type].invalid += 1;
  });

  const complianceTrend = dates.map((d) => {
    const s = dayStats[d] || { total: 0, checked: 0 };
    const compliancePct = s.total ? (s.checked / s.total) * 100 : 0;
    return { date: d, compliance_pct: Number(compliancePct.toFixed(2)) };
  });

  const dailyOperations = dates.map((d) => {
    const s = dayStats[d] || { checked: 0, invalid: 0, total: 0 };
    const missed = Math.max(0, s.total - s.checked - s.invalid);
    return { date: d, checked: s.checked, missed, invalid: s.invalid };
  });

  const shiftTypePerformance = Object.keys(shiftTypeMap).map((type) => {
    const s = shiftTypeMap[type];
    const avgCompliance = s.total ? (s.checked / s.total) * 100 : 0;
    return {
      shift_type: type,
      total_shifts: s.total,
      avg_compliance_pct: Number(avgCompliance.toFixed(2)),
      incidents: 0
    };
  });

  const checkpointsById = {};
  (state.checkpoints || []).forEach((cp) => {
    checkpointsById[String(cp.checkpoint_id || "")] = cp;
  });

  const topProblemCheckpoints = Object.keys(checkpointIssueMap)
    .map((cpId) => ({
      checkpoint_id: cpId,
      checkpoint_name: checkpointsById[cpId]?.checkpoint_name || "",
      issues: Number(checkpointIssueMap[cpId] || 0)
    }))
    .sort((a, b) => b.issues - a.issues)
    .slice(0, 10);

  const summaryRows = Object.values(shiftMap).map((row) => {
    const total = Number(row.total_points || 0);
    const checked = Number(row.checked_points || 0);
    row.compliance_pct = total ? Number(((checked / total) * 100).toFixed(2)) : 0;
    return row;
  });

  const totalShifts = summaryRows.length;
  const totalChecked = summaryRows.reduce((n, r) => n + Number(r.checked_points || 0), 0);
  const totalLate = summaryRows.reduce((n, r) => n + Number(r.late_points || 0), 0);
  const totalMissed = summaryRows.reduce((n, r) => n + Number(r.missed_points || 0), 0);
  const avgCompliancePct = totalShifts
    ? summaryRows.reduce((n, r) => n + Number(r.compliance_pct || 0), 0) / totalShifts
    : 0;

  return {
    kpi: {
      total_shifts: totalShifts,
      total_checked_points: totalChecked,
      total_late_points: totalLate,
      total_missed_points: totalMissed,
      total_incidents: 0,
      avg_compliance_pct: Number(avgCompliancePct.toFixed(2))
    },
    summaryRows,
    charts: {
      compliance_trend: complianceTrend,
      daily_operations: dailyOperations,
      incidents_by_severity: { LOW: 0, MEDIUM: 0, HIGH: 0 },
      shift_type_performance: shiftTypePerformance,
      top_problem_checkpoints: topProblemCheckpoints
    }
  };
}

function upsertChart(key, canvasEl, config) {
  if (!canvasEl || !window.Chart) return;
  if (state.charts[key]) {
    state.charts[key].destroy();
  }
  state.charts[key] = new Chart(canvasEl.getContext("2d"), config);
}

function baseChartOptions(extra) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" }
    },
    ...extra
  };
}

function destroyAllCharts() {
  Object.keys(state.charts || {}).forEach((k) => {
    try {
      if (state.charts[k]) state.charts[k].destroy();
    } catch (_) {}
  });
  state.charts = {};
}



