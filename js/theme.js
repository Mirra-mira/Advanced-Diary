const THEME_KEY = 'adv_theme_v1';

function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

function currentThemeLabel() {
  const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';
  return isDark ? 'Chuyển sang sáng' : 'Chuyển sang tối';
}
