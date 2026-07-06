function isValidEmailInput(value) {
  const email = String(value || '').trim();
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function openAddAdminSwal(existingAdmin) {
  const isEdit = !!existingAdmin;
  if (!window.Swal) return;
  const result = await Swal.fire({
    title: isEdit ? "à¹à¸à¹‰à¹„à¸‚ Admin" : "à¹€à¸žà¸´à¹ˆà¸¡ Admin",
    width: 640,
    html: `
      <div class="swal-form-grid">
        <div class="swal-form-field">
          <label>Supervisor ID</label>
          <input id="swalSupervisorId" class="swal2-input" placeholder="à¹€à¸Šà¹ˆà¸™ 1234" value="${escapeAttr(isEdit ? (existingAdmin.supervisor_id || "") : "")}" ${isEdit ? "disabled" : ""}>
        </div>
        <div class="swal-form-field">
          <label>Username</label>
          <input id="swalSupervisorUsername" class="swal2-input" placeholder="Username" value="${escapeAttr(isEdit ? (existingAdmin.username || existingAdmin.supervisor_id || "") : "")}">
        </div>
        <div class="swal-form-field">
          <label>Name</label>
          <input id="swalSupervisorName" class="swal2-input" placeholder="à¸Šà¸·à¹ˆà¸­à¸œà¸¹à¹‰à¸”à¸¹à¹à¸¥" value="${escapeAttr(isEdit ? (existingAdmin.name || "") : "")}">
        </div>
        <div class="swal-form-field">
          <label>Email</label>
          <input id="swalSupervisorEmail" class="swal2-input" placeholder="à¸­à¸µà¹€à¸¡à¸¥" value="${escapeAttr(isEdit ? (existingAdmin.email || "") : "")}">
        </div>
        <div class="swal-form-field">
          <label>${isEdit ? "Password à¹ƒà¸«à¸¡à¹ˆ" : "Password"}</label>
          <input id="swalSupervisorPassword" class="swal2-input" type="password" placeholder="${isEdit ? "à¹€à¸§à¹‰à¸™à¸§à¹ˆà¸²à¸‡à¸«à¸²à¸à¹„à¸¡à¹ˆà¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™" : "à¸à¸³à¸«à¸™à¸”à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™"}">
        </div>
        <div class="swal-form-field">
          <label>Status</label>
          <select id="swalSupervisorStatus" class="swal2-select">
            <option value="active" ${(isEdit ? String(existingAdmin.status || "active") : "active").toLowerCase() === "active" ? "selected" : ""}>active</option>
            <option value="inactive" ${(isEdit ? String(existingAdmin.status || "") : "").toLowerCase() === "inactive" ? "selected" : ""}>inactive</option>
          </select>
        </div>
        <div class="swal-form-note">* à¸•à¹‰à¸­à¸‡à¸£à¸°à¸šà¸¸ Supervisor ID, Username à¹à¸¥à¸° Name</div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: isEdit ? "à¸šà¸±à¸™à¸—à¸¶à¸" : "à¹€à¸žà¸´à¹ˆà¸¡",
    cancelButtonText: "à¸¢à¸à¹€à¸¥à¸´à¸",
    buttonsStyling: false,
    customClass: {
      popup: "swal-user-popup",
      confirmButton: "swal-btn swal-btn-primary",
      cancelButton: "swal-btn swal-btn-secondary"
    },
    preConfirm: () => {
      const supervisor_id = document.getElementById("swalSupervisorId").value.trim();
      const username = document.getElementById("swalSupervisorUsername").value.trim();
      const name = document.getElementById("swalSupervisorName").value.trim();
      const email = document.getElementById("swalSupervisorEmail").value.trim();
      const password = document.getElementById("swalSupervisorPassword").value;
      const status = document.getElementById("swalSupervisorStatus").value;
      if (!supervisor_id || !username || !name) {
        Swal.showValidationMessage("à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸ Supervisor ID, Username à¹à¸¥à¸° Name");
        return false;
      }
      if (!isValidEmailInput(email)) {
        Swal.showValidationMessage("à¸£à¸¹à¸›à¹à¸šà¸šà¸­à¸µà¹€à¸¡à¸¥à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡");
        return false;
      }
      if (!isEdit && !password) {
        Swal.showValidationMessage("à¸à¸£à¸¸à¸“à¸²à¸à¸³à¸«à¸™à¸”à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™");
        return false;
      }
      return { supervisor_id, username, name, email, password, status };
    }
  });
  if (!result.isConfirmed || !result.value) return;

  try {
    await callApi("upsertSupervisor", { payload: result.value });
    notify("à¸šà¸±à¸™à¸—à¸¶à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ Admin à¸ªà¸³à¹€à¸£à¹‡à¸ˆ");
    if (state.supervisor && String(state.supervisor.supervisor_id) === String(result.value.supervisor_id)) {
      state.supervisor = {
        ...state.supervisor,
        supervisor_id: result.value.supervisor_id,
        username: result.value.username,
        name: result.value.name,
        email: result.value.email,
        status: result.value.status
      };
      saveSession(state.supervisor);
      el.topUserName.textContent = state.supervisor.name || state.supervisor.supervisor_id;
      el.topUserAvatar.textContent = getInitials(state.supervisor.name || state.supervisor.supervisor_id);
    }
    state.adminsLoaded = false;
    await ensureAdminsLoaded(true, true);
  } catch (err) {
    notify(`à¸šà¸±à¸™à¸—à¸¶à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ Admin à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: ${err.message}`);
  }
}

function invalidateAdminCaches() {
  state.liveLogsCache = {};
  state.dashboardSnapshotCache = {};
  state.dashboardChartsCache = {};
}
async function openAddUserSwal(existingGuard) {
  if (!state.supervisor) return;
  const isEdit = !!existingGuard;

  if (!window.Swal) return;
  const result = await Swal.fire({
    title: isEdit ? "à¹à¸à¹‰à¹„à¸‚ User" : "à¹€à¸žà¸´à¹ˆà¸¡ User",
    width: 640,
    html: `
      <div class="swal-form-grid">
        <div class="swal-form-field">
          <label>Guard ID</label>
          <input id="swalGuardId" class="swal2-input" placeholder="à¹€à¸Šà¹ˆà¸™ 1001" value="${escapeAttr(isEdit ? existingGuard.guard_id : "")}" ${isEdit ? "disabled" : ""}>
        </div>
        <div class="swal-form-field">
          <label>Username</label>
          <input id="swalGuardUsername" class="swal2-input" placeholder="Username" value="${escapeAttr(isEdit ? (existingGuard.username || existingGuard.guard_id || "") : "")}">
        </div>
        <div class="swal-form-field">
          <label>Name</label>
          <input id="swalGuardName" class="swal2-input" placeholder="à¸Šà¸·à¹ˆà¸­ à¸£à¸›à¸ " value="${escapeAttr(isEdit ? (existingGuard.name || "") : "")}">
        </div>
        <div class="swal-form-field">
          <label>Phone</label>
          <input id="swalGuardPhone" class="swal2-input" placeholder="à¹€à¸šà¸­à¸£à¹Œà¹‚à¸—à¸£" value="${escapeAttr(isEdit ? (existingGuard.phone || "") : "")}">
        </div>
        <div class="swal-form-field">
          <label>Email</label>
          <input id="swalGuardEmail" class="swal2-input" placeholder="à¸­à¸µà¹€à¸¡à¸¥" value="${escapeAttr(isEdit ? (existingGuard.email || "") : "")}">
        </div>
        <div class="swal-form-field">
          <label>${isEdit ? "Password à¹ƒà¸«à¸¡à¹ˆ" : "Password"}</label>
          <input id="swalGuardPassword" class="swal2-input" type="password" placeholder="${isEdit ? "à¹€à¸§à¹‰à¸™à¸§à¹ˆà¸²à¸‡à¸«à¸²à¸à¹„à¸¡à¹ˆà¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™" : "à¸à¸³à¸«à¸™à¸”à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™"}">
        </div>
        <div class="swal-form-field swal-form-field-full">
          <label>Status</label>
          <select id="swalGuardStatus" class="swal2-select">
            <option value="active" ${(isEdit ? String(existingGuard.status || "") : "active") === "active" ? "selected" : ""}>active</option>
            <option value="inactive" ${(isEdit ? String(existingGuard.status || "") : "") === "inactive" ? "selected" : ""}>inactive</option>
          </select>
        </div>
        <div class="swal-form-note">* à¸•à¹‰à¸­à¸‡à¸£à¸°à¸šà¸¸ Guard ID, Username à¹à¸¥à¸° Name</div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: isEdit ? "à¸šà¸±à¸™à¸—à¸¶à¸" : "à¹€à¸žà¸´à¹ˆà¸¡",
    cancelButtonText: "à¸¢à¸à¹€à¸¥à¸´à¸",
    buttonsStyling: false,
    customClass: {
      popup: "swal-user-popup",
      confirmButton: "swal-btn swal-btn-primary",
      cancelButton: "swal-btn swal-btn-secondary"
    },
    preConfirm: () => {
      const guardId = document.getElementById("swalGuardId").value.trim();
      const username = document.getElementById("swalGuardUsername").value.trim();
      const name = document.getElementById("swalGuardName").value.trim();
      const phone = document.getElementById("swalGuardPhone").value.trim();
      const email = document.getElementById("swalGuardEmail").value.trim();
      const password = document.getElementById("swalGuardPassword").value;
      const status = document.getElementById("swalGuardStatus").value;
      if (!guardId || !username || !name) {
        Swal.showValidationMessage("à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸ Guard ID, Username à¹à¸¥à¸° Name");
        return false;
      }
      if (!isValidEmailInput(email)) {
        Swal.showValidationMessage("à¸£à¸¹à¸›à¹à¸šà¸šà¸­à¸µà¹€à¸¡à¸¥à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡");
        return false;
      }
      if (!isEdit && !password) {
        Swal.showValidationMessage("à¸à¸£à¸¸à¸“à¸²à¸à¸³à¸«à¸™à¸”à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™");
        return false;
      }
      return { guard_id: guardId, username, name, phone, email, password, status };
    }
  });
  if (!result.isConfirmed || !result.value) return;

  try {
    const payload = {
      ...result.value
    };
    await callApi("upsertGuard", { payload });
    invalidateAdminCaches();
    notify("à¸šà¸±à¸™à¸—à¸¶à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ Guard à¸ªà¸³à¹€à¸£à¹‡à¸ˆ");
    await ensureGuardsLoaded(true, true);
  } catch (err) {
    notify(`à¸šà¸±à¸™à¸—à¸¶à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ Guard à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: ${err.message}`);
  }
}

async function openCheckpointSwal(existingCheckpoint) {
  const isEdit = !!existingCheckpoint;
  if (!window.Swal) return;
  const autoCheckpointId = isEdit
    ? String(existingCheckpoint.checkpoint_id || "")
    : generateNextCheckpointId();
  const autoQrText = isEdit
    ? String(existingCheckpoint.qr_text || "")
    : autoCheckpointId;

  const result = await Swal.fire({
    title: isEdit ? "à¹à¸à¹‰à¹„à¸‚ Checkpoint" : "à¹€à¸žà¸´à¹ˆà¸¡ Checkpoint",
    width: "92vw",
    customClass: {
      popup: "swal-checkpoint-popup",
      confirmButton: "swal-btn swal-btn-primary",
      cancelButton: "swal-btn swal-btn-secondary"
    },
    html: `
      <div class="cp-form-grid">
        <div class="cp-field">
          <label>Checkpoint ID</label>
          <input id="swalCpId" class="swal2-input" value="${escapeAttr(autoCheckpointId)}" readonly>
        </div>
        <div class="cp-field">
          <label>Checkpoint Name</label>
          <input id="swalCpName" class="swal2-input" placeholder="Checkpoint name" value="${escapeAttr(isEdit ? (existingCheckpoint.checkpoint_name || "") : "")}">
        </div>
        <div class="cp-field">
          <label>QR Text</label>
          <input id="swalCpQrText" class="swal2-input" placeholder="QR Text" value="${escapeAttr(autoQrText)}">
        </div>
        <div class="cp-field">
          <label>Radius (meter)</label>
          <input id="swalCpRadius" class="swal2-input" placeholder="50" value="${escapeAttr(isEdit ? (existingCheckpoint.radius_m || "50") : "50")}">
        </div>
        <div class="cp-field">
          <label>Latitude, Longitude</label>
          <input id="swalCpCoords" class="swal2-input" placeholder="13.782520, 100.971532" value="${escapeAttr(isEdit ? `${existingCheckpoint.lat || ""}, ${existingCheckpoint.lng || ""}` : "")}">
        </div>
        <div class="cp-field cp-help-box">
          <label class="cp-help-title">Map</label>
          <span id="swalCpMapNotice" class="cp-label-note">à¸à¸£à¸­à¸ Latitude/Longitude à¹€à¸­à¸‡ à¸«à¸£à¸·à¸­à¹€à¸›à¸´à¸” Google Maps</span>
          <button id="swalCpOpenGoogleBtn" type="button" class="cp-map-btn cp-map-btn-google">
            <span class="cp-map-google-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.3a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6z"/>
              </svg>
            </span>
            <span>Open Google Maps</span>
          </button>
        </div>
        <div class="cp-field">
          <label>Photo Required</label>
          <select id="swalCpPhotoRequired" class="swal2-select">
            <option value="TRUE" ${(isEdit ? String(existingCheckpoint.is_photo_required || "TRUE") : "TRUE").toUpperCase() === "TRUE" ? "selected" : ""}>TRUE</option>
            <option value="FALSE" ${(isEdit ? String(existingCheckpoint.is_photo_required || "") : "").toUpperCase() === "FALSE" ? "selected" : ""}>FALSE</option>
          </select>
        </div>
        <div class="cp-field">
          <label>Active</label>
          <select id="swalCpActive" class="swal2-select">
            <option value="TRUE" ${(isEdit ? String(existingCheckpoint.active || "TRUE") : "TRUE").toUpperCase() === "TRUE" ? "selected" : ""}>TRUE</option>
            <option value="FALSE" ${(isEdit ? String(existingCheckpoint.active || "") : "").toUpperCase() === "FALSE" ? "selected" : ""}>FALSE</option>
          </select>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: isEdit ? "à¸šà¸±à¸™à¸—à¸¶à¸" : "à¹€à¸žà¸´à¹ˆà¸¡",
    cancelButtonText: "à¸¢à¸à¹€à¸¥à¸´à¸",
    buttonsStyling: false,
    didOpen: async () => {
      const initialLat = Number(isEdit ? existingCheckpoint.lat : 0);
      const initialLng = Number(isEdit ? existingCheckpoint.lng : 0);
      await initCheckpointMapPicker(Number.isFinite(initialLat) ? initialLat : 0, Number.isFinite(initialLng) ? initialLng : 0);
    },
    preConfirm: () => {
      const checkpoint_id = document.getElementById("swalCpId").value.trim();
      const checkpoint_name = document.getElementById("swalCpName").value.trim();
      const qr_text = document.getElementById("swalCpQrText").value.trim() || checkpoint_id;
      const coords = document.getElementById("swalCpCoords").value.trim();
      const parsed = parseCoordsText(coords);
      const lat = parsed ? parsed.lat : "";
      const lng = parsed ? parsed.lng : "";
      const radius_m = Number(document.getElementById("swalCpRadius").value || 50);
      const is_photo_required = document.getElementById("swalCpPhotoRequired").value;
      const active = document.getElementById("swalCpActive").value;
      if (!checkpoint_id || !checkpoint_name || !qr_text) {
        Swal.showValidationMessage("à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸ Checkpoint ID, à¸Šà¸·à¹ˆà¸­à¸ˆà¸¸à¸”à¸•à¸£à¸§à¸ˆ à¹à¸¥à¸° QR Text");
        return false;
      }
      if (coords && !parsed) {
        Swal.showValidationMessage("à¸žà¸´à¸à¸±à¸”à¹„à¸¡à¹ˆà¸–à¸¹à¸à¸•à¹‰à¸­à¸‡ à¸•à¸±à¸§à¸­à¸¢à¹ˆà¸²à¸‡ 13.782520, 100.971532");
        return false;
      }
      if (!Number.isFinite(radius_m) || radius_m <= 0) {
        Swal.showValidationMessage("à¸£à¸±à¸¨à¸¡à¸µà¸•à¹‰à¸­à¸‡à¹€à¸›à¹‡à¸™à¸•à¸±à¸§à¹€à¸¥à¸‚à¸¡à¸²à¸à¸à¸§à¹ˆà¸² 0");
        return false;
      }
      return { checkpoint_id, checkpoint_name, qr_text, lat, lng, radius_m, is_photo_required, active };
    }
  });
  if (!result.isConfirmed || !result.value) return;
  try {
    await callApi("upsertCheckpoint", { payload: result.value });
    invalidateAdminCaches();
    notify("à¸šà¸±à¸™à¸—à¸¶à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ Checkpoint à¸ªà¸³à¹€à¸£à¹‡à¸ˆ");
    await ensureCheckpointsLoaded(true, true);
  } catch (err) {
    notify(`à¸šà¸±à¸™à¸—à¸¶à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ Checkpoint à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: ${err.message}`);
  }
}

function renderAdminTable(rows) {
  const admins = Array.isArray(rows) ? rows : (state.admins || []);
  if (!admins.length) {
    el.adminTableBody.innerHTML = '<tr><td colspan="5">??????????? Admin</td></tr>';
    return;
  }

  el.adminTableBody.innerHTML = admins.map((admin) => `
    <tr>
      <td>${escapeHtml(admin.supervisor_id || "-")}</td>
      <td>${escapeHtml(admin.username || admin.supervisor_id || "-")}</td>
      <td>${escapeHtml(admin.name || "-")}</td>
      <td>${escapeHtml(admin.email || "-")}</td>
      <td class="row-actions">
        <button class="btn row-btn icon-btn" data-edit-admin="${escapeAttr(admin.supervisor_id || "")}" title="Edit" aria-label="Edit">
          ${iconEdit()}
        </button>
        <button class="btn row-btn icon-btn btn-danger-soft" data-del-admin="${escapeAttr(admin.supervisor_id || "")}" title="Delete" aria-label="Delete">
          ${iconTrash()}
        </button>
      </td>
    </tr>
  `).join("");

  Array.from(el.adminTableBody.querySelectorAll("[data-edit-admin]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const supervisorId = btn.getAttribute("data-edit-admin");
      const admin = admins.find((x) => String(x.supervisor_id || "") === String(supervisorId || ""));
      if (!admin) return;
      openAddAdminSwal({
        supervisor_id: admin.supervisor_id || "",
        username: admin.username || admin.supervisor_id || "",
        name: admin.name || "",
        email: admin.email || "",
        status: admin.status || "active"
      });
    });
  });

  Array.from(el.adminTableBody.querySelectorAll("[data-del-admin]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const supervisorId = btn.getAttribute("data-del-admin");
      if (!supervisorId) return;
      const admin = admins.find((x) => String(x.supervisor_id || "") === String(supervisorId));
      confirmDeleteAdmin({
        supervisor_id: supervisorId,
        name: admin?.name || ""
      });
    });
  });
}

function renderGuardsTable(rows) {
  if (!rows.length) {
    el.guardsTableBody.innerHTML = '<tr><td colspan="7">??????????? User</td></tr>';
    return;
  }

  el.guardsTableBody.innerHTML = rows.map((g) => `
    <tr>
      <td>${escapeHtml(g.guard_id || "-")}</td>
      <td>${escapeHtml(g.username || g.guard_id || "-")}</td>
      <td>${escapeHtml(g.name || "-")}</td>
      <td>${escapeHtml(g.phone || "-")}</td>
      <td>${escapeHtml(g.email || "-")}</td>
      <td>${escapeHtml(g.status || "active")}</td>
      <td class="row-actions">
        <button class="btn row-btn icon-btn" data-edit-guard="${escapeAttr(g.guard_id)}" title="Edit" aria-label="Edit">
          ${iconEdit()}
        </button>
        <button class="btn row-btn icon-btn btn-danger-soft" data-del-guard="${escapeAttr(g.guard_id)}" title="Delete" aria-label="Delete">
          ${iconTrash()}
        </button>
      </td>
    </tr>
  `).join("");

  Array.from(el.guardsTableBody.querySelectorAll("[data-edit-guard]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-guard");
      const guard = rows.find((x) => String(x.guard_id) === String(id));
      if (!guard) return;
      openAddUserSwal(guard);
    });
  });

  Array.from(el.guardsTableBody.querySelectorAll("[data-del-guard]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del-guard");
      const guard = rows.find((x) => String(x.guard_id) === String(id));
      if (!guard) return;
      confirmDeleteGuard(guard);
    });
  });
}

async function confirmDeleteGuard(guard) {
  if (!window.Swal) return;
  const result = await Swal.fire({
    title: "Delete Guard?",
    text: `${guard.guard_id} - ${guard.name || ""}`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Delete",
    cancelButtonText: "à¸¢à¸à¹€à¸¥à¸´à¸",
    confirmButtonColor: "#d14343"
  });
  if (!result.isConfirmed) return;

  try {
    await callApi("deleteGuard", { guardId: guard.guard_id });
    invalidateAdminCaches();
    notify("à¸¥à¸š Guard à¸ªà¸³à¹€à¸£à¹‡à¸ˆ");
    state.guardsLoaded = false;
    await ensureGuardsLoaded(true, true);
  } catch (err) {
    notify(`à¸¥à¸š Guard à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: ${err.message}`);
  }
}

async function confirmDeleteAdmin(admin) {
  if (!window.Swal) return;
  const result = await Swal.fire({
    title: "Delete Admin?",
    text: `${admin.supervisor_id} - ${admin.name || ""}`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Delete",
    cancelButtonText: "à¸¢à¸à¹€à¸¥à¸´à¸",
    confirmButtonColor: "#d14343"
  });
  if (!result.isConfirmed) return;

  try {
    await callApi("deleteSupervisor", { supervisorId: admin.supervisor_id });
    notify("à¸¥à¸š Admin à¸ªà¸³à¹€à¸£à¹‡à¸ˆ");
    if (state.supervisor && String(state.supervisor.supervisor_id) === String(admin.supervisor_id)) {
      logout();
      return;
    }
    state.adminsLoaded = false;
    await ensureAdminsLoaded(true, true);
  } catch (err) {
    notify(`à¸¥à¸š Admin à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: ${err.message}`);
  }
}

function renderCheckpointsTable(rows) {
  if (!rows.length) {
    el.checkpointsTableBody.innerHTML = '<tr><td colspan="9">No checkpoints</td></tr>';
    return;
  }

  el.checkpointsTableBody.innerHTML = rows.map((c) => `
    <tr>
      <td>${escapeHtml(c.checkpoint_id || "-")}</td>
      <td>${escapeHtml(c.checkpoint_name || "-")}</td>
      <td>${escapeHtml(c.qr_text || "-")}</td>
      <td>${escapeHtml(c.lat || "-")}</td>
      <td>${escapeHtml(c.lng || "-")}</td>
      <td>${escapeHtml(c.radius_m || "50")}</td>
      <td>${escapeHtml(c.is_photo_required || "TRUE")}</td>
      <td>${escapeHtml(c.active || "TRUE")}</td>
      <td class="row-actions">
        <button class="btn row-btn icon-btn" data-edit-cp="${escapeAttr(c.checkpoint_id)}" title="Edit" aria-label="Edit">
          ${iconEdit()}
        </button>
        <button class="btn row-btn icon-btn btn-qr" data-qr-cp="${escapeAttr(c.checkpoint_id)}" title="QR Code" aria-label="QR Code">
          ${iconQr()}
        </button>
        <button class="btn row-btn icon-btn btn-danger-soft" data-del-cp="${escapeAttr(c.checkpoint_id)}" title="Delete" aria-label="Delete">
          ${iconTrash()}
        </button>
      </td>
    </tr>
  `).join("");

  Array.from(el.checkpointsTableBody.querySelectorAll("[data-edit-cp]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-cp");
      const cp = rows.find((x) => String(x.checkpoint_id) === String(id));
      if (!cp) return;
      openCheckpointSwal(cp);
    });
  });

  Array.from(el.checkpointsTableBody.querySelectorAll("[data-qr-cp]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-qr-cp");
      const cp = rows.find((x) => String(x.checkpoint_id) === String(id));
      if (!cp) return;
      openCheckpointQrSwal(cp);
    });
  });

  Array.from(el.checkpointsTableBody.querySelectorAll("[data-del-cp]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del-cp");
      const cp = rows.find((x) => String(x.checkpoint_id) === String(id));
      if (!cp) return;
      confirmDeleteCheckpoint(cp);
    });
  });
}

async function openCheckpointQrSwal(checkpoint) {
  if (!window.Swal) return;
  const qrText = String(checkpoint.qr_text || checkpoint.checkpoint_id || "").trim();
  if (!qrText) {
    notify("Checkpoint à¸™à¸µà¹‰à¹„à¸¡à¹ˆà¸¡à¸µ QR Text");
    return;
  }
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(qrText)}`;
  await Swal.fire({
    title: `QR: ${escapeHtml(checkpoint.checkpoint_id || "-")}`,
    width: 480,
    html: `
      <div style="display:grid;gap:10px;justify-items:center">
        <img src="${qrUrl}" alt="Checkpoint QR" style="width:320px;height:320px;border:1px solid #d8e1ef;border-radius:8px;background:#fff">
        <div style="font-size:13px;color:#5b6d86"><strong>QR Text:</strong> ${escapeHtml(qrText)}</div>
        <a class="btn" href="${qrUrl}" download="QR-${escapeAttr(checkpoint.checkpoint_id || "checkpoint")}.png" style="text-decoration:none">Download QR</a>
      </div>
    `,
    showConfirmButton: true,
    confirmButtonText: "Close"
  });
}

async function confirmDeleteCheckpoint(checkpoint) {
  if (!window.Swal) return;
  const result = await Swal.fire({
    title: "Delete Checkpoint?",
    text: `${checkpoint.checkpoint_id} - ${checkpoint.checkpoint_name || ""}`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Delete",
    cancelButtonText: "à¸¢à¸à¹€à¸¥à¸´à¸",
    confirmButtonColor: "#d14343"
  });
  if (!result.isConfirmed) return;

  try {
    await callApi("deleteCheckpoint", { checkpointId: checkpoint.checkpoint_id });
    invalidateAdminCaches();
    notify("à¸¥à¸š Checkpoint à¸ªà¸³à¹€à¸£à¹‡à¸ˆ");
    state.checkpointsLoaded = false;
    await ensureCheckpointsLoaded(true, true);
  } catch (err) {
    notify(`à¸¥à¸š Checkpoint à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: ${err.message}`);
  }
}


function loadTemplateData(forceReload) {
  return ensureTemplatesLoaded(true, !!forceReload).then(async (rows) => {
    const templates = Array.isArray(rows) ? rows : [];
    const missing = templates.filter((row) => !Array.isArray(state.templateRouteCache?.[String(row.template_id || "")]));
    if (!missing.length) return templates;

    await Promise.all(missing.map(async (row) => {
      const templateId = String(row.template_id || "");
      if (!templateId) return;
      try {
        const routeRows = await fetchTemplateCheckpointsQuick(templateId);
        if (!state.templateRouteCache) state.templateRouteCache = {};
        state.templateRouteCache[templateId] = routeRows.map((item) => ({
          seq_no: Number(item.seq_no || 1),
          checkpoint_id: String(item.checkpoint_id || "")
        }));
      } catch (_) {
        if (!state.templateRouteCache) state.templateRouteCache = {};
        state.templateRouteCache[templateId] = [];
      }
    }));

    renderTemplatesTable(templates);
    return templates;
  });
}

function getTemplateRouteCountDisplay(templateId) {
  const key = String(templateId || "");
  const rows = state.templateRouteCache?.[key];
  if (Array.isArray(rows)) return String(rows.length);
  return "0";
}

function renderTemplatesTable(rows) {
  const templates = Array.isArray(rows) ? rows : [];
  if (!el.templatesTableBody) return;
  if (!templates.length) {
    el.templatesTableBody.innerHTML = '<tr><td colspan="5">ยังไม่มี Template</td></tr>';
    return;
  }

  el.templatesTableBody.innerHTML = templates.map((t) => `
    <tr>
      <td>${escapeHtml(t.template_id || "-")}</td>
      <td>${escapeHtml(t.template_name || "-")}</td>
      <td>${escapeHtml(getTemplateRouteCountDisplay(t.template_id))}</td>
      <td>${escapeHtml(t.status || "ACTIVE")}</td>
      <td class="row-actions">
        <button class="btn row-btn icon-btn" data-edit-template="${escapeAttr(t.template_id || "")}" title="แก้ไข" aria-label="แก้ไข">
          ${iconEdit()}
        </button>
        <button class="btn row-btn icon-btn btn-danger-soft" data-del-template="${escapeAttr(t.template_id || "")}" title="ลบ" aria-label="ลบ">
          ${iconTrash()}
        </button>
      </td>
    </tr>
  `).join("");

  el.templatesTableBody.querySelectorAll("[data-edit-template]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const templateId = btn.getAttribute("data-edit-template");
      const template = templates.find((item) => String(item.template_id || "") === String(templateId || ""));
      if (!template) return;
      openTemplateSwal(template);
    });
  });

  el.templatesTableBody.querySelectorAll("[data-del-template]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const templateId = btn.getAttribute("data-del-template");
      const template = templates.find((item) => String(item.template_id || "") === String(templateId || ""));
      if (!template) return;
      confirmDeleteTemplate(template);
    });
  });
}

