export type Theme = 'light' | 'dark'

const THEME_KEY = 'nofi:theme'

export function getTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY)
  return saved === 'light' || saved === 'dark' ? saved : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

export function setTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme)
  applyTheme(theme)
}
