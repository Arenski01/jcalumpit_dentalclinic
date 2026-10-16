/* Boot: check the session, build the sidebar/top bar, open the first page. */
(async function boot() {
  try {
    App.me = (await api("session.php")).user;
  } catch (_) {}
  if (!App.me) return location.replace("login.html?next=admin.html");
  if (!isStaffRole(App.me.role)) return location.replace("dashboard.html");

  $("#menuBtn").innerHTML = icon("menu", 22);
  $("#bellBtn").innerHTML = icon("bell", 20);
  $("#logoutBtn").innerHTML = icon("logout", 20) + "<span>Logout</span>";
  $("#avatar").textContent = App.initials(App.me.fullName);
  $("#whoName").textContent = App.me.fullName;
  $("#whoRole").textContent = ROLE_LABEL[App.me.role] || App.me.role;

  $("#sbNav").innerHTML = App.NAV.filter((n) => !n.admin || App.isAdmin())
    .map(
      (n) =>
        `<button class="sb-item" type="button" data-view="${n.id}">${icon(n.icon, 20)}<span>${n.label}</span>${n.id === "appointments" ? '<span class="pill hidden" id="pendingPill">0</span>' : ""}</button>`,
    )
    .join("");
  $("#sbNav").addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (b) App.go(b.dataset.view);
  });

  const logout = async () => {
    try {
      await api("logout.php", { method: "POST" });
    } catch (_) {}
    location.href = "login.html";
  };
  $("#logoutBtn").addEventListener("click", logout);
  $("#logout2").addEventListener("click", logout);

  $("#menuBtn").addEventListener("click", () => {
    const app = $("#app");
    if (window.matchMedia("(max-width: 900px)").matches)
      app.classList.toggle("sb-open");
    else app.classList.toggle("collapsed");
  });
  $("#sbBackdrop").addEventListener("click", () =>
    $("#app").classList.remove("sb-open"),
  );
  $("#userBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    $("#userMenu").classList.toggle("hidden");
  });
  $("#bellBtn").addEventListener("click", () =>
    App.go("appointments", { tab: "pending" }),
  );

  App.refreshBell();
  App.go((location.hash || "#dashboard").slice(1));
})();
