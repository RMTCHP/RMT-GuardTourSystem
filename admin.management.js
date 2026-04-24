async function openAddAdminSwal(existingAdmin) {
  const isEdit = !!existingAdmin;
  if (!window.Swal) return;
  const result = await Swal.fire({
    title: isEdit ? "Edit Admin" : "Add Admin",
    width: 520,
    customClass: { popup: "swal-user-popup" },
    html: `
      <div style="display:grid;gap:8px;text-align:left">
        <label>Supervisor ID</label>
        <input id="swalSupervisorId" class="swal2-input" placeholder="e.g. S002" value="${escapeAttr(isEdit ? (existingAdmin.supervisor_id || "") : "")}" ${isEdit ? "disabled" : ""}>
        <label>Name</label>
        <input id="swalSupervisorName" class="swal2-input" placeholder="Admin name" value="${escapeAttr(isEdit ? (existingAdmin.name || "") : "")}">
        <label>Email</label>
        <input id="swalSupervisorEmail" class="swal2-input" placeholder="Email" value="${escapeAttr(isEdit ? (existingAdmin.email || "") : "")}">
        <label>Status</label>
        <select id="swalSupervisorStatus" class="swal2-select">
          <option value="active" ${(isEdit ? String(existingAdmin.status || "active") : "active").toLowerCase() === "active" ? "selected" : ""}>active</option>
          <option value="inactive" ${(isEdit ? String(existingAdmin.status || "") : "").toLowerCase() === "inactive" ? "selected" : ""}>inactive</option>
        </select>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: isEdit ? "Save" : "Add",
    cancelButtonText: "Cancel",
    preConfirm: () => {
      const supervisor_id = document.getElementById("swalSupervisorId").value.trim();
      const name = document.getElementById("swalSupervisorName").value.trim();
      const email = document.getElementById("swalSupervisorEmail").value.trim();
      const status = document.getElementById("swalSupervisorStatus").value;
      if (!supervisor_id || !name) {
        Swal.showValidationMessage("Supervisor ID and Name are required");
        return false;
      }
      return { supervisor_id, name, email, status };
    }
  });
  if (!result.isConfirmed || !result.value) return;

  try {
    await callApi("upsertSupervisor", { payload: result.value });
    notify("บันทึกข้อมูล Admin สำเร็จ");
    if (state.supervisor && String(state.supervisor.supervisor_id) === String(result.value.supervisor_id)) {
      state.supervisor = { ...state.supervisor, ...result.value };
      el.topUserName.textContent = state.supervisor.name || state.supervisor.supervisor_id;
      el.topUserAvatar.textContent = getInitials(state.supervisor.name || state.supervisor.supervisor_id);
    }
    renderAdminTable();
  } catch (err) {
    notify(`บันทึกข้อมูล Admin ไม่สำเร็จ: ${err.message}`);
  }
}

async function openAddUserSwal(existingGuard) {
  if (!state.supervisor) return;
  const isEdit = !!existingGuard;

  if (!window.Swal) return;
  const result = await Swal.fire({
    title: isEdit ? "Edit User" : "Add User",
    width: 520,
    customClass: { popup: "swal-user-popup" },
    html: `
      <div style="display:grid;gap:8px;text-align:left">
        <label>Guard ID</label>
        <input id="swalGuardId" class="swal2-input" placeholder="e.g. G002" value="${escapeAttr(isEdit ? existingGuard.guard_id : "")}" ${isEdit ? "disabled" : ""}>
        <label>Name</label>
        <input id="swalGuardName" class="swal2-input" placeholder="Guard name" value="${escapeAttr(isEdit ? (existingGuard.name || "") : "")}">
        <label>Phone</label>
        <input id="swalGuardPhone" class="swal2-input" placeholder="Phone" value="${escapeAttr(isEdit ? (existingGuard.phone || "") : "")}">
        <label>Email</label>
        <input id="swalGuardEmail" class="swal2-input" placeholder="Email" value="${escapeAttr(isEdit ? (existingGuard.email || "") : "")}">
        <label>Status</label>
        <select id="swalGuardStatus" class="swal2-select">
          <option value="active" ${(isEdit ? String(existingGuard.status || "") : "active") === "active" ? "selected" : ""}>active</option>
          <option value="inactive" ${(isEdit ? String(existingGuard.status || "") : "") === "inactive" ? "selected" : ""}>inactive</option>
        </select>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: isEdit ? "Save" : "Add",
    cancelButtonText: "Cancel",
    preConfirm: () => {
      const guardId = document.getElementById("swalGuardId").value.trim();
      const name = document.getElementById("swalGuardName").value.trim();
      const phone = document.getElementById("swalGuardPhone").value.trim();
      const email = document.getElementById("swalGuardEmail").value.trim();
      const status = document.getElementById("swalGuardStatus").value;
      if (!guardId || !name) {
        Swal.showValidationMessage("Guard ID and Name are required");
        return false;
      }
      return { guard_id: guardId, name, phone, email, status };
    }
  });
  if (!result.isConfirmed || !result.value) return;

  try {
    const payload = {
      ...result.value
    };
    await callApi("upsertGuard", { payload });
    notify("บันทึกข้อมูล Guard สำเร็จ");
    await ensureGuardsLoaded(true);
  } catch (err) {
    notify(`บันทึกข้อมูล Guard ไม่สำเร็จ: ${err.message}`);
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
    title: isEdit ? "Edit Checkpoint" : "Add Checkpoint",
    width: "92vw",
    customClass: { popup: "swal-checkpoint-popup" },
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
          <span id="swalCpMapNotice" class="cp-label-note">Enter Latitude/Longitude manually or open Google Maps.</span>
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
    confirmButtonText: isEdit ? "Save" : "Add",
    cancelButtonText: "Cancel",
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
        Swal.showValidationMessage("Checkpoint ID, Name and QR Text are required");
        return false;
      }
      if (coords && !parsed) {
        Swal.showValidationMessage("Coordinates format must be like: 13.782520, 100.971532");
        return false;
      }
      return { checkpoint_id, checkpoint_name, qr_text, lat, lng, radius_m, is_photo_required, active };
    }
  });
  if (!result.isConfirmed || !result.value) return;

  try {
    await callApi("upsertCheckpoint", { payload: result.value });
    notify("บันทึกข้อมูล Checkpoint สำเร็จ");
    await ensureCheckpointsLoaded(true);
  } catch (err) {
    notify(`บันทึกข้อมูล Checkpoint ไม่สำเร็จ: ${err.message}`);
  }
}


