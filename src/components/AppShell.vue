<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  LayoutDashboard, Store, ArrowRightLeft, PawPrint, Tags, Settings, Menu, X, Database, Sun, Moon,
} from '@lucide/vue'
import { useDataStore } from '@/stores/data'
import { useThemeStore } from '@/stores/theme'
import { formatDate } from '@/utils/format'

const route = useRoute()
const dataStore = useDataStore()
const themeStore = useThemeStore()
const mobileOpen = ref(false)

const nav = [
  { to: '/', label: 'Áttekintés', icon: LayoutDashboard },
  { to: '/boltok', label: 'NPC-boltok', icon: Store },
  { to: '/osszehasonlitas', label: 'Cserekereső', icon: ArrowRightLeft },
  { to: '/kisallatok', label: 'Kisállatok', icon: PawPrint },
  { to: '/arlista', label: 'Árlista', icon: Tags },
  { to: '/beallitasok', label: 'Beállítások', icon: Settings },
]
</script>

<template>
  <div class="app-shell">
    <header class="mobile-header">
      <button class="icon-button" aria-label="Menü megnyitása" @click="mobileOpen = true"><Menu :size="22" /></button>
      <RouterLink class="mobile-brand" to="/">VENOR<span>HELPER</span></RouterLink>
      <button class="icon-button" :aria-label="themeStore.isDark ? 'Világos téma' : 'Sötét téma'" @click="themeStore.toggleTheme">
        <Sun v-if="themeStore.isDark" :size="19" />
        <Moon v-else :size="19" />
      </button>
    </header>

    <div v-if="mobileOpen" class="sidebar-backdrop" @click="mobileOpen = false" />
    <aside class="sidebar" :class="{ 'is-open': mobileOpen }">
      <div class="brand-row">
        <RouterLink class="brand" to="/" @click="mobileOpen = false">
          <span class="brand__mark">V</span>
          <span>VENOR<em>HELPER</em></span>
        </RouterLink>
        <button class="icon-button sidebar__close" aria-label="Menü bezárása" @click="mobileOpen = false"><X :size="20" /></button>
      </div>
      <p class="sidebar__eyebrow">JÁTÉKSEGÉDLET</p>
      <nav class="sidebar__nav" aria-label="Fő navigáció">
        <RouterLink
          v-for="entry in nav"
          :key="entry.to"
          :to="entry.to"
          :class="{ active: entry.to === '/' ? route.path === '/' : route.path.startsWith(entry.to) }"
          @click="mobileOpen = false"
        >
          <component :is="entry.icon" :size="19" :stroke-width="1.8" />
          <span>{{ entry.label }}</span>
        </RouterLink>
      </nav>
      <div class="sidebar__bottom">
        <button class="theme-toggle" @click="themeStore.toggleTheme">
          <span><Sun v-if="themeStore.isDark" :size="17" /><Moon v-else :size="17" /></span>
          <span><strong>{{ themeStore.isDark ? 'Világos téma' : 'Sötét téma' }}</strong><small>Megjelenés váltása</small></span>
        </button>
        <div class="sidebar__source">
          <Database :size="17" />
          <div>
            <span>Adatcsomag</span>
            <strong>{{ dataStore.meta.generatedAt ? formatDate(dataStore.meta.generatedAt) : 'betöltés…' }}</strong>
          </div>
          <i :class="{ warning: !dataStore.meta.completeItems }" />
        </div>
      </div>
    </aside>

    <main class="main-content">
      <div class="content-wrap"><slot /></div>
    </main>
  </div>
</template>

<style scoped src="./AppShell.css"></style>
