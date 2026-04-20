const links = Array.from(document.querySelectorAll('.nav-link'));
const pages = Array.from(document.querySelectorAll('.page'));
const tradePage = document.querySelector('[data-page="trade-studio"]');
const tradePanels = Array.from(document.querySelectorAll('.trade-step-panel'));
const tradeSegments = Array.from(document.querySelectorAll('.trade-progress-segment'));
const tradeStepNumber = document.querySelector('.trade-step-number');
const tradeStepHeading = document.querySelector('.trade-step-heading');
const tradePrevButton = document.querySelector('.trade-prev-button');
const tradeNextButton = document.querySelector('.trade-next-button');
const themeToggleButton = document.querySelector('.theme-toggle-card');
const themeToggleLabel = document.querySelector('.theme-toggle-label');
const themeToggleSwitch = document.querySelector('.theme-toggle-switch');
const tradeStepLabels = ['Thesis', 'Assessment', 'Sizing', 'Confirm'];
const themeStorageKey = 'balanced-guided-theme';

let activeTradeStep = 1;

function applyTheme(theme) {
  document.body.dataset.theme = theme;

  if (themeToggleButton) {
    themeToggleButton.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  if (themeToggleLabel) {
    themeToggleLabel.textContent = theme === 'dark' ? 'Dark' : 'Light';
  }

  if (themeToggleSwitch) {
    themeToggleSwitch.classList.toggle('active', theme === 'dark');
  }

  localStorage.setItem(themeStorageKey, theme);
}

function syncTradeStep() {
  if (!tradePage) {
    return;
  }

  tradePanels.forEach((panel) => {
    panel.classList.toggle('active', Number(panel.dataset.tradeStep) === activeTradeStep);
  });

  tradeSegments.forEach((segment) => {
    segment.classList.toggle('active', Number(segment.dataset.segment) <= activeTradeStep);
  });

  if (tradeStepNumber) {
    tradeStepNumber.textContent = String(activeTradeStep);
  }

  if (tradeStepHeading) {
    tradeStepHeading.textContent = tradeStepLabels[activeTradeStep - 1];
  }

  if (tradePrevButton) {
    tradePrevButton.disabled = activeTradeStep === 1;
  }

  if (tradeNextButton) {
    tradeNextButton.textContent = activeTradeStep === tradeStepLabels.length ? 'Finish' : 'Next';
  }
}

function showPage(name) {
  links.forEach((link) => {
    link.classList.toggle('active', link.dataset.page === name);
  });

  pages.forEach((page) => {
    page.classList.toggle('active', page.dataset.page === name);
  });

  if (name === 'trade-studio') {
    syncTradeStep();
  }

  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

links.forEach((link) => {
  link.addEventListener('click', () => showPage(link.dataset.page));
});

if (themeToggleButton) {
  themeToggleButton.addEventListener('click', () => {
    const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  });
}

if (tradePrevButton) {
  tradePrevButton.addEventListener('click', () => {
    activeTradeStep = Math.max(1, activeTradeStep - 1);
    syncTradeStep();
  });
}

if (tradeNextButton) {
  tradeNextButton.addEventListener('click', () => {
    activeTradeStep = activeTradeStep === tradeStepLabels.length ? 1 : activeTradeStep + 1;
    syncTradeStep();
  });
}

const storedTheme = localStorage.getItem(themeStorageKey);
applyTheme(storedTheme === 'dark' ? 'dark' : 'light');
syncTradeStep();