function renderAdminTable() {
  if (!state.supervisor) {
    el.adminTableBody.innerHTML = '<tr><td colspan="4">No admin data</td></tr>';
    return;
  }

  el.adminTableBody.innerHTML = `
    <tr>
      <td>${escapeHtml(state.supervisor.supervisor_id || "-")}</td>
      <td>${escapeHtml(state.supervisor.name || "-")}</td>
      <td>${escapeHtml(state.supervisor.email || "-")}</td>
      <td class="row-actions">
        <button class="btn row-btn icon-btn" data-edit-admin="${escapeAttr(state.supervisor.supervisor_id || "")}" title="Edit" aria-label="Edit">
          ${iconEdit()}
        </button>
        <button class="btn row-btn icon-btn btn-danger-soft" data-del-admin="${escapeAttr(state.supervisor.supervisor_id || "")}" title="Delete" aria-label="Delete">
          ${iconTrash()}
        </button>
      </td>
    </tr>
  `;

  Array.from(el.adminTableBody.querySelectorAll("[data-edit-admin]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      openAddAdminSwal({
        supervisor_id: state.supervisor?.supervisor_id || "",
        name: state.supervisor?.name || "",
        email: state.supervisor?.email || "",
        status: "active"
      });
    });
  });

  Array.from(el.adminTableBody.querySelectorAll("[data-del-admin]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const supervisorId = btn.getAttribute("data-del-admin");
      if (!supervisorId) return;
      confirmDeleteAdmin({
        supervisor_id: supervisorId,
        name: state.supervisor?.name || ""
      });
    });
  });
}

