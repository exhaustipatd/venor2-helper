<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Menu, Sun, Moon, ShieldCheck, Database, ArrowUpRight, Leaf } from '@lucide/vue'
import { useDataStore } from '@/stores/data'
import { useThemeStore } from '@/stores/theme'
import { useUserStore } from '@/stores/user'
import { formatDate } from '@/utils/format'
import NavLinks from './NavLinks.vue'
import DetailPanel from './DetailPanel.vue'
const data = useDataStore(),
  theme = useThemeStore(),
  user = useUserStore(),
  route = useRoute()
const mobileOpen = ref(false)
watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false
  },
)
const collection = computed(() => data.pets.filter((p) => user.isOwned(p.vnum)).length)
const progress = computed(() =>
  data.pets.length ? Math.round((collection.value / data.pets.length) * 100) : 0,
)
</script>
<template>
  <div class="app-shell">
    <a href="#main-content" class="skip-link">Ugrás a tartalomra</a>
    <header class="mobile-header">
      <button
        class="icon-button"
        aria-label="Menü megnyitása"
        :aria-expanded="mobileOpen"
        @click="mobileOpen = true"
      >
        <Menu :size="20" /></button
      ><RouterLink to="/" class="mobile-brand">VENOR2<span> / SEGÉDLET</span></RouterLink
      ><button
        class="icon-button"
        :aria-label="theme.isDark ? 'Világos téma' : 'Sötét téma'"
        @click="theme.toggleTheme"
      >
        <Sun v-if="theme.isDark" :size="18" /><Moon v-else :size="18" />
      </button>
    </header>
    <aside class="sidebar">
      <RouterLink class="brand" to="/" aria-label="Venor2 segédlet kezdőlap"
        ><span class="brand__mark">V</span><span>VENOR2<small>SEGÉDLET</small></span></RouterLink
      >
      <NavLinks />
      <div class="sidebar-collection">
        <div>
          <Leaf :size="16" /><span>A gyűjteményed</span><strong>{{ progress }}%</strong>
        </div>
        <div class="progress-track"><span :style="{ width: `${progress}%` }" /></div>
        <RouterLink to="/kisallatok"
          >{{ collection }} / {{ data.pets.length }} kisállat <ArrowUpRight :size="13"
        /></RouterLink>
      </div>
      <div class="sidebar-bottom">
        <button class="theme-toggle" @click="theme.toggleTheme">
          <Sun v-if="theme.isDark" :size="17" /><Moon v-else :size="17" /><span>{{
            theme.isDark ? 'Világos téma' : 'Sötét téma'
          }}</span
          ><span class="theme-switch" :class="{ dark: theme.isDark }" />
        </button>
        <div class="sidebar-source">
          <Database :size="15" /><span
            >Wiki-adatcsomag<strong>{{
              data.meta.generatedAt ? formatDate(data.meta.generatedAt) : 'Betöltés…'
            }}</strong></span
          >
        </div>
      </div>
    </aside>
    <DetailPanel :open="mobileOpen" title="Menü" @close="mobileOpen = false"
      ><NavLinks @navigate="mobileOpen = false"
    /></DetailPanel>
    <div class="main-area">
      <div class="desktop-topbar">
        <span><span class="status-dot" /> VENOR2 <i>/</i> NEM HIVATALOS JÁTÉKSEGÉDLET</span
        ><span><ShieldCheck :size="14" /> Helyben tárolva · fiók nélkül</span>
      </div>
      <main
        id="main-content"
        class="content-wrap"
        :class="{ 'content-wrap--wide': ['compare', 'shops', 'pets'].includes(String(route.name)) }"
        tabindex="-1"
      >
        <slot />
      </main>
      <footer class="app-footer">
        <span>Wiki-adatok és saját árak; nem élő piaci adatok.</span>
      </footer>
    </div>
  </div>
</template>
<style scoped src="./AppShell.css"></style>
