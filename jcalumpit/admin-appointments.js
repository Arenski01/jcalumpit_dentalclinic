/* Appointments: tabs, filters, approve / reschedule / decline / complete / cancel, staff-made bookings. */
(() => {
  const st = { tab: "all", q: "", from: "", to: "" };
  const TABS = [
    ["all", "All Appointments"],
    ["pending", "Pending"],
    ["upcoming", "Upcoming"],
    ["completed", "Completed"],
    ["cancelled", "Cancelled"],
  ];
  const ACT = {
    approve: ["Approve appointment", "Approve"],
    decline: ["Decline appointment", "Decline"],
    reschedule: ["Reschedule appointment", "Save new time"],
    complete: ["Mark as completed", "Mark completed"],
    cancel: ["Cancel appointment", "Cancel appointment"],
  };
  const rows = new Map();

  function query() {
    const p = new URLSearchParams();
    if (st.tab === "pending") p.set("status", "pending");
    if (st.tab === "upcoming")
      (p.set("status", "approved,rescheduled"), p.set("range", "upcoming"));
    if (st.tab === "completed")
      (p.set("status", "completed"), p.set("sort", "desc"));
    if (st.tab === "cancelled")
      (p.set("status", "cancelled,declined"), p.set("sort", "desc"));
    if (st.from) p.set("from", st.from);
    if (st.to) p.set("to", st.to);
    if (st.q) p.set("q", st.q);
    return p.toString();
  }

  function btns(a) {
    const b = (act, label, cls) =>
      `<button type="button" class="btn btn-sm ${cls}" data-act="${act}" data-id="${a.id}">${label}</button>`;
    let h = "";
    if (a.status === "pending")
      h =
        b("approve", "Approve", "btn-ok") +
        b("reschedule", "Reschedule", "btn-ghost") +
        b("decline", "Decline", "btn-danger");
    else if (a.status === "approved" || a.status === "rescheduled")
      h =
        b("reschedule", "Reschedule", "btn-ghost") +
        (a.date <= App.todayIso() ? b("complete", "Complete", "btn-ok") : "") +
        b("cancel", "Cancel", "btn-danger");
    else h = '<span class="muted">—</span>';
    if (App.isAdmin())
      h += App.iconBtn(
        "trash",
        "ib-del",
        `data-del="${a.id}"`,
        "Delete appointment",
      );
    return h;
  }

  function row(a) {
    rows.set(a.id, a);
    return `<tr>
      <td>${esc(a.timeLabel)}</td>
      <td><strong>${esc(a.patientName)}</strong><small>${esc(a.phone)}</small>${a.notes ? `<small>“${esc(a.notes)}”</small>` : ""}</td>
      <td>${esc(a.service)}</td><td>${esc(a.dentist)}</td>
      <td>${esc(fmtDate(a.date))}${a.status === "rescheduled" && a.prevDate ? `<small>was ${esc(fmtDate(a.prevDate))}, ${esc(a.prevTimeLabel)}</small>` : ""}</td>
      <td>${statusBadge(a.status)}${a.adminNote ? `<small>${esc(a.adminNote)}</small>` : ""}</td>
      <td><div class="tbl-actions">${btns(a)}</div></td></tr>`;
  }

  async function load() {
    const r = await api("admin_appointments.php?" + query());
    const c = r.counts;
    $("#apCards").innerHTML = App.statCards([
      {
        icon: "calendar",
        tone: "blue",
        label: "Total Appointments",
        value: App.num(c.total),
      },
      {
        icon: "clock",
        tone: "orange",
        label: "Pending",
        value: App.num(c.pending),
      },
      {
        icon: "calendar",
        tone: "green",
        label: "Upcoming",
        value: App.num(c.upcoming),
      },
      {
        icon: "check",
        tone: "violet",
        label: "Completed",
        value: App.num(c.completed),
      },
      {
        icon: "x",
        tone: "red",
        label: "Cancelled / Declined",
        value: App.num(c.cancelled),
      },
    ]);
    r.appointments.forEach((a) => rows.set(a.id, a));
    $("#apTable").innerHTML = App.table(
      ["Time", "Patient", "Service", "Dentist", "Date", "Status", "Action"],
      r.appointments.map(row),
      "No appointments match these filters.",
    );
    App.refreshBell();
  }

  App.views.appointments = {
    async show(el) {
      if (App.nextOpts.tab) st.tab = App.nextOpts.tab;
      el.innerHTML = `
        <div class="tabs">${TABS.map(([k, l]) => `<button class="tab ${st.tab === k ? "active" : ""}" data-tab="${k}">${l}</button>`).join("")}</div>
        <div class="toolbar">
          ${App.searchBox("apQ", "Search patient, phone, email or service", st.q)}
          <input type="date" id="apFrom" value="${esc(st.from)}" title="From date" />
          <input type="date" id="apTo" value="${esc(st.to)}" title="To date" />
          <button class="btn btn-ghost" id="apReset" type="button">Reset</button>
          <button class="btn btn-primary" id="apNew" type="button">${icon("plus", 16)} New Appointment</button>
        </div>
        <div class="cards five" id="apCards"></div>
        <div class="panel" id="apTable"></div>`;

      $$(".tab", el).forEach((t) =>
        t.addEventListener("click", () => {
          st.tab = t.dataset.tab;
          $$(".tab", el).forEach((x) => x.classList.toggle("active", x === t));
          load().catch(App.fail);
        }),
      );
      $("#apQ").addEventListener(
        "input",
        App.debounce(
          (e) => ((st.q = e.target.value.trim()), load().catch(App.fail)),
        ),
      );
      $("#apFrom").addEventListener(
        "change",
        (e) => ((st.from = e.target.value), load().catch(App.fail)),
      );
      $("#apTo").addEventListener(
        "change",
        (e) => ((st.to = e.target.value), load().catch(App.fail)),
      );
      $("#apReset").addEventListener("click", () => {
        Object.assign(st, { tab: "all", q: "", from: "", to: "" });
        App.go("appointments");
      });
      $("#apNew").addEventListener("click", () => App.newAppointment());
      $("#apTable").addEventListener("click", async (e) => {
        const b = e.target.closest("[data-act]");
        if (b) return App.apptAction(rows.get(+b.dataset.id), b.dataset.act);
        const d = e.target.closest("[data-del]");
        if (
          d &&
          (await App.confirm({
            title: "Delete this appointment?",
            text: "This also removes its payments. This can't be undone.",
            confirmText: "Delete",
          }))
        ) {
          try {
            await api("admin_appointments.php", {
              method: "POST",
              body: { action: "delete", id: +d.dataset.del },
            });
            App.toast("Appointment deleted.");
            load();
          } catch (err) {
            App.fail(err);
          }
        }
      });
      await load();
    },
  };

  App.apptAction = function (a, action) {
    if (!a) return;
    const [title, label] = ACT[action];
    const fields = [];
    if (action === "reschedule") {
      fields.push(
        {
          name: "date",
          label: "New date",
          type: "date",
          required: true,
          min: App.todayIso(),
        },
        {
          name: "time",
          label: "New time",
          type: "select",
          required: true,
          options: [["", "Pick a date first"]],
          hint: "Taken times are disabled.",
        },
      );
    }
    fields.push({
      name: "note",
      label: "Message to the patient (optional)",
      type: "textarea",
      rows: 3,
      maxlength: 500,
      placeholder: "Shown on the patient's My Appointments page.",
    });
    App.form({
      title,
      sub: `${a.patientName} · ${a.service} · ${fmtDate(a.date)} at ${a.timeLabel}`,
      fields,
      values: { note: a.adminNote || "" },
      submit: label,
      onOpen: () => {
        if (action !== "reschedule") return;
        $("#f_date").addEventListener("change", () =>
          App.loadSlots(
            $("#f_date").value,
            $("#f_time"),
            $("#f_time").parentElement.querySelector(".slot-hint"),
            a.id,
          ),
        );
      },
      async onSubmit(v) {
        const body = { id: a.id, action, note: v.note };
        if (action === "reschedule")
          Object.assign(body, { date: v.date, time: v.time });
        await api("admin_appointments.php", { method: "POST", body });
        App.toast("Appointment updated.");
        App.refresh();
      },
    });
  };

  App.newAppointment = async function () {
    let patients, dentists;
    try {
      [patients, dentists] = await Promise.all([
        App.patients(true),
        App.dentists(),
      ]);
    } catch (e) {
      return App.fail(e);
    }
    if (!patients.length)
      return App.toast("There are no patients yet. Add a patient first.", true);
    App.form({
      title: "New appointment",
      sub: "Booked by staff for a patient. It is approved right away.",
      fields: [
        {
          name: "patientId",
          label: "Patient",
          type: "select",
          full: true,
          required: true,
          options: [
            ["", "Select a patient"],
            ...patients.map((p) => [p.id, `${p.fullName} (@${p.username})`]),
          ],
        },
        {
          name: "service",
          label: "Service",
          type: "select",
          required: true,
          options: [["", "Select a service"], ...SERVICES.map((s) => [s, s])],
        },
        {
          name: "dentist",
          label: "Dentist",
          type: "select",
          options: dentists.map((d) => [d, d]),
        },
        {
          name: "date",
          label: "Date",
          type: "date",
          required: true,
          min: App.todayIso(),
        },
        {
          name: "time",
          label: "Time",
          type: "select",
          required: true,
          options: [["", "Pick a date first"]],
          hint: "Taken times are disabled.",
        },
        {
          name: "notes",
          label: "Notes (optional)",
          type: "textarea",
          rows: 2,
          maxlength: 1000,
        },
      ],
      submit: "Book appointment",
      onOpen: () =>
        $("#f_date").addEventListener("change", () =>
          App.loadSlots(
            $("#f_date").value,
            $("#f_time"),
            $("#f_time").parentElement.querySelector(".slot-hint"),
          ),
        ),
      async onSubmit(v) {
        await api("admin_appointments.php", {
          method: "POST",
          body: {
            action: "create",
            patientId: +v.patientId,
            service: v.service,
            dentist: v.dentist,
            date: v.date,
            time: v.time,
            notes: v.notes,
          },
        });
        App.toast("Appointment booked.");
        App.refresh();
      },
    });
  };
})();
