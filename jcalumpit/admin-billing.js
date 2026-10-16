/* Billing: invoices per visit (fee set by staff), payments recorded by staff, balances patients see. */
(() => {
  const STATUS = {
    notbilled: "Not billed",
    unpaid: "Unpaid",
    partial: "Partial",
    paid: "Paid",
  };
  const st = { status: "all", q: "" };
  let all = [];
  let changed = false;

  function drawTable() {
    const q = st.q.toLowerCase();
    const rows = all
      .filter(
        (i) =>
          (st.status === "all" || i.status === st.status) &&
          (!q ||
            `${App.code("INV", i.id)} ${i.patientName} ${i.service}`
              .toLowerCase()
              .includes(q)),
      )
      .map(
        (
          i,
        ) => `<tr><td>${App.code("INV", i.id)}</td><td><strong>${esc(i.patientName)}</strong><small>${esc(i.service)}</small></td>
          <td>${i.invoiceDate ? esc(fmtDate(i.invoiceDate)) : "—"}</td><td>${i.dueDate ? esc(fmtDate(i.dueDate)) : "—"}</td>
          <td>${i.fee > 0 ? esc(peso(i.fee)) : "—"}</td><td>${i.fee > 0 ? esc(peso(i.balance)) : "—"}</td>
          <td><span class="badge badge-${i.status}">${STATUS[i.status]}</span>${i.overdue ? '<span class="badge badge-overdue">Overdue</span>' : ""}</td>
          <td><div class="tbl-actions">${App.iconBtn("edit", "ib-edit", `data-bill="${i.id}"`, i.fee > 0 ? "Manage invoice" : "Set fee")}</div></td></tr>`,
      );
    $("#blTable").innerHTML = App.table(
      [
        "Invoice ID",
        "Patient",
        "Date",
        "Due Date",
        "Amount",
        "Balance",
        "Status",
        "Action",
      ],
      rows,
      "No invoices match these filters.",
    );
  }

  App.views.billing = {
    async show(el) {
      const r = await api("admin_billing.php?list=1");
      all = r.invoices;
      const s = r.stats;
      el.innerHTML = `<div class="toolbar">${App.searchBox("blQ", "Search invoice, patient or service", st.q)}
        <select id="blStatus"><option value="all">All statuses</option>${Object.entries(
          STATUS,
        )
          .map(
            ([k, l]) =>
              `<option value="${k}" ${st.status === k ? "selected" : ""}>${l}</option>`,
          )
          .join("")}</select></div>
        <div class="cards">${App.statCards([
          {
            icon: "wallet",
            tone: "blue",
            label: "Total Billed",
            value: peso(s.billed),
          },
          {
            icon: "alert",
            tone: "orange",
            label: "Outstanding Balance",
            value: peso(s.outstanding),
          },
          {
            icon: "check",
            tone: "green",
            label: "Paid Amount",
            value: peso(s.paid),
          },
          {
            icon: "file",
            tone: "violet",
            label: "Total Invoices",
            value: App.num(s.invoices),
          },
        ])}</div>
        <div class="panel"><div id="blTable"></div>
          <p class="slot-hint" style="margin-top:12px">An invoice appears once a visit is approved. Open it to set the fee and record payments. Patients see their remaining balance on their dashboard. Due date = invoice date + 7 days.</p></div>`;
      $("#blQ").addEventListener(
        "input",
        App.debounce((e) => ((st.q = e.target.value.trim()), drawTable()), 150),
      );
      $("#blStatus").addEventListener(
        "change",
        (e) => ((st.status = e.target.value), drawTable()),
      );
      $("#blTable").addEventListener("click", (e) => {
        const b = e.target.closest("[data-bill]");
        if (b) App.billing(+b.dataset.bill);
      });
      drawTable();
    },
  };

  const methodOpts = Object.entries(METHOD_LABEL)
    .map(([k, l]) => `<option value="${k}">${l}</option>`)
    .join("");

  function render(state) {
    const a = state.appointment;
    const pays = state.payments.map(
      (
        p,
      ) => `<tr><td>${esc(fmtDateTime(p.paidAt))}</td><td>${esc(METHOD_LABEL[p.method] || p.method)}${p.reference ? `<small>Ref: ${esc(p.reference)}</small>` : ""}${p.note ? `<small>${esc(p.note)}</small>` : ""}</td>
        <td><strong>${esc(peso(p.amount))}</strong></td><td>${esc(p.recordedBy || "—")}</td>${App.isAdmin() ? `<td>${App.iconBtn("trash", "ib-del", `data-delpay="${p.id}"`, "Remove payment")}</td>` : ""}</tr>`,
    );
    App.dialog({
      title: `Invoice ${App.code("INV", a.id)}`,
      sub: `${a.patientName} · ${a.service} · ${fmtDate(a.date)}`,
      wide: true,
      html: `<div class="chips"><div class="chip"><span>Fee</span><strong>${esc(peso(a.fee))}</strong></div><div class="chip"><span>Paid</span><strong>${esc(peso(a.paid))}</strong></div>
          <div class="chip"><span>Balance</span><strong class="${a.balance > 0 ? "down" : "up"}">${esc(peso(a.balance))}</strong></div></div>
        <div class="f-row"><label for="bFee">Fee for this visit (₱)</label>
          <div style="display:flex;gap:8px"><input type="number" id="bFee" min="0" step="0.01" value="${a.fee > 0 ? a.fee : ""}" placeholder="0.00" /><button type="button" class="btn btn-ghost" id="bSaveFee">Save fee</button></div></div>
        <h4 class="dlg-h4">Payments</h4>${App.table(["Date", "Method", "Amount", "Recorded by", ...(App.isAdmin() ? [""] : [])], pays, "No payments recorded yet.")}
        <h4 class="dlg-h4">Record a payment</h4>
        <div class="fgrid">
          <div class="f-row"><label for="bAmt">Amount (₱)</label><input type="number" id="bAmt" min="0" step="0.01" value="${a.balance > 0 ? a.balance : ""}" ${a.fee > 0 ? "" : "disabled"} /></div>
          <div class="f-row"><label for="bMethod">Method</label><select id="bMethod" ${a.fee > 0 ? "" : "disabled"}>${methodOpts}</select></div>
          <div class="f-row"><label for="bRef">Reference no. (optional)</label><input type="text" id="bRef" maxlength="100" ${a.fee > 0 ? "" : "disabled"} /></div>
          <div class="f-row"><label for="bNote">Note (optional)</label><input type="text" id="bNote" maxlength="255" ${a.fee > 0 ? "" : "disabled"} /></div>
        </div>
        <button type="button" class="btn btn-ok" id="bAddPay" ${a.fee > 0 && a.balance > 0 ? "" : "disabled"}>Add payment</button>
        ${a.fee > 0 ? "" : '<p class="slot-hint" style="margin-top:8px">Set the fee first, then record payments.</p>'}`,
      buttons: [{ label: "Close", cls: "btn-primary", onClick: App.close }],
      onOpen: () => bind(a),
    });
    App._afterClose = () => changed && App.refresh();
  }

  async function post(body) {
    try {
      const state = await api("admin_billing.php", { method: "POST", body });
      changed = true;
      App.toast("Saved.");
      render(state);
    } catch (e) {
      if (e.status === 401) return App.fail(e);
      $("#dlgErr").textContent = e.message;
    }
  }

  function bind(a) {
    $("#dlgErr").textContent = "";
    $("#bSaveFee").addEventListener("click", () =>
      post({ action: "set_fee", appointmentId: a.id, fee: $("#bFee").value }),
    );
    $("#bFee").addEventListener(
      "keydown",
      (e) => e.key === "Enter" && (e.preventDefault(), $("#bSaveFee").click()),
    );
    $("#bAddPay").addEventListener("click", () =>
      post({
        action: "add_payment",
        appointmentId: a.id,
        amount: $("#bAmt").value,
        method: $("#bMethod").value,
        reference: $("#bRef").value,
        note: $("#bNote").value,
      }),
    );
    $$("[data-delpay]").forEach((b) =>
      b.addEventListener("click", async () => {
        const yes = await App.confirm({
          title: "Remove this payment?",
          text: "Use this only to correct a mistake. The patient's balance goes back up.",
          confirmText: "Remove",
        });
        if (yes)
          post({ action: "delete_payment", paymentId: +b.dataset.delpay });
        else open(a.id);
      }),
    );
  }

  async function open(id) {
    try {
      render(await api("admin_billing.php?appointment_id=" + id));
    } catch (e) {
      App.fail(e);
    }
  }
  App.billing = (id) => {
    changed = false;
    return open(id);
  };
})();