async function confirmDeleteTemplate(template) {
  if (!window.Swal) return;
  const result = await Swal.fire({
    title: "ลบ Template นี้หรือไม่",
    text: `${template.template_id || "-"} - ${template.template_name || ""}`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "ลบ",
    cancelButtonText: "ยกเลิก",
    buttonsStyling: false,
    customClass: {
      popup: "swal-user-popup",
      confirmButton: "swal-btn swal-btn-danger",
      cancelButton: "swal-btn swal-btn-secondary"
    }
  });
  if (!result.isConfirmed) return;

  try {
    await callApi("deleteShiftTemplate", { templateId: template.template_id });
    delete state.templateRouteCache[String(template.template_id || "")];
    state.templatesLoaded = false;
    invalidateAdminCaches();
    await ensureTemplatesLoaded(true, true);
    notify("ลบ Template สำเร็จ", "success");
  } catch (err) {
    notify(`ลบ Template ไม่สำเร็จ: ${err.message}`, "error");
  }
}

async function fetchTemplateCheckpointsQuick(templateId) {
  const rows = await callApi("listTemplateCheckpoints", { templateId });
  return Array.isArray(rows) ? rows : [];
}

async function openTemplateSwal(existingTemplate) {
  await ensureCheckpointsLoaded(true, false);
  await ensureTemplatesLoaded(true, false);

  const isEdit = !!existingTemplate;
  const templateId = isEdit ? String(existingTemplate.template_id || "") : generateNextTemplateId();
  let routeRows = [];

  if (isEdit) {
    const cached = state.templateRouteCache?.[templateId];
    routeRows = Array.isArray(cached) ? cached.map((row) => ({
      seq_no: Number(row.seq_no || 1),
      checkpoint_id: String(row.checkpoint_id || "")
    })) : await fetchTemplateCheckpointsQuick(templateId);
  }

  if (!routeRows.length) {
    routeRows = [{ seq_no: 1, checkpoint_id: "" }];
  }

  const buildCheckpointOptions = (selectedId) => {
    const selected = String(selectedId || "").trim();
    const options = (state.checkpoints || []).map((cp) => {
      const id = String(cp.checkpoint_id || "").trim();
      if (!id) return "";
      return `<option value="${escapeAttr(id)}"${id === selected ? " selected" : ""}>${escapeHtml(id)} - ${escapeHtml(cp.checkpoint_name || "-")}</option>`;
    }).join("");
    if (selected && !options.includes(`value="${escapeAttr(selected)}"`)) {
      return `<option value="${escapeAttr(selected)}" selected>${escapeHtml(selected)} - ไม่พบชื่อจุดตรวจ</option>${options}`;
    }
    return `<option value="">เลือกจุดตรวจ</option>${options}`;
  };

  const renderRouteTable = () => {
    const body = document.getElementById("swalTemplateRouteBody");
    if (!body) return;
    body.innerHTML = routeRows.map((row, index) => `
      <tr>
        <td><input class="swal2-input template-seq-input" data-route-seq="${index}" type="number" min="1" step="1" value="${escapeAttr(row.seq_no || index + 1)}"></td>
        <td>
          <select class="swal2-select template-route-select" data-route-checkpoint="${index}">
            ${buildCheckpointOptions(row.checkpoint_id)}
          </select>
        </td>
        <td class="row-actions">
          <button type="button" class="btn row-btn icon-btn btn-danger-soft" data-remove-route="${index}" title="ลบ" aria-label="ลบ">
            ${iconTrash()}
          </button>
        </td>
      </tr>
    `).join("");

    body.querySelectorAll("[data-route-seq]").forEach((input) => {
      input.addEventListener("input", () => {
        const index = Number(input.getAttribute("data-route-seq"));
        routeRows[index].seq_no = Number(input.value || index + 1);
      });
    });
    body.querySelectorAll("[data-route-checkpoint]").forEach((select) => {
      select.addEventListener("change", () => {
        const index = Number(select.getAttribute("data-route-checkpoint"));
        routeRows[index].checkpoint_id = String(select.value || "");
      });
    });
    body.querySelectorAll("[data-remove-route]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = Number(btn.getAttribute("data-remove-route"));
        routeRows.splice(index, 1);
        if (!routeRows.length) routeRows.push({ seq_no: 1, checkpoint_id: "" });
        routeRows.splice(0, routeRows.length, ...routeRows.map((row, i) => ({ ...row, seq_no: i + 1 })));
        renderRouteTable();
      });
    });
  };

  const result = await Swal.fire({
    title: isEdit ? "Edit Template" : "Add Template",
    width: 1120,
    showCancelButton: true,
    confirmButtonText: isEdit ? "Save" : "Add",
    cancelButtonText: "Cancel",
    buttonsStyling: false,
    customClass: {
      popup: "swal-user-popup swal-template-popup compact-template-popup",
      confirmButton: "swal-btn swal-btn-primary",
      cancelButton: "swal-btn swal-btn-secondary"
    },
    html: `
      <div class="template-popup-top-note">กำหนดชื่อเทมเพลตและเส้นทางจุดตรวจในหน้าต่างเดียว</div>
      <div class="template-popup-layout template-popup-layout-compact">
        <section class="template-column template-meta-panel compact-meta-panel">
          <div class="template-panel-head"><h4>Template Settings</h4></div>
          <div class="template-form-grid compact-template-grid">
            <div class="template-field">
              <label>Template ID</label>
              <input id="swalTemplateId" class="swal2-input" value="${escapeAttr(templateId)}" readonly>
            </div>
            <div class="template-field">
              <label>Template Name</label>
              <input id="swalTemplateName" class="swal2-input" value="${escapeAttr(isEdit ? (existingTemplate.template_name || "") : "")}" placeholder="เช่น เส้นทางคลังสินค้า">
            </div>
            <div class="template-field">
              <label>Status</label>
              <select id="swalTemplateStatus" class="swal2-select">
                <option value="ACTIVE"${String(isEdit ? existingTemplate.status : "ACTIVE").toUpperCase() === "ACTIVE" ? " selected" : ""}>ACTIVE</option>
                <option value="INACTIVE"${String(isEdit ? existingTemplate.status : "").toUpperCase() === "INACTIVE" ? " selected" : ""}>INACTIVE</option>
              </select>
            </div>
          </div>
        </section>
        <section class="template-column template-route-panel template-route-panel-full">
          <div class="template-panel-head">
            <h4>Route Checkpoints</h4>
            <button id="swalTemplateAddRouteRow" type="button" class="btn icon-btn template-add-route-btn" title="เพิ่มจุดตรวจ" aria-label="เพิ่มจุดตรวจ">
              ${iconPlus()}
            </button>
          </div>
          <div class="table-wrap template-table-wrap compact-template-table-wrap">
            <table class="data-table template-route-table">
              <thead>
                <tr><th>Seq</th><th>Checkpoint</th><th>Action</th></tr>
              </thead>
              <tbody id="swalTemplateRouteBody"></tbody>
            </table>
          </div>
        </section>
      </div>
    `,
    didOpen: () => {
      renderRouteTable();
      const addBtn = document.getElementById("swalTemplateAddRouteRow");
      if (addBtn) {
        addBtn.addEventListener("click", () => {
          routeRows.push({ seq_no: routeRows.length + 1, checkpoint_id: "" });
          renderRouteTable();
        });
      }
    },
    preConfirm: () => {
      const templateName = String(document.getElementById("swalTemplateName")?.value || "").trim();
      const status = String(document.getElementById("swalTemplateStatus")?.value || "ACTIVE").trim().toUpperCase();
      if (!templateName) {
        Swal.showValidationMessage("กรุณากรอกชื่อ Template");
        return false;
      }

      const routeItems = routeRows
        .map((row, index) => ({
          seq_no: Number(row.seq_no || index + 1),
          checkpoint_id: String(row.checkpoint_id || "").trim()
        }))
        .filter((row) => row.checkpoint_id);

      if (!routeItems.length) {
        Swal.showValidationMessage("กรุณาเลือก Route Checkpoints อย่างน้อย 1 จุด");
        return false;
      }

      return {
        payload: {
          template_id: templateId,
          template_name: templateName,
          shift_name: templateName,
          guard_ids: [],
          active_days: [],
          rounds_per_shift: 1,
          start_time: "",
          end_time: "",
          status
        },
        routeItems
      };
    }
  });

  if (!result.isConfirmed || !result.value) return;

  try {
    await callApi("upsertShiftTemplate", { payload: result.value.payload });
    await callApi("replaceTemplateCheckpoints", {
      templateId: result.value.payload.template_id,
      items: result.value.routeItems
    });

    if (!state.templateRouteCache) state.templateRouteCache = {};
    state.templateRouteCache[String(result.value.payload.template_id || "")] = result.value.routeItems.map((row) => ({
      seq_no: Number(row.seq_no || 1),
      checkpoint_id: String(row.checkpoint_id || "")
    }));

    state.templatesLoaded = false;
    invalidateAdminCaches();
    await ensureTemplatesLoaded(true, true);
    notify("บันทึก Template สำเร็จ", "success");
  } catch (err) {
    notify(`บันทึก Template ไม่สำเร็จ: ${err.message}`, "error");
  }
}

