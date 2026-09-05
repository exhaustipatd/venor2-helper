<script setup lang="ts">
import { LayoutDashboard, Store, ArrowRightLeft, PawPrint, Tags, Settings, ChevronRight } from '@lucide/vue'
const emit = defineEmits<{ navigate: [] }>()
const entries = [
  { to: '/', label: 'Áttekintés', icon: LayoutDashboard, description: 'A kaland itt kezdődik' },
  {
    to: '/osszehasonlitas',
    label: 'Cserekereső',
    icon: ArrowRightLeft,
    description: 'Találd meg a jobb utat',
  },
  { to: '/boltok', label: 'NPC-boltok', icon: Store, description: 'Kereskedők és ajánlatok' },
  { to: '/kisallatok', label: 'Kisállatok', icon: PawPrint, description: 'Építsd a gyűjteményed' },
  { to: '/arlista', label: 'Árlista', icon: Tags, description: 'A saját piaci tudásod' },
  { to: '/beallitasok', label: 'Beállítások', icon: Settings, description: 'Mentsd a haladásod' },
]
</script>
<template>
  <nav aria-label="Fő navigáció" class="nav-links">
    <RouterLink v-for="entry in entries" :key="entry.to" :to="entry.to" @click="emit('navigate')"
      ><component :is="entry.icon" :size="19" :stroke-width="1.6" /><span
        ><strong>{{ entry.label }}</strong
        ><small>{{ entry.description }}</small></span
      ><ChevronRight :size="13"
    /></RouterLink>
  </nav>
</template>
<style scoped>
.nav-links {
  display: grid;
  gap: 7px;
}
a {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid transparent;
  padding: 12px;
  border-radius: 8px;
  color: var(--nav-text);
}
a > span {
  flex: 1;
}
strong {
  display: block;
  font-size: 13px;
  font-weight: 700;
}
small {
  display: block;
  margin-top: 3px;
  color: var(--muted-2);
  font-size: 10px;
}
a > svg:last-child {
  opacity: 0;
}
a:hover {
  background: var(--nav-hover-bg);
  color: var(--nav-hover-text);
}
a.router-link-exact-active {
  border-color: var(--accent-line-soft);
  background: var(--nav-active-bg);
  color: var(--accent);
  box-shadow: inset 3px 0 var(--accent);
}
a.router-link-exact-active > svg:last-child {
  opacity: 1;
}
</style>
