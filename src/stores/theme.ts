import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'venor-helper:theme'

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function savedTheme(): Theme | null {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'light' || saved === 'dark' ? saved : null
}

export const useThemeStore = defineStore('theme', () => {
  const saved = savedTheme()
  const theme = ref<Theme>(saved ?? systemTheme())
  const followsSystem = ref(saved === null)
  const isDark = computed(() => theme.value === 'dark')

  function setTheme(value: Theme) {
    followsSystem.value = false
    theme.value = value
    localStorage.setItem(STORAGE_KEY, value)
  }

  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  watch(theme, (value) => {
    document.documentElement.dataset.theme = value
    document.documentElement.style.colorScheme = value
  }, { immediate: true })

  window.matchMedia?.('(prefers-color-scheme: light)').addEventListener('change', (event) => {
    if (followsSystem.value) theme.value = event.matches ? 'light' : 'dark'
  })

  return { theme, isDark, followsSystem, setTheme, toggleTheme }
})
