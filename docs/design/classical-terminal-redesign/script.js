const navItems = Array.from(document.querySelectorAll('.rail-nav-item'));
const pages = Array.from(document.querySelectorAll('.page'));

function activatePage(name) {
  navItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.page === name);
  });

  pages.forEach((page) => {
    page.classList.toggle('active', page.dataset.page === name);
  });
}

navItems.forEach((item) => {
  item.addEventListener('click', () => activatePage(item.dataset.page));
});