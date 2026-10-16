/* Records: medical history, prescriptions, x-rays & images, lab results, documents. */
(() => {
  const CATS = [
    ["all", "All Records"],
    ["medical_history", "Medical History"],
    ["prescription", "Prescriptions"],
    ["xray", "X-Ray & Images"],
    ["lab_result", "Lab Results"],
    ["document", "Documents"],
  ];
  const ONE = {
    medical_history: "Medical History",
    prescription: "Prescription",
    xray: "X-Ray / Image",
    lab_result: "Lab Result",
    document: "Document",
  };
  const PER = 10;
  const st = { type: "all", q: "", page: 1 };
  let list = [];
  App.recLabel = (t) => ONE[t] || t;

  function drawTable() {
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / PER));
    if (st.page > pages) st.page = pages;
    const slice = list.slice((st.page - 1) * PER, st.page * PER);
    const rows = slice.map(
      (
        r,
      ) => `<tr><td>${App.code("RC", r.id)}</td><td><strong>${esc(r.patientName)}</strong></td>
        <td>${esc(ONE[r.type])}<small>${esc(r.title)}${r.hasFile ? " · 📎" : ""}</small></td><td>${esc(fmtDate(r.date))}</td><td>${esc(r.addedBy || "—")}</td>
        <td><div class="tbl-actions">${App.iconBtn("eye", "ib-view", `data-view="${r.id}"`, "View record")}${App.iconBtn("edit", "ib-edit", `data-edit="${r.id}"`, "Edit record")}${App.isAdmin() ? App.iconBtn("trash", "ib-del", `data-del="${r.id}"`, "Delete record") : ""}</div></td></tr>`,
    );
    $("#rcTable").innerHTML =
      App.table(
        ["Record ID", "Patient", "Record Type", "Date", "Added By", "Action"],
        rows,
        "No records found.",
      ) + (total ? App.pagerHtml(total, st.page, PER) : "");
  }

  async function load() {
    const r = await api(
      `admin_records.php?type=${st.type}&q=${encodeURIComponent(st.q)}`,
    );
    list = r.records;
    $("#rcCats").innerHTML = CATS.map(
      ([k, l]) =>
        `<button class="cat ${st.type === k ? "active" : ""}" data-cat="${k}"><span>${l}</span><span>${App.num(r.counts[k])}</span></button>`,
    ).join("");
    drawTable();
  }

  App.views.records = {
    async show(el) {
      el.innerHTML = `<div class="rec-layout"><div class="cat-list" id="rcCats"></div>
        <div class="panel"><div class="toolbar">${App.searchBox("rcQ", "Search title or patient", st.q)}
          <button class="btn btn-primary" id="rcNew" type="button">${icon("plus", 16)} Add Record</button></div><div id="rcTable"></div></div></div>`;
      $("#rcCats").addEventListener("click", (e) => {
        const c = e.target.closest("[data-cat]");
        if (c) {
          st.type = c.dataset.cat;
          st.page = 1;
          load().catch(App.fail);
        }
      });
      $("#rcQ").addEventListener(
        "input",
        App.debounce(
          (e) => (
            (st.q = e.target.value.trim()),
            (st.page = 1),
            load().catch(App.fail)
          ),
        ),
      );
      $("#rcNew").addEventListener("click", () => App.newRecord());
      App.bindPager($("#rcTable"), (p) => ((st.page = p), drawTable()));
      $("#rcTable").addEventListener("click", async (e) => {
        const v = e.target.closest("[data-view]"),
          ed = e.target.closest("[data-edit]"),
          d = e.target.closest("[data-del]");
        if (v) return view(list.find((r) => r.id === +v.dataset.view));
        if (ed) return edit(list.find((r) => r.id === +ed.dataset.edit));
        if (
          d &&
          (await App.confirm({
            title: "Delete this record?",
            text: "The attached file is deleted too. This can't be undone.",
            confirmText: "Delete",
          }))
        ) {
          try {
            await api("admin_records.php", {
              method: "POST",
              body: { action: "delete", id: +d.dataset.del },
            });
            App.toast("Record deleted.");
            load();
          } catch (err) {
            App.fail(err);
          }
        }
      });
      await load();
    },
  };

  const typeOptions = Object.entries(ONE).map(([k, l]) => [k, l]);

  App.newRecord = async function () {
    let patients;
    try {
      patients = await App.patients(true);
    } catch (e) {
      return App.fail(e);
    }
    if (!patients.length)
      return App.toast("There are no patients yet. Add a patient first.", true);
    App.form({
      title: "Add patient record",
      sub: "Files can be JPG, PNG, WebP or PDF, up to 5 MB.",
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
          name: "type",
          label: "Record type",
          type: "select",
          required: true,
          options: typeOptions,
        },
        {
          name: "date",
          label: "Record date",
          type: "date",
          required: true,
          value: App.todayIso(),
        },
        {
          name: "title",
          label: "Title",
          required: true,
          full: true,
          placeholder: "e.g. Panoramic X-ray, Amoxicillin 500 mg",
        },
        {
          name: "details",
          label: "Details / notes",
          type: "textarea",
          rows: 4,
        },
        {
          name: "file",
          label: "Attach a file (optional)",
          type: "file",
          full: true,
          accept: ".jpg,.jpeg,.png,.webp,.pdf",
        },
      ],
      submit: "Save record",
      async onSubmit(v) {
        await api("admin_records.php", {
          method: "POST",
          body: {
            action: "create",
            patientId: +v.patientId,
            type: v.type,
            date: v.date,
            title: v.title,
            details: v.details,
            file: v.file,
          },
        });
        App.toast("Record saved.");
        App.refresh();
      },
    });
  };

  function edit(r) {
    if (!r) return;
    App.form({
      title: "Edit record",
      sub: `${App.code("RC", r.id)} · ${r.patientName}`,
      fields: [
        {
          name: "type",
          label: "Record type",
          type: "select",
          required: true,
          options: typeOptions,
        },
        { name: "date", label: "Record date", type: "date", required: true },
        { name: "title", label: "Title", required: true, full: true },
        {
          name: "details",
          label: "Details / notes",
          type: "textarea",
          rows: 4,
        },
      ],
      values: r,
      async onSubmit(v) {
        await api("admin_records.php", {
          method: "POST",
          body: { action: "update", id: r.id, ...v },
        });
        App.toast("Record updated.");
        App.refresh();
      },
    });
  }

  function view(r) {
    if (!r) return;
    const url = `api/record_file.php?id=${r.id}`;
    let file = "";
    if (r.hasFile) {
      file =
        r.fileMime && r.fileMime.startsWith("image/")
          ? `<img class="preview" src="${url}" alt="${esc(r.title)}" />`
          : "";
      file += `<p><a href="${url}" target="_blank" rel="noopener">Open ${esc(r.fileName || "file")} in a new tab</a></p>`;
    }
    App.dialog({
      title: r.title,
      sub: `${App.code("RC", r.id)} · ${ONE[r.type]} · ${r.patientName}`,
      wide: true,
      html: `<dl class="kv"><dt>Record date</dt><dd>${esc(fmtDate(r.date, true))}</dd><dt>Added by</dt><dd>${esc(r.addedBy || "—")}</dd></dl>
        ${r.details ? `<div class="note-box">${esc(r.details)}</div>` : '<p class="muted">No notes.</p>'}${file}`,
      buttons: [
        { label: "Edit", onClick: () => edit(r) },
        { label: "Close", cls: "btn-primary", onClick: App.close },
      ],
    });
  }
})();