async function openAssignDaySwal(dateKey) {
  await Promise.all([ensureGuardsLoaded(true, false), ensureTemplatesLoaded(true, false)]);
  if (!window.Swal) return;

  const targetDate = String(dateKey || el.assignDate?.value || toYmd(new Date())).trim();
  const assignments = Array.isArray(state.assignments) ? state.assignments : [];
  const templates = (state.templates || []).filter((row) => String(row.status || "ACTIVE").toUpperCase() === "ACTIVE");
  const templateOptions = ['<option value="">เลือก Template</option>']
    .concat(templates.map((row) => `
      <option value="${escapeAttr(row.template_id || "")}">
        ${escapeHtml(row.template_id || "")} - ${escapeHtml(row.template_name || "-")}
      </option>
    `))
    .join("");

  const renderShiftPanel = (shiftCode) => {
    const rows = assignments.filter((row) =>
      String(row.assign_date || "") === targetDate &&
      String(row.shift_code || "").toUpperCase() === shiftCode
    );
    const selectedTemplateId = rows.length ? String(rows[0].template_id || "").trim() : "";
    const uniqueGuardCount = new Set(rows.map((row) => String(row.guard_id || "").trim()).filter(Boolean)).size;
    const shiftTemplateOptions = ['<option value="">เลือก Template</option>']
      .concat(templates.map((row) => `
        <option value="${escapeAttr(row.template_id || "")}"${String(row.template_id || "") === selectedTemplateId ? " selected" : ""}>
          ${escapeHtml(row.template_id || "")} - ${escapeHtml(row.template_name || "-")}
        </option>
      `))
      .join("");
    const templateNames = [...new Set(rows.map((row) => String(row.template_label || row.template_id || "").trim()).filter(Boolean))];
    const summary = rows.length
      ? `
        <div>Template ปัจจุบัน: <strong>${escapeHtml(templateNames[0] || "-")}</strong></div>
        <div>Guard ที่ถูก assign: <strong>${uniqueGuardCount}</strong> คน</div>
      `
      : `<div>ยังไม่มีการ assign สำหรับ${formatShiftCodeThai(shiftCode)}</div>`;

    return `
      <section class="assign-shift-panel">
        <h4>${escapeHtml(formatShiftCodeThai(shiftCode))}</h4>
        <div class="assign-shift-summary">${summary}</div>
        <div class="assign-shift-actions">
          <label for="assignTemplate_${shiftCode}">Template</label>
          <select id="assignTemplate_${shiftCode}">
            ${shiftTemplateOptions}
          </select>
          <div class="assign-shift-btns">
            <button type="button" class="btn swal-btn swal-btn-secondary" data-clear-shift="${shiftCode}">ล้าง</button>
          </div>
        </div>
      </section>
    `;
  };

  await Swal.fire({
    title: `Assign งานประจำวัน ${targetDate}`,
    html: `
      <div class="assign-day-swal-layout">
        ${renderShiftPanel("DAY")}
        ${renderShiftPanel("NIGHT")}
      </div>
    `,
    width: 980,
    showConfirmButton: true,
    showCancelButton: true,
    confirmButtonText: "บันทึกทั้งหมด",
    cancelButtonText: "ยกเลิก",
    showCloseButton: true,
    buttonsStyling: false,
    customClass: {
      popup: "swal-user-popup assign-day-swal",
      confirmButton: "swal-btn swal-btn-primary",
      cancelButton: "swal-btn swal-btn-secondary"
    },
    preConfirm: () => {
      const dayTemplateId = String(document.getElementById("assignTemplate_DAY")?.value || "").trim();
      const nightTemplateId = String(document.getElementById("assignTemplate_NIGHT")?.value || "").trim();
      if (!dayTemplateId && !nightTemplateId) {
        Swal.showValidationMessage("กรุณาเลือก Template อย่างน้อย 1 กะ");
        return false;
      }
      return { dayTemplateId, nightTemplateId };
    },
    didOpen: () => {
      const popup = Swal.getPopup();
      if (!popup) return;

      popup.querySelectorAll("[data-clear-shift]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const shiftCode = String(btn.getAttribute("data-clear-shift") || "").toUpperCase();
          const result = await Swal.fire({
            title: `ล้าง Assign ${formatShiftCodeThai(shiftCode)} หรือไม่`,
            text: targetDate,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "ล้าง",
            cancelButtonText: "ยกเลิก",
            buttonsStyling: false,
            customClass: {
              popup: "swal-user-popup",
              confirmButton: "swal-btn swal-btn-danger",
              cancelButton: "swal-btn swal-btn-secondary"
            }
          });
          if (!result.isConfirmed) return;
          await clearAssignShiftByDate(targetDate, shiftCode);
          Swal.close();
        });
      });
    }
  });

  if (!result.isConfirmed || !result.value) return;

  try {
    if (result.value.dayTemplateId) {
      await saveAssignShiftByDate(targetDate, "DAY", result.value.dayTemplateId, true);
    }
    if (result.value.nightTemplateId) {
      await saveAssignShiftByDate(targetDate, "NIGHT", result.value.nightTemplateId, true);
    }
    state.assignmentsByDateCache = {};
    state.assignmentsLoadedDate = "";
    await ensureAssignmentsLoaded(true, true);
    notify("บันทึก Assign ทั้งวันสำเร็จ", "success");
  } catch (err) {
    notify(`บันทึก Assign ไม่สำเร็จ: ${err.message}`, "error");
  }
}

