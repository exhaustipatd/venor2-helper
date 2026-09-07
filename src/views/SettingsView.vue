<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, Upload, Database, Trash2, RefreshCw, Sun, Moon } from '@lucide/vue'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'
import { migrateUserData, readImportFile, type PersistedState } from '@/domain/userData'
import { formatDate } from '@/utils/format'
import GamePriceImport from '@/components/GamePriceImport.vue'
import DetailPanel from '@/components/DetailPanel.vue'
const data = useDataStore(),
  user = useUserStore(),
  theme = useThemeStore()
const fileInput = ref<HTMLInputElement>(),
  preview = ref<PersistedState | null>(null),
  confirmed = ref(false),
  deleting = ref(false),
  error = ref(''),
  message = ref(''),
  busy = ref(false)
const priceCount = computed(
  () => Object.values(preview.value?.prices ?? {}).filter((p) => p.marketPrice).length,
)
async function select(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  error.value = ''
  message.value = ''
  busy.value = true
  confirmed.value = false
  try {
    preview.value = migrateUserData(await readImportFile(file))
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Sikertelen importálás.'
  } finally {
    busy.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}
function restore() {
  if (preview.value && confirmed.value) {
    user.restore(preview.value)
    preview.value = null
    message.value = 'A mentés visszaállítva. A helyi mentés állapotát fent ellenőrizheted.'
  }
}
function requestClear() {
  confirmed.value = false
  deleting.value = true
}
function clear() {
  if (confirmed.value) {
    user.clearAll()
    deleting.value = false
    message.value = 'A jelenlegi helyi árlista és gyűjtemény törölve.'
  }
}
</script>
<template>
  <div>
    <header class="page-heading">
      <div>
        <h1>Beállítások</h1>
      </div>
    </header>
    <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
    <p v-if="message" class="notice notice--success" role="status">{{ message }}</p>
    <div class="settings-grid">
      <section class="panel settings-card">
        <span class="settings-icon"><Download :size="23" /></span>
        <h2>Biztonsági mentés</h2>
        <p>
          {{ user.pricedItemCount }} ár, {{ user.ownedPets.size }} megszerzett kisállat és
          {{ user.targetPets.size }} gyűjteménycél, valamint az NPC-kapcsolók egy JSON-fájlban.
        </p>
        <button class="button button--primary" @click="user.exportData">
          <Download :size="16" /> Mentés letöltése
        </button>
      </section>
      <section class="panel settings-card">
        <span class="settings-icon"><Upload :size="23" /></span>
        <h2>Mentés visszaállítása</h2>
        <p>v2, v3 vagy v4 mentés betöltése. Jóváhagyás után lecseréli a jelenlegi adatokat.</p>
        <input
          ref="fileInput"
          hidden
          type="file"
          accept="application/json,.json"
          aria-label="Biztonsági mentés fájl"
          @change="select"
        /><button class="button" :disabled="busy" @click="fileInput?.click()">
          <Upload :size="16" /> {{ busy ? 'Ellenőrzés…' : 'Mentés kiválasztása' }}
        </button>
      </section>
      <section class="panel settings-card settings-wide import-settings">
        <div>
          <h2>Játékbeli árak importálása</h2>
          <p>
            Válaszd ki a <code>C:\Venor2\shop\price_history_vnum.json</code> fájlt. A hash-változat nem
            támogatott. Az importált árakat egységárként mentjük. Az exportgomb ugyanebben a formátumban tölti
            le a weboldalon mentett árakat; a fájlt másold vissza ebbe a mappába.
          </p>
        </div>
        <GamePriceImport />
      </section>
      <section class="panel settings-card">
        <h2>Megjelenés</h2>
        <div class="theme-choices">
          <button
            class="theme-choice dark-preview"
            :aria-pressed="theme.isDark"
            @click="theme.setTheme('dark')"
          >
            <Moon :size="20" /><strong>Sötét</strong></button
          ><button
            class="theme-choice light-preview"
            :aria-pressed="!theme.isDark"
            @click="theme.setTheme('light')"
          >
            <Sun :size="20" /><strong>Világos</strong>
          </button>
        </div>
      </section>
      <section class="panel settings-card">
        <h2><Database :size="20" /> Wiki-adatcsomag</h2>
        <dl class="data-facts">
          <div>
            <dt>Forrás</dt>
            <dd>
              <a :href="data.meta.source" target="_blank" rel="noreferrer" class="text-link"
                >wiki.venor2.hu ↗</a
              >
            </dd>
          </div>
          <div>
            <dt>Frissítve</dt>
            <dd>{{ formatDate(data.meta.generatedAt) }}</dd>
          </div>
          <div>
            <dt>Tárgyak / kisállatok</dt>
            <dd>{{ data.items.length }} / {{ data.pets.length }}</dd>
          </div>
          <div>
            <dt>Teljesség</dt>
            <dd>
              {{
                data.meta.completeItems && data.meta.completePets
                  ? 'Teljes wiki-csomag'
                  : 'Részleges wiki-csomag'
              }}
            </dd>
          </div>
        </dl>
        <p class="small-copy">
          A kézi javítások a wiki fölé kerülnek. A csomag dátuma nem a piaci árak frissességét jelzi.
        </p>
        <button class="button" :disabled="data.loading" @click="data.load(true)">
          <RefreshCw :size="15" /> {{ data.loading ? 'Betöltés…' : 'Csomag újratöltése' }}
        </button>
      </section>
      <section class="panel settings-card settings-wide danger-zone">
        <div>
          <h2>Helyi adatok törlése</h2>
          <p>
            A jelenlegi árakat, megszerzett kisállatokat és célokat törli, az NPC-kapcsolókat alaphelyzetbe
            állítja. A korábbi v2 és v3 migrációs mentések külön megmaradnak.
          </p>
        </div>
        <button class="button button--danger" @click="requestClear">
          <Trash2 :size="16" /> Helyi adatok törlése
        </button>
      </section>
    </div>
    <DetailPanel :open="!!preview" title="Mentés visszaállítása" @close="preview = null"
      ><template v-if="preview"
        ><div class="notice notice--warning">
          Ez nem összevonás. A jelenlegi árlista, gyűjtemény, célok és NPC-beállítások teljesen lecserélődnek.
        </div>
        <div class="restore-comparison">
          <span>Jelenleg</span
          ><strong
            >{{ user.pricedItemCount }} ár · {{ user.ownedPets.size }} kisállat ·
            {{ user.targetPets.size }} cél · {{ Object.keys(user.npcEnabled).length }} NPC-beállítás</strong
          ><span>A kiválasztott mentésben</span
          ><strong
            >{{ priceCount }} ár · {{ preview.ownedPets.length }} kisállat ·
            {{ preview.targetPets.length }} cél ·
            {{ Object.keys(preview.npcEnabled).length }} NPC-beállítás</strong
          >
        </div>
        <button class="button" @click="user.exportData">
          <Download :size="16" /> Előbb mentem a jelenlegi adatokat</button
        ><label class="confirmation"
          ><input v-model="confirmed" type="checkbox" /> Megértettem, hogy a jelenlegi adatokat
          lecserélem.</label
        >
        <div class="actions">
          <button class="button button--primary" :disabled="!confirmed" @click="restore">
            Mentés visszaállítása</button
          ><button class="button" @click="preview = null">Mégse</button>
        </div></template
      ></DetailPanel
    ><DetailPanel :open="deleting" title="Helyi adatok törlése" @close="deleting = false"
      ><p class="notice notice--warning">
        A törlést csak egy korábbi mentés visszaállításával vonhatod vissza.
      </p>
      <button class="button" @click="user.exportData">
        <Download :size="16" /> Biztonsági mentés letöltése</button
      ><label class="confirmation"
        ><input v-model="confirmed" type="checkbox" /> Törlöm a jelenlegi árakat, gyűjteményt és célokat, az
        NPC-kapcsolókat alaphelyzetbe állítom.</label
      >
      <div class="actions">
        <button class="button button--danger" :disabled="!confirmed" @click="clear">
          Igen, minden jelenlegi adat törlése</button
        ><button class="button" @click="deleting = false">Mégse</button>
      </div></DetailPanel
    >
  </div>
</template>
<style scoped src="./SettingsView.css"></style>
