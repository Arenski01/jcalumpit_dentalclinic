/* Landing page: swap "Sign In" for "Log Out" when a session exists,
   and send signed-out visitors to the login page when they try to book. */
(async function () {
  const authLink = document.getElementById("authLink");
  const authLabel = document.getElementById("authLabel");
  const bookLinks = document.querySelectorAll('a[href="appointment.html"]');
  if (!authLink) return;

  authLink.style.visibility = "hidden"; // avoid a "Sign In" flash for signed-in users
  let user = null;
  try {
    user = (await api("session.php")).user;
  } catch (_) {
    /* server unreachable: behave as signed out */
  }
  authLink.style.visibility = "";

  if (!user) {
    bookLinks.forEach((a) => {
      a.href = "login.html?next=appointment.html&notice=book";
    });
    return;
  }

  const staff = isStaffRole(user.role);

  authLabel.textContent = "Log Out";
  authLink.href = "#";
  authLink.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await api("logout.php", { method: "POST" });
    } catch (_) {}
    location.reload();
  });

  const portal = document.createElement("a");
  portal.href = staff ? "admin.html" : "dashboard.html";
  portal.textContent = staff ? "Admin Panel" : "My Appointments";
  authLink.parentNode.insertBefore(portal, authLink);

  if (staff) bookLinks.forEach((a) => (a.href = "admin.html"));
})();
