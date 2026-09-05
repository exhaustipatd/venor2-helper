<script setup lang="ts">
import { computed, ref } from 'vue'
import { Upload, Download, CheckCheck } from '@lucide/vue'
import { parseGamePrices, readImportFile, type GameImport } from '@/domain/userData'
import { useUserStore } from '@/stores/user'
import { useDataStore } from '@/stores/data'
import { itemName } from '@/utils/format'
import DetailPanel from './DetailPanel.vue'
import CurrencyAmount from './CurrencyAmount.vue'
const user = useUserStore(),
  data = useDataStore()
const input = ref<HTMLInputElement>(),
  preview = ref<GameImport | null>(null),
  error = ref(''),
  message = ref(''),
  busy = ref(false)
const replaced = computed(
  () => Object.keys(preview.value?.prices ?? {}).filter((id) => user.marketPrice(Number(id)) !== null).length,
)
async function select(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  error.value = ''
  message.value = ''
  busy.value = true
  try {
    preview.value = parseGamePrices(await readImportFile(file))
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Sikertelen importálás.'
  } finally {
    busy.value = false
    if (input.value) input.value.value = ''
  }
}
function confirm() {
  if (!preview.value) return
  const count = Object.keys(preview.value.prices).length
  user.applyGamePrices(preview.value)
  preview.value = null
  message.value = `${count} ár betöltve.`
}
</script>
<template>
  <div class="game-import">
    <input
      ref="input"
      hidden
      type="file"
      accept="application/json,.json"
      aria-label="Játékbeli árlista fájl"
      @change="select"
    />
    <div class="game-price-actions">
      <button class="button button--primary" :disabled="busy" @click="input?.click()">
        <Upload :size="16" /> {{ busy ? 'Fájl ellenőrzése…' : 'Játékbeli árak importálása' }}
      </button>
      <button v-if="user.pricedItemCount" class="button" @click="user.exportGamePrices">
        <Download :size="16" /> Árak exportálása játékhoz
      </button>
    </div>
    <p v-if="error" class="negative" role="alert">{{ error }}</p>
    <p v-if="message" role="status"><CheckCheck :size="14" /> {{ message }}</p>
    <DetailPanel :open="!!preview" title="Árlista importálása" @close="preview = null"
      ><template v-if="preview">
        <p>
          A <code>price_history_vnum.json</code> árait egységárra számítjuk. Az azonos tárgyak árait
          lecseréljük, a többi ár és a gyűjtemény megmarad.
        </p>
        <div class="metrics">
          <div class="metric">
            <span>Új ár</span><strong>{{ Object.keys(preview.prices).length - replaced }}</strong>
          </div>
          <div class="metric">
            <span>Lecserélt ár</span><strong>{{ replaced }}</strong>
          </div>
          <div class="metric">
            <span>Kihagyott sor</span><strong>{{ preview.skipped }}</strong>
          </div>
        </div>
        <div class="import-list">
          <div v-for="(price, id) in preview.prices" :key="id">
            <span
              >{{ itemName(data.getItem(Number(id))) }} <small>#{{ id }}</small></span
            ><CurrencyAmount :value="BigInt(price.marketPrice)" />
          </div>
        </div>
        <div class="actions">
          <button class="button button--primary" @click="confirm">Árak importálása</button
          ><button class="button" @click="preview = null">Mégse</button>
        </div></template
      ></DetailPanel
    >
  </div>
</template>
<style scoped>
.game-price-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.game-import > p {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin: 8px 0 0;
}
.import-list {
  margin: 24px 0;
  max-height: 42vh;
  overflow: auto;
}
.import-list > div {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 13px 0;
  border-bottom: 1px solid var(--line);
  font-size: 12px;
}
.import-list small {
  display: block;
  color: var(--muted);
}
code {
  overflow-wrap: anywhere;
}
</style>