async function saveAssignShiftByDate(assignDate, shiftCode, templateId, silentMode) {
  const activeGuards = (state.guards || []).filter((row) => String(row.status || "active").toLowerCase() === "active");
  if (!activeGuards.length) {
    if (!silentMode) notify("ไม่พบ Guard ที่ Active ในระบบ", "warning");
    return;
  }
  await ensureShiftSettingsLoaded(true, false);
  const shiftTimes = getShiftSettingTimeRange(shiftCode);

  const existingRows = (state.assignments || []).filter((row) =>
    String(row.assign_date || "") === String(assignDate || "") &&
    String(row.shift_code || "").toUpperCase() === String(shiftCode || "").toUpperCase()
  );

  try {
    await Promise.all(activeGuards.map((guard) => {
      const guardId = String(guard.guard_id || "").trim();
      const existingRow = existingRows.find((row) => String(row.guard_id || "") === guardId);
      return callApi("upsertAssignment", {
        payload: {
          assign_id: existingRow?.assign_id || "",
          assign_date: assignDate,
          shift_code: shiftCode,
          guard_id: guardId,
          template_id: templateId,
          start_time: shiftTimes.start_time,
          end_time: shiftTimes.end_time,
          status: "ACTIVE",
          remark: ""
        }
      });
    }));

    state.assignmentsByDateCache = {};
    state.assignmentsLoadedDate = "";
    if (!silentMode) {
      await ensureAssignmentsLoaded(true, true);
      notify(`บันทึก ${formatShiftCodeThai(shiftCode)} สำเร็จ`, "success");
    }
  } catch (err) {
    if (!silentMode) notify(`บันทึก Assign ไม่สำเร็จ: ${err.message}`, "error");
    throw err;
  }
}