function renderGuardsTable(rows) {
  if (!rows.length) {
    el.guardsTableBody.innerHTML = '<tr><td colspan="6">No guards found</td></tr>';
    return;
  }

  el.guardsTableBody.innerHTML = rows.map((g) => `
    <tr>
      <td>${escapeHtml(g.guard_id || "-")}</td>
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
    cancelButtonText: "Cancel",
    confirmButtonColor: "#d14343"
  });
  if (!result.isConfirmed) return;

  try {
    await callApi("deleteGuard", { guardId: guard.guard_id });
    notify("ลบ Guard สำเร็จ");
    state.guardsLoaded = false;
    await ensureGuardsLoaded(true);
  } catch (err) {
    notify(`ลบ Guard ไม่สำเร็จ: ${err.message}`);
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
    cancelButtonText: "Cancel",
    confirmButtonColor: "#d14343"
  });
  if (!result.isConfirmed) return;

  try {
    await callApi("deleteSupervisor", { supervisorId: admin.supervisor_id });
    notify("ลบ Admin สำเร็จ");
    if (state.supervisor && String(state.supervisor.supervisor_id) === String(admin.supervisor_id)) {
      logout();
      return;
    }
    renderAdminTable();
  } catch (err) {
    notify(`ลบ Admin ไม่สำเร็จ: ${err.message}`);
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
    notify("Checkpoint นี้ไม่มี QR Text");
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
    cancelButtonText: "Cancel",
    confirmButtonColor: "#d14343"
  });
  if (!result.isConfirmed) return;

  try {
    await callApi("deleteCheckpoint", { checkpointId: checkpoint.checkpoint_id });
    notify("ลบ Checkpoint สำเร็จ");
    state.checkpointsLoaded = false;
    await ensureCheckpointsLoaded(true);
  } catch (err) {
    notify(`ลบ Checkpoint ไม่สำเร็จ: ${err.message}`);
  }
}


async function openChangePasswordSwal() {
  closeTopUserMenu();
  if (!state.supervisor || !window.Swal) return;

  const result = await Swal.fire({
    title: "Change Password",
    width: 460,
    customClass: { popup: "swal-user-popup" },
    html: `
      <div style="display:grid;gap:8px;text-align:left">
        <label>New Password</label>
        <input id="swalNewPassword" class="swal2-input" type="password" placeholder="At least 6 characters">
        <label>Confirm Password</label>
        <input id="swalConfirmPassword" class="swal2-input" type="password" placeholder="Re-enter password">
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Save",
    cancelButtonText: "Cancel",
    preConfirm: () => {
      const newPassword = document.getElementById("swalNewPassword").value;
      const confirmPassword = document.getElementById("swalConfirmPassword").value;
      if (!newPassword || newPassword.length < 6) {
        Swal.showValidationMessage("Password must be at least 6 characters");
        return false;
      }
      if (newPassword !== confirmPassword) {
        Swal.showValidationMessage("Confirm password does not match");
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
    notify("Ã Â¹â‚¬Ã Â¸â€ºÃ Â¸Â¥Ã Â¸ÂµÃ Â¹Ë†Ã Â¸Â¢Ã Â¸â„¢Ã Â¸Â£Ã Â¸Â«Ã Â¸Â±Ã Â¸ÂªÃ Â¸Å“Ã Â¹Ë†Ã Â¸Â²Ã Â¸â„¢Ã Â¸ÂªÃ Â¸Â³Ã Â¹â‚¬Ã Â¸Â£Ã Â¹â€¡Ã Â¸Ë†");
  } catch (err) {
    notify(`Ã Â¹â‚¬Ã Â¸â€ºÃ Â¸Â¥Ã Â¸ÂµÃ Â¹Ë†Ã Â¸Â¢Ã Â¸â„¢Ã Â¸Â£Ã Â¸Â«Ã Â¸Â±Ã Â¸ÂªÃ Â¸Å“Ã Â¹Ë†Ã Â¸Â²Ã Â¸â„¢Ã Â¹â€žÃ Â¸Â¡Ã Â¹Ë†Ã Â¸ÂªÃ Â¸Â³Ã Â¹â‚¬Ã Â¸Â£Ã Â¹â€¡Ã Â¸Ë†: ${err.message}`);
  }
}

async function loadTemplateData() {
  if (!state.supervisor) return;
  const rows = await ensureTemplatesLoaded(true);
  if (rows.length) notify("โหลดข้อมูล Template สำเร็จ");
}

function renderTemplatesTable(rows) {
  if (!rows.length) {
    el.templatesTableBody.innerHTML = '<tr><td colspan="8">No templates</td></tr>';
    return;
  }

  el.templatesTableBody.innerHTML = rows.map((t) => `
    <tr>
      <td>${escapeHtml(t.template_id || "-")}</td>
      <td>${escapeHtml(t.template_name || "-")}</td>
      <td>${escapeHtml(formatTemplateGuardNames(t.guard_ids || t.guard_id))}</td>
      <td>${Number(t.rounds_per_shift || 1)}</td>
      <td>${escapeHtml(t.start_time || "-")}</td>
      <td>${escapeHtml(t.end_time || "-")}</td>
      <td>${escapeHtml(t.status || "ACTIVE")}</td>
      <td class="row-actions">
        <button class="btn row-btn icon-btn" data-edit-template="${escapeAttr(t.template_id)}" title="Edit" aria-label="Edit">
          ${iconEdit()}
        </button>
        <button class="btn row-btn icon-btn btn-danger-soft" data-del-template="${escapeAttr(t.template_id)}" title="Delete" aria-label="Delete">
          ${iconTrash()}
        </button>
      </td>
    </tr>
  `).join("");

  Array.from(el.templatesTableBody.querySelectorAll("[data-edit-template]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-template");
      const template = rows.find((x) => String(x.template_id) === String(id));
      if (!template) return;
      openTemplateSwal(template);
    });
  });

  Array.from(el.templatesTableBody.querySelectorAll("[data-del-template]")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del-template");
      const template = rows.find((x) => String(x.template_id) === String(id));
      if (!template) return;
      confirmDeleteTemplate(template);
    });
  });

}

