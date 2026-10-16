/* Users (administrators only) and Settings (everyone). */
(() => {
  const byId = new Map();
  let meId = 0;

  function row(u) {
    byId.set(u.id, u);
    const self = u.id === meId;
    return `<tr><td>${App.code("USR", u.id)}</td><td><strong>${esc(u.fullName)}</strong><small>@${esc(u.username)}</small></td><td>${esc(ROLE_LABEL[u.role] || u.role)}</td><td>${esc(u.email)}</td>
      <td><button type="button" class="switch ${u.isActive ? "on" : ""}" data-toggle="${u.id}" ${self ? "disabled" : ""} role="switch" aria-checked="${u.isActive}" aria-label="Account active" title="${self ? "You can't deactivate yourself" : u.isActive ? "Active — click to deactivate" : "Inactive — click to activate"}"></button></td>
      <td>${u.lastLogin ? esc(fmtDateTime(u.lastLogin)) : '<span class="muted">Never</span>'}</td>
      <td><div class="tbl-actions">${App.iconBtn("edit", "ib-edit", `data-edit="${u.id}"`, "Edit user")}${App.iconBtn("key", "ib-view", `data-key="${u.id}"`, "Reset password")}${self ? "" : App.iconBtn("trash", "ib-del", `data-del="${u.id}"`, "Delete user")}</div></td></tr>`;
  }

  const roleOpts = [
    ["staff", "Staff"],
    ["dentist", "Dentist"],
    ["admin", "Administrator"],
  ];
  const userFields = (creating) => [
    { name: "firstName", label: "First name", required: true },
    { name: "lastName", label: "Last name", required: true },
    {
      name: "email",
      label: "Email",
      type: "email",
      required: true,
      full: true,
    },
    {
      name: "phone",
      label: "Phone number",
      type: "tel",
      required: true,
      placeholder: "09XX XXX XXXX",
    },
    {
      name: "role",
      label: "Role",
      type: "select",
      required: true,
      options: roleOpts,
    },
    ...(creating
      ? [
          { name: "username", label: "Username", required: true },
          {
            name: "password",
            label: "Password (optional)",
            type: "password",
            hint: "Leave blank to generate a temporary password.",
          },
        ]
      : []),
  ];

  async function load() {
    const r = await api("admin_users.php");
    meId = r.meId;
    const c = r.counts;
    $("#usCards").innerHTML = App.statCards([
      {
        icon: "users",
        tone: "blue",
        label: "Total Users",
        value: App.num(c.total),
      },
      {
        icon: "shield",
        tone: "green",
        label: "Administrators",
        value: App.num(c.admin),
      },
      {
        icon: "tooth",
        tone: "violet",
        label: "Dentists",
        value: App.num(c.dentist),
      },
      { icon: "user", tone: "blue", label: "Staff", value: App.num(c.staff) },
    ]);
    byId.clear();
    $("#usTable").innerHTML = App.table(
      ["User ID", "Name", "Role", "Email", "Status", "Last Login", "Action"],
      r.users.map(row),
      "No users.",
    );
  }

  App.views.users = {
    async show(el) {
      el.innerHTML = `<div class="toolbar"><span class="grow"></span><button class="btn btn-primary" id="usNew" type="button">${icon("plus", 16)} Add New User</button></div>
        <div class="cards" id="usCards"></div><div class="panel" id="usTable"></div>
        <p class="slot-hint" style="margin-top:10px">Patients are managed under Patients. Deactivated users can't sign in.</p>`;
      $("#usNew").addEventListener("click", () =>
        App.form({
          title: "Add new user",
          sub: "Staff, dentist or administrator account for the admin panel.",
          fields: userFields(true),
          values: { role: "staff" },
          submit: "Create user",
          async onSubmit(v) {
            const r = await api("admin_users.php", {
              method: "POST",
              body: { action: "create", ...v },
            });
            App.refresh();
            if (r.tempPassword)
              App.secret({
                title: "User created",
                sub: `${v.firstName} ${v.lastName}`,
                username: r.username,
                password: r.tempPassword,
              });
            else App.toast("User created.");
            return r.tempPassword ? "keep" : undefined;
          },
        }),
      );
      $("#usTable").addEventListener("click", async (e) => {
        const t = e.target.closest("[data-toggle]"),
          ed = e.target.closest("[data-edit]"),
          k = e.target.closest("[data-key]"),
          d = e.target.closest("[data-del]");
        try {
          if (t) {
            const u = byId.get(+t.dataset.toggle);
            await api("admin_users.php", {
              method: "POST",
              body: { action: "set_active", id: u.id, active: !u.isActive },
            });
            App.toast(u.isActive ? "User deactivated." : "User activated.");
            await load();
          } else if (ed) {
            const u = byId.get(+ed.dataset.edit);
            App.form({
              title: "Edit user",
              sub: `${App.code("USR", u.id)} · @${u.username}`,
              fields: userFields(false),
              values: u,
              async onSubmit(v) {
                await api("admin_users.php", {
                  method: "POST",
                  body: { action: "update", id: u.id, ...v },
                });
                App.toast("User updated.");
                App.refresh();
              },
            });
          } else if (k) {
            const u = byId.get(+k.dataset.key);
            if (
              await App.confirm({
                title: `Reset ${u.fullName}'s password?`,
                text: "A new temporary password will replace the old one.",
                confirmText: "Reset password",
              })
            ) {
              const r = await api("admin_users.php", {
                method: "POST",
                body: { action: "reset_password", id: u.id },
              });
              App.secret({
                title: "Password reset",
                sub: u.fullName,
                username: r.username,
                password: r.tempPassword,
              });
            }
          } else if (d) {
            const u = byId.get(+d.dataset.del);
            if (
              await App.confirm({
                title: `Delete ${u.fullName}?`,
                text: "Their account is removed. Appointments they handled are kept.",
                confirmText: "Delete user",
              })
            ) {
              await api("admin_users.php", {
                method: "POST",
                body: { action: "delete", id: u.id },
              });
              App.toast("User deleted.");
              await load();
            }
          }
        } catch (err) {
          App.fail(err);
        }
      });
      await load();
    },
  };

  /* ---------- Settings ---------- */
  App.views.settings = {
    async show(el) {
      const u = App.me;
      el.innerHTML = `<div class="grid-2b">
        <div class="panel"><div class="panel-h"><h3>My account</h3></div>
          <dl class="kv"><dt>Name</dt><dd>${esc(u.fullName)}</dd><dt>Username</dt><dd>@${esc(u.username)}</dd><dt>Role</dt><dd>${esc(ROLE_LABEL[u.role] || u.role)}</dd>
            <dt>Email</dt><dd>${esc(u.email)}</dd><dt>Phone</dt><dd>${esc(u.phone)}</dd></dl></div>
        <div class="panel"><div class="panel-h"><h3>Change password</h3></div>
          <form id="pwForm" novalidate>
            <div class="f-row"><label for="pwCur">Current password</label><input type="password" id="pwCur" autocomplete="current-password" /></div>
            <div class="f-row"><label for="pwNew">New password</label><input type="password" id="pwNew" autocomplete="new-password" /><span class="slot-hint">At least 8 characters, with a number and a lowercase letter.</span></div>
            <div class="f-row"><label for="pwNew2">Confirm new password</label><input type="password" id="pwNew2" autocomplete="new-password" /></div>
            <p class="modal-err" id="pwErr"></p>
            <button class="btn btn-primary" id="pwBtn" type="submit">Update password</button>
          </form></div></div>`;
      $("#pwForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = $("#pwErr"),
          btn = $("#pwBtn");
        err.textContent = "";
        btn.disabled = true;
        try {
          await api("change_password.php", {
            method: "POST",
            body: {
              current: $("#pwCur").value,
              password: $("#pwNew").value,
              confirmPassword: $("#pwNew2").value,
            },
          });
          ["#pwCur", "#pwNew", "#pwNew2"].forEach((s) => ($(s).value = ""));
          App.toast("Password updated.");
        } catch (ex) {
          err.textContent = ex.message;
        }
        btn.disabled = false;
      });
    },
  };
})();