async function clearAssignShiftByDate(assignDate, shiftCode) {
  const rows = (state.assignments || []).filter((row) =>
    String(row.assign_date || "") === String(assignDate || "") &&
    String(row.shift_code || "").toUpperCase() === String(shiftCode || "").toUpperCase()
  );

  if (!rows.length) {
    notify(`ไม่มีข้อมูล ${formatShiftCodeThai(shiftCode)} ให้ล้าง`, "warning");
    return;
  }

  try {
    await Promise.all(rows.map((row) => callApi("deleteAssignment", { assignId: row.assign_id })));
    state.assignmentsByDateCache = {};
    state.assignmentsLoadedDate = "";
    await ensureAssignmentsLoaded(true, true);
    notify(`ล้าง ${formatShiftCodeThai(shiftCode)} สำเร็จ`, "success");
  } catch (err) {
    notify(`ล้าง Assign ไม่สำเร็จ: ${err.message}`, "error");
  }
}

async function openAssignmentSwal(existingAssignment, fixedShiftCode) {
  await Promise.all([ensureGuardsLoaded(true, false), ensureTemplatesLoaded(true, false), ensureShiftSettingsLoaded(true, false)]);
  if (!window.Swal) return;

  const isEdit = !!existingAssignment;
  const defaultDate = String(existingAssignment?.assign_date || el.assignDate?.value || toYmd(new Date())).trim();
  const defaultShiftCode = String(fixedShiftCode || existingAssignment?.shift_code || "DAY").trim().toUpperCase();
  const defaultShiftTimes = getShiftSettingTimeRange(defaultShiftCode);
  const defaultStart = String(existingAssignment?.start_time || defaultShiftTimes.start_time).slice(0, 5);
  const defaultEnd = String(existingAssignment?.end_time || defaultShiftTimes.end_time).slice(0, 5);
  const activeGuards = (state.guards || []).filter((g) => String(g.status || "active").toLowerCase() === "active");

  const guardOptions = (state.guards || []).map((g) => `
    <option value="${escapeAttr(g.guard_id || "")}"${String(existingAssignment?.guard_id || "") === String(g.guard_id || "") ? " selected" : ""}>
      ${escapeHtml(g.guard_id || "")} - ${escapeHtml(g.name || "-")}
    </option>
  `).join("");

  const templateOptions = (state.templates || [])
    .filter((t) => String(t.status || "ACTIVE").toUpperCase() === "ACTIVE")
    .map((t) => `
    <option value="${escapeAttr(t.template_id || "")}"${String(existingAssignment?.template_id || "") === String(t.template_id || "") ? " selected" : ""}>
      ${escapeHtml(t.template_id || "")} - ${escapeHtml(t.template_name || "-")}
    </option>
  `).join("");

  if (!isEdit) {
    const result = await Swal.fire({
      title: `เลือก Template สำหรับ${formatShiftCodeThai(defaultShiftCode)}`,
      width: 520,
      showCancelButton: true,
      confirmButtonText: "บันทึก",
      cancelButtonText: "ยกเลิก",
      buttonsStyling: false,
      customClass: {
        popup: "swal-user-popup assign-swal-popup",
        confirmButton: "swal-btn swal-btn-primary",
        cancelButton: "swal-btn swal-btn-secondary"
      },
      html: `
        <div class="swal-form-grid assign-swal-grid">
          <div class="swal-form-field">
            <label>วันที่</label>
            <input id="swalAssignDate" class="swal2-input" type="date" value="${escapeAttr(defaultDate)}">
          </div>
          <div class="swal-form-field">
            <label>Template</label>
            <select id="swalAssignTemplate" class="swal2-select">
              <option value="">เลือก Template</option>
              ${templateOptions}
            </select>
          </div>
        </div>
      `,
      preConfirm: () => {
        const assignDate = String(document.getElementById("swalAssignDate")?.value || "").trim();
        const templateId = String(document.getElementById("swalAssignTemplate")?.value || "").trim();
        if (!assignDate) {
          Swal.showValidationMessage("กรุณาเลือกวันที่");
          return false;
        }
        if (!templateId) {
          Swal.showValidationMessage("กรุณาเลือก Template");
          return false;
        }
        if (!activeGuards.length) {
          Swal.showValidationMessage("ไม่พบ Guard ที่ Active ในระบบ");
          return false;
        }
        return { assignDate, templateId };
      }
    });

    if (!result.isConfirmed || !result.value) return;

    try {
      const assignDate = result.value.assignDate;
      const templateId = result.value.templateId;
      const shiftCode = defaultShiftCode;
      const shiftTimes = getShiftSettingTimeRange(shiftCode);
      const startTime = shiftTimes.start_time;
      const endTime = shiftTimes.end_time;
      const existingRows = Array.isArray(state.assignments) ? state.assignments : [];

      await Promise.all(activeGuards.map((guard) => {
        const guardId = String(guard.guard_id || "").trim();
        const existingRow = existingRows.find((row) =>
          String(row.assign_date || "") === assignDate &&
          String(row.shift_code || "").toUpperCase() === shiftCode &&
          String(row.guard_id || "") === guardId
        );
        return callApi("upsertAssignment", {
          payload: {
            assign_id: existingRow?.assign_id || "",
            assign_date: assignDate,
            shift_code: shiftCode,
            guard_id: guardId,
            template_id: templateId,
            start_time: startTime,
            end_time: endTime,
            status: "ACTIVE",
            remark: ""
          }
        });
      }));

      if (el.assignDate) el.assignDate.value = assignDate;
      state.assignmentsByDateCache[String(assignDate || "")] = null;
      state.assignmentsLoadedDate = "";
      await ensureAssignmentsLoaded(true, true);
      notify(`Assign Template ให้ Guard ${activeGuards.length} คนสำเร็จ`, "success");
    } catch (err) {
      notify(`บันทึก Assign ไม่สำเร็จ: ${err.message}`, "error");
    }
    return;
  }

  const result = await Swal.fire({
    title: isEdit ? "Edit Assign" : `Add ${formatShiftCodeThai(defaultShiftCode)}`,
    width: 720,
    showCancelButton: true,
    confirmButtonText: isEdit ? "Save" : "Add",
    cancelButtonText: "Cancel",
    buttonsStyling: false,
    customClass: {
      popup: "swal-user-popup assign-swal-popup",
      confirmButton: "swal-btn swal-btn-primary",
      cancelButton: "swal-btn swal-btn-secondary"
    },
    html: `
      <div class="swal-form-grid assign-swal-grid">
        <div class="swal-form-field">
          <label>à¸§à¸±à¸™à¸—à¸µà¹ˆ</label>
          <input id="swalAssignDate" class="swal2-input" type="date" value="${escapeAttr(defaultDate)}">
        </div>
        <div class="swal-form-field">
          <label>à¸à¸°à¸‡à¸²à¸™</label>
          <select id="swalAssignShift" class="swal2-select" ${fixedShiftCode ? "disabled" : ""}>
            <option value="DAY"${defaultShiftCode === "DAY" ? " selected" : ""}>à¸à¸°à¸à¸¥à¸²à¸‡à¸§à¸±à¸™</option>
            <option value="NIGHT"${defaultShiftCode === "NIGHT" ? " selected" : ""}>à¸à¸°à¸à¸¥à¸²à¸‡à¸„à¸·à¸™</option>
          </select>
        </div>
        <div class="swal-form-field">
          <label>Guard</label>
          <select id="swalAssignGuard" class="swal2-select">
            <option value="">à¹€à¸¥à¸·à¸­à¸ Guard</option>
            ${guardOptions}
          </select>
        </div>
        <div class="swal-form-field">
          <label>Template</label>
          <select id="swalAssignTemplate" class="swal2-select">
            <option value="">à¹€à¸¥à¸·à¸­à¸ Template</option>
            ${templateOptions}
          </select>
        </div>
        <div class="swal-form-field">
          <label>Start</label>
          <input id="swalAssignStart" class="swal2-input" type="time" value="${escapeAttr(defaultStart)}">
        </div>
        <div class="swal-form-field">
          <label>End</label>
          <input id="swalAssignEnd" class="swal2-input" type="time" value="${escapeAttr(defaultEnd)}">
        </div>
        <div class="swal-form-field">
          <label>Status</label>
          <select id="swalAssignStatus" class="swal2-select">
            <option value="ACTIVE"${String(existingAssignment?.status || "ACTIVE").toUpperCase() === "ACTIVE" ? " selected" : ""}>ACTIVE</option>
            <option value="INACTIVE"${String(existingAssignment?.status || "").toUpperCase() === "INACTIVE" ? " selected" : ""}>INACTIVE</option>
          </select>
        </div>
        <div class="swal-form-field swal-form-field-full">
          <label>à¸«à¸¡à¸²à¸¢à¹€à¸«à¸•à¸¸</label>
          <textarea id="swalAssignRemark" class="swal2-textarea" placeholder="à¸«à¸¡à¸²à¸¢à¹€à¸«à¸•à¸¸à¹€à¸žà¸´à¹ˆà¸¡à¹€à¸•à¸´à¸¡">${escapeHtml(existingAssignment?.remark || "")}</textarea>
        </div>
      </div>
    `,
    preConfirm: () => {
      const assignDate = String(document.getElementById("swalAssignDate")?.value || "").trim();
      const shiftCode = String((fixedShiftCode || document.getElementById("swalAssignShift")?.value || "DAY")).trim().toUpperCase();
      const guardId = String(document.getElementById("swalAssignGuard")?.value || "").trim();
      const templateId = String(document.getElementById("swalAssignTemplate")?.value || "").trim();
      const startTime = normalizeTime(document.getElementById("swalAssignStart")?.value || "");
      const endTime = normalizeTime(document.getElementById("swalAssignEnd")?.value || "");
      const status = String(document.getElementById("swalAssignStatus")?.value || "ACTIVE").trim().toUpperCase();
      const remark = String(document.getElementById("swalAssignRemark")?.value || "").trim();

      if (!assignDate) {
        Swal.showValidationMessage("à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸à¸§à¸±à¸™à¸—à¸µà¹ˆ");
        return false;
      }
      if (!guardId) {
        Swal.showValidationMessage("à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸ Guard");
        return false;
      }
      if (!templateId) {
        Swal.showValidationMessage("à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸ Template");
        return false;
      }
      if (!startTime || !endTime) {
        Swal.showValidationMessage("à¸à¸£à¸¸à¸“à¸²à¸£à¸°à¸šà¸¸à¹€à¸§à¸¥à¸²à¹€à¸£à¸´à¹ˆà¸¡à¹à¸¥à¸°à¹€à¸§à¸¥à¸²à¸ªà¸´à¹‰à¸™à¸ªà¸¸à¸”");
        return false;
      }

      return {
        assign_id: existingAssignment?.assign_id || "",
        assign_date: assignDate,
        shift_code: shiftCode,
        guard_id: guardId,
        template_id: templateId,
        start_time: startTime,
        end_time: endTime,
        status,
        remark
      };
    }
  });

  if (!result.isConfirmed || !result.value) return;

  try {
    await callApi("upsertAssignment", { payload: result.value });
    state.assignmentsByDateCache[String(result.value.assign_date || "")] = null;
    state.assignmentsLoadedDate = "";
    await ensureAssignmentsLoaded(true, true);
    notify("à¸šà¸±à¸™à¸—à¸¶à¸ Assign à¸ªà¸³à¹€à¸£à¹‡à¸ˆ", "success");
  } catch (err) {
    notify(`à¸šà¸±à¸™à¸—à¸¶à¸ Assign à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: ${err.message}`, "error");
  }
}

