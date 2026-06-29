const themeStorageKey = 'focus-tracker-theme';

type Theme = 'dark' | 'light';

function getTheme(): Theme {
  const storedTheme = localStorage.getItem(themeStorageKey);

  if (storedTheme === 'dark' || storedTheme === 'light') {
    return storedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  const toggle = document.getElementById('theme-toggle');

  if (toggle) {
    toggle.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'
    );
  }
}

export function initializeTheme(): void {
  applyTheme(getTheme());

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const nextTheme: Theme =
      document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';

    localStorage.setItem(themeStorageKey, nextTheme);
    applyTheme(nextTheme);
  });
}
