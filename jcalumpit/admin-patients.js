/* Patients: list, add / edit / delete, reset password, full patient profile. */
(() => {
  const st = { q: "" };
  const byId = new Map();

  function row(p) {
    byId.set(p.id, p);
    return `<tr>
      <td>${App.code("PT", p.id)}</td>
      <td><strong>${esc(p.fullName)}</strong><small>@${esc(p.username)}</small></td>
      <td>${esc(App.cap(p.gender))}</td><td>${esc(p.phone)}</td><td>${esc(p.email)}</td>
      <td>${p.lastVisit ? esc(fmtDate(p.lastVisit)) : "—"}</td>
      <td>${p.due > 0 ? `<strong class="down">${esc(peso(p.due))}</strong>` : "—"}</td>
      <td><div class="tbl-actions">${App.iconBtn("eye", "ib-view", `data-view="${p.id}"`, "View patient")}${App.iconBtn("edit", "ib-edit", `data-edit="${p.id}"`, "Edit patient")}${App.isAdmin() ? App.iconBtn("trash", "ib-del", `data-del="${p.id}"`, "Delete patient") : ""}</div></td></tr>`;
  }

  async function load() {
    const r = await api("admin_patients.php?q=" + encodeURIComponent(st.q));
    const s = r.stats;
    $("#ptCards").innerHTML = App.statCards([
      {
        icon: "users",
        tone: "blue",
        label: "Total Patients",
        value: App.num(s.total),
      },
      { icon: "male", tone: "blue", label: "Male", value: App.num(s.male) },
      {
        icon: "female",
        tone: "pink",
        label: "Female",
        value: App.num(s.female),
      },
      {
        icon: "plus",
        tone: "green",
        label: "New This Month",
        value: App.num(s.newMonth),
      },
    ]);
    byId.clear();
    $("#ptTable").innerHTML = App.table(
      [
        "Patient ID",
        "Patient Name",
        "Gender",
        "Phone",
        "Email",
        "Last Visit",
        "Balance",
        "Action",
      ],
      r.patients.map(row),
      "No patients found.",
    );
  }

  App.views.patients = {
    async show(el) {
      el.innerHTML = `
        <div class="toolbar">${App.searchBox("ptQ", "Search patient name, email, phone or address", st.q)}
          <button class="btn btn-primary" id="ptNew" type="button">${icon("plus", 16)} Add New Patient</button></div>
        <div class="cards" id="ptCards"></div><div class="panel" id="ptTable"></div>`;
      $("#ptQ").addEventListener(
        "input",
        App.debounce(
          (e) => ((st.q = e.target.value.trim()), load().catch(App.fail)),
        ),
      );
      $("#ptNew").addEventListener("click", () => App.newPatient());
      $("#ptTable").addEventListener("click", async (e) => {
        const v = e.target.closest("[data-view]"),
          ed = e.target.closest("[data-edit]"),
          d = e.target.closest("[data-del]");
        if (v) return viewPatient(+v.dataset.view);
        if (ed) return editPatient(byId.get(+ed.dataset.edit));
        if (d) {
          const p = byId.get(+d.dataset.del);
          if (
            await App.confirm({
              title: `Delete ${p.fullName}?`,
              text: "This also deletes their appointments, payments, records and treatments. This can't be undone.",
              confirmText: "Delete patient",
            })
          ) {
            try {
              await api("admin_patients.php", {
                method: "POST",
                body: { action: "delete", id: p.id },
              });
              App._patients = null;
              App.toast("Patient deleted.");
              load();
            } catch (err) {
              App.fail(err);
            }
          }
        }
      });
      await load();
    },
  };

  const profileFields = (creating) => [
    { name: "firstName", label: "First name", required: true },
    { name: "middleName", label: "Middle name" },
    { name: "lastName", label: "Last name", required: true },
    {
      name: "gender",
      label: "Gender",
      type: "select",
      required: true,
      options: [
        ["", "Select gender"],
        ["male", "Male"],
        ["female", "Female"],
        ["non-binary", "Non-binary"],
        ["prefer-not-to-say", "Prefer not to say"],
      ],
    },
    {
      name: "birthDate",
      label: "Birth date",
      type: "date",
      required: true,
      max: App.todayIso(),
    },
    {
      name: "phone",
      label: "Phone number",
      type: "tel",
      required: true,
      placeholder: "09XX XXX XXXX",
    },
    {
      name: "email",
      label: "Email",
      type: "email",
      required: true,
      full: true,
    },
    {
      name: "address",
      label: "Address",
      required: true,
      full: true,
      placeholder: "House no., street, barangay, city",
    },
    ...(creating
      ? [
          {
            name: "username",
            label: "Username (optional)",
            full: true,
            hint: "Leave blank to create one automatically.",
          },
        ]
      : []),
  ];

  App.newPatient = function () {
    App.form({
      title: "Add new patient",
      sub: "For walk-ins and phone bookings. A temporary password is generated for them.",
      fields: profileFields(true),
      submit: "Add patient",
      async onSubmit(v) {
        const r = await api("admin_patients.php", {
          method: "POST",
          body: { action: "create", ...v },
        });
        App._patients = null;
        App.refresh();
        App.secret({
          title: "Patient added",
          sub: `${v.firstName} ${v.lastName} can now sign in.`,
          username: r.username,
          password: r.tempPassword,
        });
        return "keep";
      },
    });
  };

  function editPatient(p) {
    if (!p) return;
    App.form({
      title: "Edit patient",
      sub: `${App.code("PT", p.id)} · @${p.username}`,
      fields: profileFields(false),
      values: p,
      async onSubmit(v) {
        await api("admin_patients.php", {
          method: "POST",
          body: { action: "update", id: p.id, ...v },
        });
        App._patients = null;
        App.toast("Patient updated.");
        App.refresh();
      },
    });
  }

  async function viewPatient(id) {
    let r;
    try {
      r = await api("admin_patients.php?id=" + id);
    } catch (e) {
      return App.fail(e);
    }
    const p = r.patient,
      b = r.billing;
    const visits = r.appointments.map(
      (
        a,
      ) => `<tr><td>${esc(fmtDate(a.date))}<small>${esc(a.timeLabel)}</small></td><td>${esc(a.service)}</td><td>${statusBadge(a.status)}</td>
        <td>${a.billable && a.fee > 0 ? `${esc(peso(a.fee))}<small>${a.balance > 0 ? "Balance " + esc(peso(a.balance)) : "Paid"}</small>` : "—"}</td></tr>`,
    );
    const treatments = r.treatments.map(
      (t) =>
        `<tr><td>${esc(t.name)}</td><td>${esc(t.dentist)}</td><td>${esc(fmtDate(t.start_date))}</td><td>${App.trBadge(t.status)}</td></tr>`,
    );
    const records = r.records.map(
      (x) =>
        `<tr><td>${esc(x.title)}</td><td>${esc(App.recLabel(x.record_type))}</td><td>${esc(fmtDate(x.record_date))}</td></tr>`,
    );
    App.dialog({
      title: p.fullName,
      sub: `${App.code("PT", p.id)} · patient since ${fmtDate(p.joined, true)}`,
      wide: true,
      html: `<dl class="kv">
          <dt>Username</dt><dd>@${esc(p.username)}</dd><dt>Phone</dt><dd>${esc(p.phone)}</dd><dt>Email</dt><dd>${esc(p.email)}</dd>
          <dt>Address</dt><dd>${esc(p.address || "—")}</dd><dt>Birth date</dt><dd>${esc(fmtDate(p.birthDate, true))} (${p.age} yrs)</dd><dt>Gender</dt><dd>${esc(App.cap(p.gender))}</dd></dl>
        <div class="chips"><div class="chip"><span>Total billed</span><strong>${esc(peso(b.billed))}</strong></div><div class="chip"><span>Total paid</span><strong>${esc(peso(b.paid))}</strong></div>
          <div class="chip"><span>Remaining balance</span><strong class="${b.due > 0 ? "down" : "up"}">${esc(peso(b.due))}</strong></div></div>
        <h4 class="dlg-h4">Visit history</h4>${App.table(["Date", "Service", "Status", "Fee"], visits, "No appointments yet.")}
        <h4 class="dlg-h4">Treatments</h4>${App.table(["Treatment", "Dentist", "Start", "Status"], treatments, "No treatments yet.")}
        <h4 class="dlg-h4">Records</h4>${App.table(["Title", "Type", "Date"], records, "No records yet.")}`,
      buttons: [
        { label: "Edit", onClick: () => editPatient({ ...p, id: p.id }) },
        {
          label: "Reset password",
          onClick: async () => {
            if (
              !(await App.confirm({
                title: "Reset this patient's password?",
                text: "A new temporary password will replace the old one.",
                confirmText: "Reset password",
              }))
            )
              return;
            try {
              const x = await api("admin_patients.php", {
                method: "POST",
                body: { action: "reset_password", id: p.id },
              });
              App.secret({
                title: "Password reset",
                sub: p.fullName,
                username: x.username,
                password: x.tempPassword,
              });
            } catch (e) {
              App.fail(e);
            }
          },
        },
        { label: "Close", cls: "btn-primary", onClick: App.close },
      ],
    });
  }
})();