function getShiftSettingTimeRange(shiftCode) {
  const code = String(shiftCode || "DAY").trim().toUpperCase();
  const defaults = code === "NIGHT"
    ? { start_time: "20:00:00", end_time: "08:00:00" }
    : { start_time: "08:00:00", end_time: "17:00:00" };
  const row = (state.shiftSettings || []).find((item) => String(item.shift_code || "").toUpperCase() === code);
  return {
    start_time: normalizeTime(String((row && row.start_time) || defaults.start_time)),
    end_time: normalizeTime(String((row && row.end_time) || defaults.end_time))
  };
}

function toMinuteOfDay(timeValue) {
  const value = String(timeValue || "").trim();
  const match = value.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) return NaN;
  return (Number(match[1]) * 60) + Number(match[2]);
}

function explodeShiftSegments(startTime, endTime) {
  const start = toMinuteOfDay(startTime);
  const end = toMinuteOfDay(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start === end) return null;
  if (end > start) return [{ start, end }];
  return [
    { start, end: 1440 },
    { start: 0, end }
  ];
}

function shiftSegmentsOverlap(segmentsA, segmentsB) {
  for (const a of segmentsA) {
    for (const b of segmentsB) {
      if (a.start < b.end && b.start < a.end) return true;
    }
  }
  return false;
}

