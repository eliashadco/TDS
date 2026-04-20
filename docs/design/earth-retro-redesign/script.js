const buttons = Array.from(document.querySelectorAll('.nav-item'));
const pages = Array.from(document.querySelectorAll('.page'));

function setPage(pageName) {
  buttons.forEach((button) => {
    button.classList.toggle('active', button.dataset.page === pageName);
  });

  pages.forEach((page) => {
    page.classList.toggle('active', page.dataset.page === pageName);
  });
}

buttons.forEach((button) => {
  button.addEventListener('click', () => setPage(button.dataset.page));
});