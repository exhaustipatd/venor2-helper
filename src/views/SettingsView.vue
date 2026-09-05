<script setup lang="ts">
import { ref } from 'vue'
import { AlertTriangle, Database, Download, Trash2, Upload } from '@lucide/vue'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'
import { formatDate } from '@/utils/format'

const dataStore = useDataStore()
const userStore = useUserStore()
const fileInput = ref<HTMLInputElement>()
const gamePriceInput = ref<HTMLInputElement>()
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

async function handleImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    await userStore.importData(file)
    messageType.value = 'success'
    message.value = 'A mentés sikeresen betöltve.'
  } catch (error) {
    messageType.value = 'error'
    message.value = error instanceof Error ? error.message : 'Sikertelen importálás.'
  }
  if (fileInput.value) fileInput.value.value = ''
}

async function handleGamePriceImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const result = await userStore.importGamePrices(file)
    messageType.value = 'success'
    message.value = `${result.imported} játékbeli ár sikeresen betöltve.${result.skipped ? ` ${result.skipped} hibás sor kihagyva.` : ''}`
  } catch (error) {
    messageType.value = 'error'
    message.value = error instanceof Error ? error.message : 'A játékbeli árak betöltése sikertelen.'
  }
  if (gamePriceInput.value) gamePriceInput.value.value = ''
}

function clearData() {
  if (confirm('Biztosan törlöd az összes árat és a kisállat-gyűjteményt?')) {
    userStore.clearAll(); messageType.value = 'success'; message.value = 'A helyi adatok törölve.'
  }
}
</script>

<template>
  <div>
    <header class="page-heading"><div><span class="eyebrow">ADATKEZELÉS</span><h1>Beállítások</h1><p>Készíts biztonsági mentést a saját árairól és a gyűjteményedről.</p></div></header>
    <p v-if="message" class="notice" :class="messageType === 'success' ? 'notice--success' : 'notice--warning'">{{ message }}</p>
    <div class="settings-grid">
      <section class="settings-card"><div class="settings-card__icon"><Download /></div><div><h2>Biztonsági mentés</h2><p>Az árlista és a megszerzett kisállatok egyetlen JSON-fájlba kerülnek.</p><button class="button button--primary" @click="userStore.exportData"><Download :size="17" /> Mentés letöltése</button></div></section>
      <section class="settings-card"><div class="settings-card__icon"><Upload /></div><div><h2>Mentés visszaállítása</h2><p>Egy korábban letöltött Venor Helper mentés betöltése.</p><input ref="fileInput" hidden type="file" accept="application/json,.json" @change="handleImport" /><button class="button" @click="fileInput?.click()"><Upload :size="17" /> Fájl kiválasztása</button></div></section>
      <section class="settings-card settings-card--wide game-price-import"><div class="settings-card__icon"><Upload /></div><div><h2>Játékbeli árak importálása</h2><p>Válaszd ki a <code>C:\Venor2\shop\price_history_vnum.json</code> fájlt. Az árak hozzáadódnak a jelenlegi listához, az azonos tárgyak korábbi árait pedig frissítik.</p><input ref="gamePriceInput" hidden type="file" accept="application/json,.json" @change="handleGamePriceImport" /><button class="button button--primary" @click="gamePriceInput?.click()"><Upload :size="17" /> Játékbeli árlista feltöltése</button><small>A <code>price_history_hash.json</code> fájl nem használható.</small></div></section>
      <section class="settings-card settings-card--wide"><div class="settings-card__icon"><Database /></div><div><h2>Wiki-adatcsomag</h2><dl><div><dt>Forrás</dt><dd><a :href="dataStore.meta.source" target="_blank" rel="noreferrer">wiki.venor2.hu</a></dd></div><div><dt>Frissítve</dt><dd>{{ formatDate(dataStore.meta.generatedAt) }}</dd></div><div><dt>Tárgyadatok</dt><dd :class="{ warning: !dataStore.meta.completeItems }">{{ dataStore.meta.completeItems ? 'Teljes' : 'Részleges' }}</dd></div><div><dt>Kisállatok</dt><dd :class="{ warning: !dataStore.meta.completePets }">{{ dataStore.meta.completePets ? 'Teljes' : 'Szinkronizálás szükséges' }}</dd></div></dl><p v-if="dataStore.meta.note" class="data-note"><AlertTriangle :size="16" /> {{ dataStore.meta.note }}</p><code class="command">npm run sync-data</code></div></section>
      <section class="settings-card settings-card--danger"><div class="settings-card__icon"><Trash2 /></div><div><h2>Helyi adatok törlése</h2><p>Minden megadott ár és gyűjteményjelölés véglegesen törlődik ebből a böngészőből.</p><button class="button button--danger" @click="clearData"><Trash2 :size="17" /> Minden törlése</button></div></section>
    </div>
  </div>
</template>

<style scoped src="./SettingsView.css"></style>
