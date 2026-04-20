const navLinks = Array.from(document.querySelectorAll(".nav-link"));
const pages = Array.from(document.querySelectorAll(".page"));
const themeToggle = document.querySelector(".theme-toggle");
const themeLabel = document.querySelector(".theme-toggle-label");

function showPage(pageId) {
  navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.page === pageId);
  });

  pages.forEach((page) => {
    page.classList.toggle("active", page.dataset.page === pageId);
  });
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => showPage(link.dataset.page));
});

themeToggle?.addEventListener("click", () => {
  const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  document.body.dataset.theme = nextTheme;
  themeToggle.setAttribute("aria-pressed", String(nextTheme === "dark"));

  if (themeLabel) {
    themeLabel.textContent = nextTheme === "dark" ? "Evening Desk" : "Light Desk";
  }
});