function validateShiftSettingRanges(dayStart, dayEnd, nightStart, nightEnd) {
  const daySegments = explodeShiftSegments(dayStart, dayEnd);
  const nightSegments = explodeShiftSegments(nightStart, nightEnd);
  if (!daySegments) {
    return { ok: false, message: "กะกลางวันต้องมีเวลาเริ่มและสิ้นสุดไม่เท่ากัน" };
  }
  if (!nightSegments) {
    return { ok: false, message: "กะกลางคืนต้องมีเวลาเริ่มและสิ้นสุดไม่เท่ากัน" };
  }
  if (shiftSegmentsOverlap(daySegments, nightSegments)) {
    return { ok: false, message: "ช่วงเวลากะกลางวันและกะกลางคืนห้ามทับซ้อนกัน" };
  }
  return { ok: true };
}

async function openShiftSettingsSwal() {
  await ensureShiftSettingsLoaded(true, false);
  const day = getShiftSettingTimeRange("DAY");
  const night = getShiftSettingTimeRange("NIGHT");

  const result = await Swal.fire({
    title: "Shift Settings",
    width: 860,
    showCancelButton: true,
    confirmButtonText: "บันทึก",
    cancelButtonText: "ยกเลิก",
    buttonsStyling: false,
    customClass: {
      popup: "swal-user-popup assign-swal-popup",
      confirmButton: "swal-btn swal-btn-primary",
      cancelButton: "swal-btn swal-btn-secondary"
    },
    html: `
      <div class="shift-settings-grid">
        <section class="shift-settings-card">
          <div class="shift-settings-card-head">
            <h3>กะกลางวัน</h3>
            <span class="shift-settings-badge">DAY</span>
          </div>
          <div class="swal-form-grid assign-swal-grid shift-settings-fields">
            <div class="swal-form-field">
              <label>เวลาเริ่ม</label>
              <input id="swalShiftDayStart" class="swal2-input" type="time" value="${escapeAttr(String(day.start_time || "").slice(0, 5))}">
            </div>
            <div class="swal-form-field">
              <label>เวลาสิ้นสุด</label>
              <input id="swalShiftDayEnd" class="swal2-input" type="time" value="${escapeAttr(String(day.end_time || "").slice(0, 5))}">
            </div>
          </div>
        </section>
        <section class="shift-settings-card">
          <div class="shift-settings-card-head">
            <h3>กะกลางคืน</h3>
            <span class="shift-settings-badge">NIGHT</span>
          </div>
          <div class="swal-form-grid assign-swal-grid shift-settings-fields">
            <div class="swal-form-field">
              <label>เวลาเริ่ม</label>
              <input id="swalShiftNightStart" class="swal2-input" type="time" value="${escapeAttr(String(night.start_time || "").slice(0, 5))}">
            </div>
            <div class="swal-form-field">
              <label>เวลาสิ้นสุด</label>
              <input id="swalShiftNightEnd" class="swal2-input" type="time" value="${escapeAttr(String(night.end_time || "").slice(0, 5))}">
            </div>
          </div>
        </section>
      </div>
    `,
    preConfirm: () => {
      const dayStart = normalizeTime(document.getElementById("swalShiftDayStart")?.value || "");
      const dayEnd = normalizeTime(document.getElementById("swalShiftDayEnd")?.value || "");
      const nightStart = normalizeTime(document.getElementById("swalShiftNightStart")?.value || "");
      const nightEnd = normalizeTime(document.getElementById("swalShiftNightEnd")?.value || "");
      if (!dayStart || !dayEnd || !nightStart || !nightEnd) {
        Swal.showValidationMessage("กรุณาระบุเวลาเริ่มและสิ้นสุดให้ครบทุกกะ");
        return false;
      }
      const validation = validateShiftSettingRanges(dayStart, dayEnd, nightStart, nightEnd);
      if (!validation.ok) {
        Swal.showValidationMessage(validation.message);
        return false;
      }
      return { dayStart, dayEnd, nightStart, nightEnd };
    }
  });

  if (!result.isConfirmed || !result.value) return;

  try {
    await Promise.all([
      callApi("upsertShiftSetting", { payload: { shift_code: "DAY", shift_name: "กะกลางวัน", start_time: result.value.dayStart, end_time: result.value.dayEnd, status: "ACTIVE" } }),
      callApi("upsertShiftSetting", { payload: { shift_code: "NIGHT", shift_name: "กะกลางคืน", start_time: result.value.nightStart, end_time: result.value.nightEnd, status: "ACTIVE" } })
    ]);
    state.shiftSettingsLoaded = false;
    await ensureShiftSettingsLoaded(true, true);
    state.assignmentsByDateCache = {};
    state.assignmentsLoadedDate = "";
    await ensureAssignmentsLoaded(true, true);
    notify("บันทึก Shift Settings สำเร็จ", "success");
  } catch (err) {
    notify(`บันทึก Shift Settings ไม่สำเร็จ: ${err.message}`, "error");
  }
}