async function confirmDeleteTemplate(template) {
  if (!window.Swal) return;
  const result = await Swal.fire({
    title: "Delete Template?",
    text: `${template.template_id} - ${template.template_name || ""}`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Delete",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#d14343"
  });
  if (!result.isConfirmed) return;

  try {
    await callApi("deleteShiftTemplate", { templateId: template.template_id });
    notify("ลบ Template สำเร็จ");
    state.templatesLoaded = false;
    await ensureTemplatesLoaded(true);
  } catch (err) {
    notify(`ลบ Template ไม่สำเร็จ: ${err.message}`);
  }
}

async function openTemplateSwal(existingTemplate) {
  const isEdit = !!existingTemplate;
  const defaultTemplateId = isEdit ? String(existingTemplate.template_id || "") : generateNextTemplateId();
  const selectedGuardIds = parseGuardIdsLocal(isEdit ? (existingTemplate.guard_ids || existingTemplate.guard_id || "") : "");
  let initialRouteRows = [];
  if (isEdit) {
    try {
      const route = await callApi("listTemplateCheckpoints", { templateId: defaultTemplateId });
      initialRouteRows = Array.isArray(route) ? route : [];
    } catch (_) {
      initialRouteRows = [];
    }
  }

  const cpOptions = (state.checkpoints || []).map((cp) => {
    return `<option value="${escapeAttr(cp.checkpoint_id)}">${escapeHtml(cp.checkpoint_id)} - ${escapeHtml(cp.checkpoint_name || "-")}</option>`;
  }).join("");
  const guardOptions = (state.guards || []).map((g) => {
    const gid = String(g.guard_id || "");
    if (!gid) return "";
    return `<option value="${escapeAttr(gid)}">${escapeHtml(gid)} - ${escapeHtml(g.name || "-")}</option>`;
  }).join("");
  const guardRows = (selectedGuardIds.length ? selectedGuardIds : [""]).map((id) => ({
    guard_id: String(id || "").trim()
  }));
  const routeRows = (initialRouteRows || []).map((r) => ({
    seq_no: Number(r.seq_no || 1),
    checkpoint_id: String(r.checkpoint_id || "")
  }));

  const result = await Swal.fire({
    title: isEdit ? "Edit Template" : "Add Template",
    width: "94vw",
    customClass: { popup: "swal-user-popup" },
    html: `
      <div class="template-popup-layout">
        <div class="template-form-grid">
          <div class="template-field">
            <label>Template ID</label>
            <input id="swalTemplateId" class="swal2-input" value="${escapeAttr(defaultTemplateId)}" readonly>
          </div>
          <div class="template-field">
            <label>Template Name</label>
            <input id="swalTemplateName" class="swal2-input" value="${escapeAttr(isEdit ? (existingTemplate.template_name || "") : "")}" placeholder="e.g. Day / Night">
          </div>
          <div class="template-field">
            <label>Rounds per Shift</label>
            <input id="swalTemplateRounds" class="swal2-input" type="number" min="1" step="1" value="${escapeAttr(isEdit ? Number(existingTemplate.rounds_per_shift || 1) : 1)}">
          </div>
          <div class="template-field">
            <label>Status</label>
            <select id="swalTemplateStatus" class="swal2-select">
              <option value="ACTIVE" ${String(isEdit ? existingTemplate.status : "ACTIVE").toUpperCase() === "ACTIVE" ? "selected" : ""}>ACTIVE</option>
              <option value="INACTIVE" ${String(isEdit ? existingTemplate.status : "").toUpperCase() === "INACTIVE" ? "selected" : ""}>INACTIVE</option>
            </select>
          </div>
          <div class="template-field">
            <label>Start Time</label>
            <input id="swalTemplateStart" class="swal2-input" type="time" value="${escapeAttr(toHm(isEdit ? existingTemplate.start_time : "08:00"))}">
          </div>
          <div class="template-field">
            <label>End Time</label>
            <input id="swalTemplateEnd" class="swal2-input" type="time" value="${escapeAttr(toHm(isEdit ? existingTemplate.end_time : "17:00"))}">
          </div>
        </div>
        <div class="template-route-panel">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <label style="margin:0">Route Checkpoints</label>
            <button id="swalTemplateAddRouteRow" type="button" class="btn template-add-route-btn">+ Add</button>
          </div>
          <div class="table-wrap" style="max-height:34vh;overflow:auto">
            <table class="data-table" style="min-width:360px">
              <thead>
                <tr><th>Seq</th><th>Checkpoint</th><th>Action</th></tr>
              </thead>
              <tbody id="swalTemplateRouteBody"></tbody>
            </table>
          </div>
        </div>
        <div class="template-guard-panel">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <label style="margin:0">Guards</label>
            <button id="swalTemplateAddGuardRow" type="button" class="btn template-add-route-btn">+ Add</button>
          </div>
          <div class="table-wrap" style="max-height:34vh;overflow:auto">
            <table class="data-table" style="min-width:300px">
              <thead>
                <tr><th>Guard</th><th>Action</th></tr>
              </thead>
              <tbody id="swalTemplateGuardBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: isEdit ? "Save" : "Add",
    cancelButtonText: "Cancel",
    didOpen: () => {
      const syncRowsFromDom = () => {
        const seqEls = Array.from(document.querySelectorAll(".route-seq"));
        const cpEls = Array.from(document.querySelectorAll(".route-cp"));
        if (!cpEls.length) return;
        const draft = cpEls.map((cpEl, idx) => ({
          seq_no: Number(seqEls[idx]?.value || 0),
          checkpoint_id: String(cpEl.value || "").trim()
        }));
        routeRows.splice(0, routeRows.length, ...draft);
      };
      const syncGuardRowsFromDom = () => {
        const guardEls = Array.from(document.querySelectorAll(".guard-select"));
        if (!guardEls.length) return;
        const draft = guardEls.map((guardEl) => ({
          guard_id: String(guardEl.value || "").trim()
        }));
        guardRows.splice(0, guardRows.length, ...draft);
      };

      const tableHtml = () => {
        if (!routeRows.length) return '<tr><td colspan="3">No checkpoints in route</td></tr>';
        return routeRows.map((r, i) => `
          <tr>
            <td><input class="swal2-input route-seq" data-idx="${i}" type="number" min="1" value="${r.seq_no}" style="width:90px;margin:0!important"></td>
            <td>
              <select class="swal2-select route-cp" data-idx="${i}" style="width:100%;margin:0!important">
                <option value="">Select checkpoint</option>
                ${cpOptions.replace(`value="${escapeAttr(r.checkpoint_id)}"`, `value="${escapeAttr(r.checkpoint_id)}" selected`)}
              </select>
            </td>
            <td><button type="button" class="btn row-btn btn-danger-soft route-del" data-idx="${i}">Delete</button></td>
          </tr>
        `).join("");
      };
      const guardTableHtml = () => {
        if (!guardOptions) return '<tr><td colspan="2">No guards available</td></tr>';
        if (!guardRows.length) return '<tr><td colspan="2">No guards selected</td></tr>';
        return guardRows.map((r, i) => `
          <tr>
            <td>
              <select class="swal2-select guard-select" data-idx="${i}" style="width:100%;margin:0!important">
                <option value="">Select guard</option>
                ${guardOptions.replace(`value="${escapeAttr(r.guard_id)}"`, `value="${escapeAttr(r.guard_id)}" selected`)}
              </select>
            </td>
            <td><button type="button" class="btn row-btn btn-danger-soft guard-del" data-idx="${i}">Delete</button></td>
          </tr>
        `).join("");
      };

      const rerender = () => {
        const body = document.getElementById("swalTemplateRouteBody");
        if (!body) return;
        body.innerHTML = tableHtml();
        Array.from(body.querySelectorAll(".route-del")).forEach((btn) => {
          btn.addEventListener("click", () => {
            syncRowsFromDom();
            const idx = Number(btn.getAttribute("data-idx"));
            if (Number.isFinite(idx) && idx >= 0) {
              routeRows.splice(idx, 1);
              rerender();
            }
          });
        });
      };
      const rerenderGuards = () => {
        const body = document.getElementById("swalTemplateGuardBody");
        if (!body) return;
        body.innerHTML = guardTableHtml();
        Array.from(body.querySelectorAll(".guard-del")).forEach((btn) => {
          btn.addEventListener("click", () => {
            syncGuardRowsFromDom();
            const idx = Number(btn.getAttribute("data-idx"));
            if (Number.isFinite(idx) && idx >= 0) {
              guardRows.splice(idx, 1);
              rerenderGuards();
            }
          });
        });
      };

      const addBtn = document.getElementById("swalTemplateAddRouteRow");
      if (addBtn) {
        addBtn.addEventListener("click", () => {
          syncRowsFromDom();
          routeRows.push({ seq_no: routeRows.length + 1, checkpoint_id: "" });
          rerender();
        });
      }
      const addGuardBtn = document.getElementById("swalTemplateAddGuardRow");
      if (addGuardBtn) {
        addGuardBtn.addEventListener("click", () => {
          syncGuardRowsFromDom();
          guardRows.push({ guard_id: "" });
          rerenderGuards();
        });
      }
      rerender();
      rerenderGuards();
    },
    preConfirm: () => {
      const template_id = document.getElementById("swalTemplateId").value.trim();
      const template_name = document.getElementById("swalTemplateName").value.trim();
      const rounds_per_shift = Number(document.getElementById("swalTemplateRounds").value || 1);
      const start_time = normalizeTime(document.getElementById("swalTemplateStart").value);
      const end_time = normalizeTime(document.getElementById("swalTemplateEnd").value);
      const status = document.getElementById("swalTemplateStatus").value;
      const guardIdsRaw = Array.from(document.querySelectorAll(".guard-select"))
        .map((node) => String(node.value || "").trim())
        .filter(Boolean);
      const guardIds = [];
      const uniq = {};
      guardIdsRaw.forEach((id) => {
        if (uniq[id]) return;
        uniq[id] = true;
        guardIds.push(id);
      });
      if (!template_id || !template_name || !start_time || !end_time || !Number.isFinite(rounds_per_shift) || rounds_per_shift < 1) {
        Swal.showValidationMessage("Please fill all required fields");
        return false;
      }
      if (!guardIds.length) {
        Swal.showValidationMessage("Please select at least 1 guard");
        return false;
      }

      const seqEls = Array.from(document.querySelectorAll(".route-seq"));
      const cpEls = Array.from(document.querySelectorAll(".route-cp"));
      if (!cpEls.length) {
        Swal.showValidationMessage("Please add at least 1 checkpoint in route");
        return false;
      }
      const routeItems = cpEls.map((cpEl, idx) => ({
        seq_no: Number(seqEls[idx]?.value || 0),
        checkpoint_id: String(cpEl.value || "").trim()
      }));
      if (routeItems.some((x) => !x.seq_no || !x.checkpoint_id)) {
        Swal.showValidationMessage("Each route row requires Seq and Checkpoint");
        return false;
      }

      return {
        payload: {
          template_id,
          template_name,
          shift_name: template_name,
          guard_id: guardIds[0],
          guard_ids: guardIds,
          rounds_per_shift: Math.floor(rounds_per_shift),
          start_time,
          end_time,
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
    await loadTemplateData();
    notify("บันทึกข้อมูล Template สำเร็จ");
  } catch (err) {
    notify(`บันทึกข้อมูล Template ไม่สำเร็จ: ${err.message}`);
  }
}

async function openTemplateRouteSwal(template) {

  notify("จัดการ Route ผ่านหน้าจอ Edit Template", "warning");
}


