async function loadDashboard(silentMode, forceReload) {
  if (!state.supervisor) return;
  if ((state.activePanel || "overview") !== "overview") return;

  const date = el.reportDate.value || toYmd(new Date());

  try {
    const snapshot = await buildDailyDashboardSnapshot(date, forceReload);
    if ((state.activePanel || "overview") !== "overview") return;

    const kpi = snapshot.kpi || {};
    el.kpiShifts.textContent = String(kpi.total_assignments || 0);
    el.kpiChecked.textContent = String(kpi.total_checked_points || 0);
    el.kpiGuards.textContent = String(kpi.total_guards || 0);
    el.kpiIncidents.textContent = String(kpi.total_incidents || 0);

    renderSummary(snapshot.summaryRows || []);
    renderIncidents(snapshot.incidents || []);
    renderDashboardCharts(snapshot, date);
  } catch (err) {
    notify(`โหลด Dashboard ไม่สำเร็จ: ${err.message}`, "error");
  }
}

function renderSummary(rows) {
  if (!rows.length) {
    el.summaryList.innerHTML = '<div class="item">ยังไม่มีงานที่มอบหมายในวันนี้</div>';
    return;
  }

  el.summaryList.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>กะงาน</th>
            <th>รปภ</th>
            <th>Template</th>
            <th>เวลา</th>
            <th>จุดทั้งหมด</th>
            <th>ตรวจแล้ว</th>
            <th>ช้า</th>
            <th>ตกหล่น</th>
            <th>ผิดจุด</th>
            <th>เหตุ</th>
            <th>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td>${escapeHtml(r.shift_name || "-")}</td>
              <td>${escapeHtml(formatGuardDisplay(r.guard_id, r.guard_name))}</td>
              <td>${escapeHtml(r.template_label || "-")}</td>
              <td>${escapeHtml(formatShiftTimeRange(r.start_time, r.end_time))}</td>
              <td>${Number(r.total_points || 0)}</td>
              <td>${Number(r.checked_points || 0)}</td>
              <td>${Number(r.late_points || 0)}</td>
              <td>${Number(r.missed_points || 0)}</td>
              <td>${Number(r.invalid_points || 0)}</td>
              <td>${Number(r.incidents_count || 0)}</td>
              <td>${escapeHtml(getDashboardStatusText(r))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderIncidents(rows) {
  if (!rows.length) {
    el.incidentList.innerHTML = '<div class="item">ไม่มีเหตุผิดปกติในวันนี้</div>';
    return;
  }

  el.incidentList.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>เวลา</th>
            <th>รปภ</th>
            <th>กะงาน</th>
            <th>ประเภท</th>
            <th>ระดับ</th>
            <th>รายละเอียด</th>
            <th>รูปภาพ</th>
            <th>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => {
            const photoUrl = String(r.photo_url || "").trim();
            const photoCell = photoUrl
              ? `<a class="btn row-btn" href="${escapeAttr(photoUrl)}" target="_blank" rel="noopener">ดูรูป</a>`
              : "-";

            return `
              <tr>
                <td>${escapeHtml(r.incident_time || "-")}</td>
                <td>${escapeHtml(formatGuardDisplay(r.guard_id, r.guard_name))}</td>
                <td>${escapeHtml(r.shift_name || "-")}</td>
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

async function buildDailyDashboardSnapshot(date, forceReload) {
  const supervisorId = state.supervisor?.supervisor_id || "";
  const cacheKey = `${supervisorId}|${date}`;
  if (!forceReload && state.dashboardSnapshotCache && state.dashboardSnapshotCache[cacheKey]) {
    return state.dashboardSnapshotCache[cacheKey];
  }

  const [assignmentRes, shiftsRes, logsRes, incidentsRes] = await Promise.all([
    callApi("listAssignments", { date }),
    callApi("listShifts", { date, supervisorId }),
    callApi("listCheckLogs", { supervisorId, date, guardId: "", status: "" }),
    callApi("listIncidents", { supervisorId, date, guardId: "", status: "" })
  ]);

  const guardMap = {};
  (state.guards || []).forEach((g) => {
    const guardId = String(g.guard_id || "").trim();
    if (guardId) guardMap[guardId] = g;
  });

  const allowedGuardIds = new Set(Object.keys(guardMap));
  const assignmentRowsRaw = Array.isArray(assignmentRes) ? assignmentRes : [];
  const shiftRowsRaw = Array.isArray(shiftsRes) ? shiftsRes : [];
  const logRowsRaw = Array.isArray(logsRes) ? logsRes : [];
  const incidentRowsRaw = Array.isArray(incidentsRes) ? incidentsRes : [];

  const assignmentRows = assignmentRowsRaw.filter((row) => {
    const guardId = String(row.guard_id || "").trim();
    return !allowedGuardIds.size || allowedGuardIds.has(guardId);
  });
  const shiftRows = shiftRowsRaw.filter((row) => {
    const guardId = String(row.guard_id || "").trim();
    return !allowedGuardIds.size || allowedGuardIds.has(guardId);
  });
  const logRows = logRowsRaw.filter((row) => {
    const guardId = String(row.guard_id || "").trim();
    return !allowedGuardIds.size || allowedGuardIds.has(guardId);
  });
  const incidentRows = incidentRowsRaw.filter((row) => {
    const guardId = String(row.guard_id || "").trim();
    return !allowedGuardIds.size || allowedGuardIds.has(guardId);
  });

  const uniqueTemplateIds = [...new Set(
    assignmentRows
      .map((row) => String(row.template_id || "").trim())
      .filter(Boolean)
  )];
  const templateRouteMap = await ensureDashboardTemplateRoutes(uniqueTemplateIds);

  const routeMap = await ensureDashboardShiftRoutes(shiftRows, forceReload);
  const shiftById = {};
  shiftRows.forEach((row) => {
    shiftById[String(row.shift_id || "")] = row;
  });

  const logsByShift = {};
  logRows.forEach((row) => {
    const shiftId = String(row.shift_id || "").trim();
    if (!shiftId) return;
    if (!logsByShift[shiftId]) logsByShift[shiftId] = [];
    logsByShift[shiftId].push(row);
  });

  const incidentsByShift = {};
  incidentRows.forEach((row) => {
    const shiftId = String(row.shift_id || "").trim();
    if (!shiftId) return;
    if (!incidentsByShift[shiftId]) incidentsByShift[shiftId] = [];
    incidentsByShift[shiftId].push(row);
  });

  const unusedShiftIds = new Set(Object.keys(shiftById));
  const summaryRows = [];

  assignmentRows.forEach((assignment) => {
    const matchedShift = pickBestShiftForAssignment(assignment, shiftRows, unusedShiftIds);
    if (matchedShift) {
      unusedShiftIds.delete(String(matchedShift.shift_id || ""));
    }

    const shiftId = String(matchedShift?.shift_id || "");
    const routeRows = shiftId ? (routeMap[shiftId] || []) : [];
    const templateId = String(assignment.template_id || "").trim();
    const templateRoutes = templateId ? (templateRouteMap[templateId] || []) : [];
    const effectiveRoutes = routeRows.length ? routeRows : templateRoutes;
    const effectiveLogs = shiftId ? (logsByShift[shiftId] || []) : [];
    const effectiveIncidents = shiftId ? (incidentsByShift[shiftId] || []) : [];

    summaryRows.push(buildDashboardSummaryRow({
      shiftId: shiftId || String(assignment.assign_id || ""),
      shiftName: assignment.shift_name || matchedShift?.shift_name || "-",
      guardId: assignment.guard_id || matchedShift?.guard_id || "",
      guardName: guardMap[String(assignment.guard_id || matchedShift?.guard_id || "")]?.name || "",
      templateLabel: assignment.template_label || assignment.template_id || "-",
      startTime: assignment.start_time || matchedShift?.start_time || "",
      endTime: assignment.end_time || matchedShift?.end_time || "",
      status: assignment.status || matchedShift?.status || "ACTIVE",
      routeRows: effectiveRoutes,
      logs: effectiveLogs,
      incidents: effectiveIncidents,
      sourceMode: "assignment"
    }));
  });

  unusedShiftIds.forEach((shiftId) => {
    const shift = shiftById[shiftId];
    if (!shift) return;
    summaryRows.push(buildDashboardSummaryRow({
      shiftId,
      shiftName: shift.shift_name || shiftId,
      guardId: shift.guard_id || "",
      guardName: guardMap[String(shift.guard_id || "")]?.name || "",
      templateLabel: shift.template_id || "-",
      startTime: shift.start_time || "",
      endTime: shift.end_time || "",
      status: shift.status || "OPEN",
      routeRows: routeMap[shiftId] || [],
      logs: logsByShift[shiftId] || [],
      incidents: incidentsByShift[shiftId] || [],
      sourceMode: "shift"
    }));
  });

  summaryRows.sort((a, b) =>
    String(a.shift_name || "").localeCompare(String(b.shift_name || "")) ||
    String(a.guard_id || "").localeCompare(String(b.guard_id || ""))
  );

  const incidentTableRows = incidentRows
    .map((row) => {
      const shiftId = String(row.shift_id || "").trim();
      const summary = summaryRows.find((item) => String(item.shift_id || "") === shiftId);
      const guardId = String(row.guard_id || "").trim();
      return {
        ...row,
        shift_name: summary?.shift_name || shiftId || "-",
        guard_name: guardMap[guardId]?.name || ""
      };
    })
    .sort((a, b) => String(b.incident_time || "").localeCompare(String(a.incident_time || "")));

  const assignmentCount = assignmentRows.filter((row) => String(row.status || "ACTIVE").toUpperCase() === "ACTIVE").length;
  const guardIds = new Set(
    assignmentRows
      .filter((row) => String(row.status || "ACTIVE").toUpperCase() === "ACTIVE")
      .map((row) => String(row.guard_id || "").trim())
      .filter(Boolean)
  );
  if (!guardIds.size) {
    summaryRows.forEach((row) => {
      const guardId = String(row.guard_id || "").trim();
      if (guardId) guardIds.add(guardId);
    });
  }

  const checkedTotal = summaryRows.reduce((sum, row) => sum + Number(row.checked_points || 0), 0);
  const lateTotal = summaryRows.reduce((sum, row) => sum + Number(row.late_points || 0), 0);
  const missedTotal = summaryRows.reduce((sum, row) => sum + Number(row.missed_points || 0), 0);
  const invalidTotal = summaryRows.reduce((sum, row) => sum + Number(row.invalid_points || 0), 0);
  const totalPoints = summaryRows.reduce((sum, row) => sum + Number(row.total_points || 0), 0);

  const snapshot = {
    kpi: {
      total_assignments: assignmentCount || summaryRows.length,
      total_checked_points: checkedTotal,
      total_guards: guardIds.size,
      total_incidents: incidentTableRows.length,
      total_late_points: lateTotal,
      total_missed_points: missedTotal,
      total_invalid_points: invalidTotal,
      total_points: totalPoints
    },
    summaryRows,
    incidents: incidentTableRows,
    logs: logRows
  };

  if (!state.dashboardSnapshotCache) state.dashboardSnapshotCache = {};
  state.dashboardSnapshotCache[cacheKey] = snapshot;
  return snapshot;
}

async function ensureDashboardTemplateRoutes(templateIds) {
  if (!state.templateRouteCache) state.templateRouteCache = {};
  const missing = templateIds.filter((id) => id && !Array.isArray(state.templateRouteCache[id]));
  if (missing.length) {
    const results = await Promise.allSettled(
      missing.map((templateId) => callApi("listTemplateCheckpoints", { templateId }))
    );
    results.forEach((result, index) => {
      const templateId = missing[index];
      state.templateRouteCache[templateId] = result.status === "fulfilled" && Array.isArray(result.value)
        ? result.value
        : [];
    });
  }
  const out = {};
  templateIds.forEach((id) => {
    out[id] = Array.isArray(state.templateRouteCache[id]) ? state.templateRouteCache[id] : [];
  });
  return out;
}

async function ensureDashboardShiftRoutes(shiftRows, forceReload) {
  const routeMap = {};
  const missingShiftIds = [];

  shiftRows.forEach((shift) => {
    const shiftId = String(shift.shift_id || "").trim();
    if (!shiftId) return;
    const cached = state.shiftCheckpoints ? state.shiftCheckpoints[shiftId] : null;
    if (Array.isArray(cached) && !forceReload) {
      routeMap[shiftId] = cached;
      return;
    }
    missingShiftIds.push(shiftId);
  });

  if (missingShiftIds.length) {
    const results = await Promise.allSettled(
      missingShiftIds.map((shiftId) => callApi("listShiftCheckpoints", { shiftId }))
    );
    results.forEach((result, index) => {
      const shiftId = missingShiftIds[index];
      const rows = result.status === "fulfilled" && Array.isArray(result.value) ? result.value : [];
      if (!state.shiftCheckpoints) state.shiftCheckpoints = {};
      state.shiftCheckpoints[shiftId] = rows;
      routeMap[shiftId] = rows;
    });
  }

  return routeMap;
}

function pickBestShiftForAssignment(assignment, shiftRows, unusedShiftIds) {
  const assignGuardId = String(assignment.guard_id || "").trim();
  const assignShiftName = String(assignment.shift_name || "").trim().toUpperCase();
  const assignStart = normalizeTimeForCompare(assignment.start_time);
  const assignEnd = normalizeTimeForCompare(assignment.end_time);

  let best = null;
  let bestScore = -1;

  shiftRows.forEach((shift) => {
    const shiftId = String(shift.shift_id || "").trim();
    if (!shiftId || !unusedShiftIds.has(shiftId)) return;

    let score = 0;
    if (String(shift.guard_id || "").trim() === assignGuardId) score += 4;
    if (String(shift.shift_name || "").trim().toUpperCase() === assignShiftName) score += 3;
    if (normalizeTimeForCompare(shift.start_time) === assignStart) score += 2;
    if (normalizeTimeForCompare(shift.end_time) === assignEnd) score += 2;
    if (String(shift.template_id || "").trim() === String(assignment.template_id || "").trim()) score += 1;

    if (score > bestScore) {
      best = shift;
      bestScore = score;
    }
  });

  return bestScore > 0 ? best : null;
}

function buildDashboardSummaryRow(payload) {
  const routeRows = Array.isArray(payload.routeRows) ? payload.routeRows : [];
  const logs = Array.isArray(payload.logs) ? payload.logs : [];
  const incidents = Array.isArray(payload.incidents) ? payload.incidents : [];

  const expectedCount = {};
  routeRows.forEach((row) => {
    const checkpointId = String(row.checkpoint_id || "").trim();
    if (!checkpointId) return;
    expectedCount[checkpointId] = Number(expectedCount[checkpointId] || 0) + 1;
  });

  const checkedCount = {};
  const lateCount = {};
  logs.forEach((log) => {
    const checkpointId = String(log.checkpoint_id || "").trim();
    const status = String(log.status || "").toUpperCase();
    if (!checkpointId) return;
    if (status === "ONTIME" || status === "LATE") {
      checkedCount[checkpointId] = Number(checkedCount[checkpointId] || 0) + 1;
    }
    if (status === "LATE") {
      lateCount[checkpointId] = Number(lateCount[checkpointId] || 0) + 1;
    }
  });

  const checkedFromLogs = logs.filter((log) => {
    const status = String(log.status || "").toUpperCase();
    return status === "ONTIME" || status === "LATE";
  }).length;
  const invalidPoints = logs.filter((log) => String(log.status || "").toUpperCase().startsWith("INVALID")).length;
  const lateFromLogs = logs.filter((log) => String(log.status || "").toUpperCase() === "LATE").length;

  const totalPoints = routeRows.length || checkedFromLogs + invalidPoints;
  const checkedPoints = routeRows.length
    ? Object.keys(expectedCount).reduce((sum, checkpointId) => sum + Math.min(Number(expectedCount[checkpointId] || 0), Number(checkedCount[checkpointId] || 0)), 0)
    : checkedFromLogs;
  const latePoints = routeRows.length
    ? Object.keys(expectedCount).reduce((sum, checkpointId) => sum + Math.min(Number(expectedCount[checkpointId] || 0), Number(lateCount[checkpointId] || 0)), 0)
    : lateFromLogs;
  const missedPoints = Math.max(0, totalPoints - checkedPoints);

  return {
    shift_id: payload.shiftId || "",
    shift_name: payload.shiftName || "-",
    guard_id: payload.guardId || "",
    guard_name: payload.guardName || "",
    template_label: payload.templateLabel || "-",
    start_time: payload.startTime || "",
    end_time: payload.endTime || "",
    total_points: totalPoints,
    checked_points: checkedPoints,
    late_points: latePoints,
    missed_points: missedPoints,
    invalid_points: invalidPoints,
    incidents_count: incidents.length,
    status: payload.status || "ACTIVE",
    source_mode: payload.sourceMode || "shift"
  };
}

function getDashboardStatusText(row) {
  const totalPoints = Number(row.total_points || 0);
  const checkedPoints = Number(row.checked_points || 0);
  const invalidPoints = Number(row.invalid_points || 0);
  const baseStatus = String(row.status || "").toUpperCase();

  if (baseStatus === "INACTIVE") return "ปิดใช้งาน";
  if (totalPoints > 0 && checkedPoints >= totalPoints) return "ครบแล้ว";
  if (checkedPoints > 0 || invalidPoints > 0) return "กำลังตรวจ";
  return "รอเริ่ม";
}

function normalizeTimeForCompare(value) {
  return String(value || "").trim().slice(0, 8);
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

function renderDashboardCharts(snapshot, dateYmd) {
  if (!window.Chart) return;

  const analytics = buildTodayChartAnalytics(snapshot, dateYmd);

  upsertChart("compliance", el.chartCompliance, {
    type: "doughnut",
    data: {
      labels: ["ตรวจตรงเวลา", "ตรวจช้า", "ตกหล่น", "ผิดจุด/พิกัด"],
      datasets: [{
        label: "จำนวนจุด",
        data: [
          analytics.today.ontime,
          analytics.today.late,
          analytics.today.missed,
          analytics.today.invalid
        ],
        backgroundColor: ["#2a9d8f", "#f4a261", "#e76f51", "#8d5cf6"],
        borderWidth: 0,
        hoverOffset: 10
      }]
    },
    options: baseChartOptions({
      cutout: "62%",
      plugins: {
        legend: { position: "bottom" }
      }
    })
  });

  upsertChart("ops", el.chartOperations, {
    type: "radar",
    data: {
      labels: analytics.byGuard.map((x) => x.guard),
      datasets: [
        {
          label: "ตรวจแล้ว",
          data: analytics.byGuard.map((x) => x.checked),
          borderColor: "#1b9aaa",
          backgroundColor: "rgba(27,154,170,0.16)",
          pointBackgroundColor: "#1b9aaa",
          pointRadius: 4
        },
        {
          label: "เหตุผิดปกติ",
          data: analytics.byGuard.map((x) => x.incidents),
          borderColor: "#e76f51",
          backgroundColor: "rgba(231,111,81,0.14)",
          pointBackgroundColor: "#e76f51",
          pointRadius: 4
        }
      ]
    },
    options: baseChartOptions({
      scales: {
        r: {
          beginAtZero: true,
          angleLines: { color: "rgba(26,57,92,0.08)" },
          grid: { color: "rgba(26,57,92,0.08)" },
          pointLabels: { color: "#24466d", font: { size: 11, weight: "600" } },
          ticks: {
            backdropColor: "transparent",
            color: "#3c5f86",
            precision: 0
          }
        }
      }
    })
  });

  upsertChart("shiftType", el.chartShiftType, {
    type: "bar",
    data: {
      labels: analytics.byHour.map((x) => x.hour),
      datasets: [
        {
          label: "จุดที่ตรวจ",
          data: analytics.byHour.map((x) => x.total),
          backgroundColor: "#1b9aaa",
          borderRadius: 6,
          maxBarThickness: 22
        },
        {
          label: "เหตุผิดปกติ",
          data: analytics.byHour.map((x) => x.incidents),
          backgroundColor: "#e76f51",
          borderRadius: 6,
          maxBarThickness: 22
        }
      ]
    },
    options: baseChartOptions({
      scales: {
        x: { stacked: false, grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    })
  });
}

function buildTodayChartAnalytics(snapshot, dateYmd) {
  const summaryRows = Array.isArray(snapshot?.summaryRows) ? snapshot.summaryRows : [];
  const logs = Array.isArray(snapshot?.logs) ? snapshot.logs : [];
  const incidents = Array.isArray(snapshot?.incidents) ? snapshot.incidents : [];
  const targetDate = String(dateYmd || "").trim();

  const today = {
    ontime: 0,
    late: 0,
    missed: 0,
    invalid: 0
  };

  const guardAgg = {};
  summaryRows.forEach((row) => {
    const checked = Number(row.checked_points || 0);
    const late = Number(row.late_points || 0);
    const missed = Number(row.missed_points || 0);
    const invalid = Number(row.invalid_points || 0);
    const guardKey = formatGuardDisplay(row.guard_id, row.guard_name);

    today.ontime += Math.max(0, checked - late);
    today.late += late;
    today.missed += missed;
    today.invalid += invalid;

    if (!guardAgg[guardKey]) {
      guardAgg[guardKey] = { guard: guardKey, checked: 0, incidents: 0 };
    }
    guardAgg[guardKey].checked += checked;
    guardAgg[guardKey].incidents += Number(row.incidents_count || 0);
  });

  let byGuard = Object.values(guardAgg);
  if (!byGuard.length) {
    byGuard = [{ guard: "ไม่มีข้อมูล", checked: 0, incidents: 0 }];
  }

  const hourMap = {};
  for (let h = 0; h < 24; h += 1) {
    const key = String(h).padStart(2, "0");
    hourMap[key] = { hour: `${key}:00`, total: 0, incidents: 0 };
  }

  logs.forEach((log) => {
    const scan = String(log.scan_time || "").trim();
    if (!scan) return;
    if (targetDate && toDateKey(scan) !== targetDate) return;
    const match = scan.match(/(\d{2}):(\d{2})(?::\d{2})?$/);
    if (!match) return;
    const hour = match[1];
    if (hourMap[hour]) hourMap[hour].total += 1;
  });

  incidents.forEach((row) => {
    const incidentTime = String(row.incident_time || "").trim();
    if (!incidentTime) return;
    if (targetDate && toDateKey(incidentTime) !== targetDate) return;
    const match = incidentTime.match(/(\d{2}):(\d{2})(?::\d{2})?$/);
    if (!match) return;
    const hour = match[1];
    if (hourMap[hour]) hourMap[hour].incidents += 1;
  });

  const byHour = Object.keys(hourMap)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => hourMap[key]);

  return { today, byGuard, byHour };
}

function upsertChart(key, canvasEl, config) {
  if (!canvasEl || !window.Chart) return;
  if (state.charts[key]) {
    state.charts[key].destroy();
  }
  state.charts[key] = new Chart(canvasEl.getContext("2d"), config);
}

function baseChartOptions(extra) {
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 900,
      easing: "easeOutQuart"
    },
    interaction: {
      mode: "index",
      intersect: false
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#24466d",
          boxWidth: 16,
          boxHeight: 10,
          usePointStyle: true,
          pointStyle: "roundedRect",
          font: { size: 12, weight: "600" }
        }
      },
      tooltip: {
        backgroundColor: "rgba(20,44,74,0.96)",
        titleColor: "#ffffff",
        bodyColor: "#e6f1ff",
        padding: 10
      }
    },
    scales: {
      x: {
        ticks: { color: "#3c5f86", font: { size: 11 } },
        grid: { color: "rgba(26,57,92,0.08)" }
      },
      y: {
        ticks: { color: "#3c5f86", font: { size: 11 } },
        grid: { color: "rgba(26,57,92,0.08)" }
      }
    }
  };
  return deepMerge(base, extra || {});
}
function deepMerge(base, override) {
  const output = { ...base };
  Object.keys(override || {}).forEach((key) => {
    const ov = override[key];
    const bv = output[key];
    if (ov && typeof ov === "object" && !Array.isArray(ov) && bv && typeof bv === "object" && !Array.isArray(bv)) {
      output[key] = deepMerge(bv, ov);
    } else {
      output[key] = ov;
    }
  });
  return output;
}
function destroyAllCharts() {
  Object.keys(state.charts || {}).forEach((key) => {
    try {
      state.charts[key].destroy();
    } catch (_) {
      // ignore destroy errors
    }
  });
  state.charts = {};
}
