/* Treatment: ongoing treatments, completed ones and treatment plans. */
(() => {
  const LABEL = {
    plan: "Treatment Plan",
    ongoing: "Ongoing",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  const st = { status: "all", q: "" };
  const byId = new Map();
  App.trBadge = (s) =>
    `<span class="badge badge-${s === "completed" ? "completed" : s === "cancelled" ? "cancelled" : s}">${esc(LABEL[s] || s)}</span>`;

  function row(t) {
    byId.set(t.id, t);
    const done = t.status === "plan" || t.status === "ongoing";
    return `<tr><td>${App.code("TR", t.id)}</td><td><strong>${esc(t.patientName)}</strong></td><td>${esc(t.name)}${t.notes ? `<small>${esc(t.notes.slice(0, 80))}${t.notes.length > 80 ? "…" : ""}</small>` : ""}</td>
      <td>${esc(t.dentist)}</td><td>${esc(fmtDate(t.startDate))}</td><td>${App.trBadge(t.status)}</td>
      <td><div class="tbl-actions">${done ? App.iconBtn("check", "ib-ok", `data-done="${t.id}"`, "Mark completed") : ""}${App.iconBtn("edit", "ib-edit", `data-edit="${t.id}"`, "Edit treatment")}${App.isAdmin() ? App.iconBtn("trash", "ib-del", `data-del="${t.id}"`, "Delete treatment") : ""}</div></td></tr>`;
  }

  async function load() {
    const r = await api(
      `admin_treatments.php?status=${st.status}&q=${encodeURIComponent(st.q)}`,
    );
    const c = r.counts;
    $("#trCards").innerHTML = App.statCards([
      {
        icon: "tooth",
        tone: "green",
        label: "Ongoing Treatments",
        value: App.num(c.ongoing),
      },
      {
        icon: "check",
        tone: "blue",
        label: "Completed",
        value: App.num(c.completed),
      },
      {
        icon: "file",
        tone: "violet",
        label: "Treatment Plans",
        value: App.num(c.plan),
      },
      {
        icon: "x",
        tone: "red",
        label: "Cancelled",
        value: App.num(c.cancelled),
      },
    ]);
    byId.clear();
    $("#trTable").innerHTML = App.table(
      [
        "Treatment ID",
        "Patient",
        "Treatment",
        "Dentist",
        "Start Date",
        "Status",
        "Action",
      ],
      r.treatments.map(row),
      "No treatments found.",
    );
  }

  const fields = (creating, patients, dentists) => [
    ...(creating
      ? [
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
        ]
      : []),
    {
      name: "name",
      label: "Treatment",
      required: true,
      full: true,
      placeholder: "e.g. Root canal therapy, Braces (orthodontics)",
    },
    {
      name: "dentist",
      label: "Dentist",
      type: "select",
      options: dentists.map((d) => [d, d]),
    },
    {
      name: "startDate",
      label: "Start date",
      type: "date",
      required: true,
      value: App.todayIso(),
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      options: Object.entries(LABEL),
    },
    { name: "notes", label: "Notes", type: "textarea", rows: 3 },
  ];

  async function open(t) {
    let patients = [],
      dentists;
    try {
      [dentists, patients] = await Promise.all([
        App.dentists(),
        t ? [] : App.patients(true),
      ]);
    } catch (e) {
      return App.fail(e);
    }
    if (!t && !patients.length)
      return App.toast("There are no patients yet. Add a patient first.", true);
    const dOpts =
      t && !dentists.includes(t.dentist) ? [...dentists, t.dentist] : dentists;
    App.form({
      title: t ? "Edit treatment" : "New treatment",
      sub: t ? `${App.code("TR", t.id)} · ${t.patientName}` : "",
      fields: fields(!t, patients, dOpts),
      values: t || { status: "ongoing" },
      async onSubmit(v) {
        const body = t
          ? { action: "update", id: t.id, ...v }
          : { action: "create", ...v, patientId: +v.patientId };
        await api("admin_treatments.php", { method: "POST", body });
        App.toast(t ? "Treatment updated." : "Treatment added.");
        App.refresh();
      },
    });
  }

  App.views.treatment = {
    async show(el) {
      el.innerHTML = `<div class="toolbar">${App.searchBox("trQ", "Search treatment, patient or dentist", st.q)}
        <select id="trStatus"><option value="all">All statuses</option>${Object.entries(
          LABEL,
        )
          .map(
            ([k, l]) =>
              `<option value="${k}" ${st.status === k ? "selected" : ""}>${l}</option>`,
          )
          .join("")}</select>
        <button class="btn btn-primary" id="trNew" type="button">${icon("plus", 16)} New Treatment</button></div>
        <div class="cards" id="trCards"></div><div class="panel" id="trTable"></div>`;
      $("#trQ").addEventListener(
        "input",
        App.debounce(
          (e) => ((st.q = e.target.value.trim()), load().catch(App.fail)),
        ),
      );
      $("#trStatus").addEventListener(
        "change",
        (e) => ((st.status = e.target.value), load().catch(App.fail)),
      );
      $("#trNew").addEventListener("click", () => open(null));
      $("#trTable").addEventListener("click", async (e) => {
        const ed = e.target.closest("[data-edit]"),
          dn = e.target.closest("[data-done]"),
          d = e.target.closest("[data-del]");
        if (ed) return open(byId.get(+ed.dataset.edit));
        try {
          if (dn) {
            const t = byId.get(+dn.dataset.done);
            await api("admin_treatments.php", {
              method: "POST",
              body: {
                action: "update",
                id: t.id,
                name: t.name,
                dentist: t.dentist,
                startDate: t.startDate,
                status: "completed",
                notes: t.notes || "",
              },
            });
            App.toast("Treatment marked completed.");
            load();
          }
          if (
            d &&
            (await App.confirm({
              title: "Delete this treatment?",
              text: "This can't be undone.",
              confirmText: "Delete",
            }))
          ) {
            await api("admin_treatments.php", {
              method: "POST",
              body: { action: "delete", id: +d.dataset.del },
            });
            App.toast("Treatment deleted.");
            load();
          }
        } catch (err) {
          App.fail(err);
        }
      });
      await load();
    },
  };
})();