async function confirmDeleteAssignment(row) {
  if (!window.Swal) return;
  const result = await Swal.fire({
    title: "à¸¥à¸š Assign à¸™à¸µà¹‰à¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ",
    text: `${row.guard_label || row.guard_id || "-"} / ${row.template_label || row.template_id || "-"}`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "à¸¥à¸š",
    cancelButtonText: "à¸¢à¸à¹€à¸¥à¸´à¸",
    buttonsStyling: false,
    customClass: {
      popup: "swal-user-popup",
      confirmButton: "swal-btn swal-btn-danger",
      cancelButton: "swal-btn swal-btn-secondary"
    }
  });
  if (!result.isConfirmed) return;

  try {
    await callApi("deleteAssignment", { assignId: row.assign_id });
    state.assignmentsByDateCache[String(row.assign_date || "")] = null;
    state.assignmentsLoadedDate = "";
    await ensureAssignmentsLoaded(true, true);
    notify("à¸¥à¸š Assign à¸ªà¸³à¹€à¸£à¹‡à¸ˆ", "success");
  } catch (err) {
    notify(`à¸¥à¸š Assign à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: ${err.message}`, "error");
  }
}
async function openChangePasswordSwal() {
  closeTopUserMenu();
  if (!state.supervisor || !window.Swal) return;

  const result = await Swal.fire({
      title: "à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™",
    width: 460,
    customClass: { popup: "swal-user-popup" },
    html: `
      <div style="display:grid;gap:8px;text-align:left">
        <label>à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™à¹ƒà¸«à¸¡à¹ˆ</label>
        <input id="swalNewPassword" class="swal2-input" type="password" placeholder="à¸à¸£à¸­à¸à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™à¹ƒà¸«à¸¡à¹ˆ">
        <label>à¸¢à¸·à¸™à¸¢à¸±à¸™à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™</label>
        <input id="swalConfirmPassword" class="swal2-input" type="password" placeholder="à¸à¸£à¸­à¸à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™à¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡">
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Save",
      cancelButtonText: "à¸¢à¸à¹€à¸¥à¸´à¸",
    preConfirm: () => {
      const newPassword = document.getElementById("swalNewPassword").value;
      const confirmPassword = document.getElementById("swalConfirmPassword").value;
        if (!newPassword) {
          Swal.showValidationMessage("à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™à¹ƒà¸«à¸¡à¹ˆ");
          return false;
        }
        if (newPassword !== confirmPassword) {
          Swal.showValidationMessage("à¸¢à¸·à¸™à¸¢à¸±à¸™à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¸•à¸£à¸‡à¸à¸±à¸™");
          return false;
        }
      return { newPassword };
    }
  });
  if (!result.isConfirmed || !result.value) return;

  try {
    await callApi("changeSupervisorPassword", {
      supervisorId: state.supervisor.supervisor_id,
      newPassword: result.value.newPassword
    });
    notify("à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™à¸ªà¸³à¹€à¸£à¹‡à¸ˆ");
  } catch (err) {
    notify(`à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: ${err.message}`);
  }
}
