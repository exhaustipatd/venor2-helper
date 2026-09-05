<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Search, Tags, ChevronDown, CheckCheck } from '@lucide/vue'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'
import { useMarketStore } from '@/stores/market'
import { useQueryState } from '@/composables/useQueryState'
import { isStale } from '@/domain/userData'
import { normalizeSearchText } from '@/utils/search'
import { itemName } from '@/utils/format'
import ItemIcon from '@/components/ItemIcon.vue'
import PriceInput from '@/components/PriceInput.vue'
import PriceStatus from '@/components/PriceStatus.vue'
import CurrencyAmount from '@/components/CurrencyAmount.vue'
import GamePriceImport from '@/components/GamePriceImport.vue'
const data = useDataStore(),
  user = useUserStore(),
  market = useMarketStore()
const search = useQueryState('q'),
  filter = useQueryState('filter', 'all')
const visibleCount = ref(60),
  expanded = ref(new Set<number>())
const filters = [
  { key: 'all', label: 'Mind' },
  { key: 'missing', label: 'Hiányzó' },
  { key: 'stale', label: 'Ellenőrizendő' },
  { key: 'set', label: 'Beállított' },
]
const filtered = computed(() =>
  data.relevantItems.filter((item) => {
    const price = user.marketPrice(item.vnum)
    if (filter.value === 'missing' && price !== null) return false
    if (filter.value === 'set' && price === null) return false
    if (filter.value === 'stale' && (price === null || !isStale(user.priceFor(item.vnum)))) return false
    return normalizeSearchText(`${itemName(item)} ${item.vnum}`).includes(normalizeSearchText(search.value))
  }),
)
watch([search, filter], () => {
  visibleCount.value = 60
})
function toggle(id: number) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}
</script>
<template>
  <div>
    <header class="page-heading">
      <div>
        <h1>Árlista</h1>
        <p>
          Az egységár vételre és eladásra is érvényes. A 7 napnál régebbi árakat ellenőrizendőként jelöljük.
        </p>
      </div>
      <GamePriceImport />
    </header>
    <div class="price-workspace-status">
      <span><Tags :size="15" /> {{ user.pricedItemCount }} mentett ár</span
      ><span role="status" :class="{ negative: user.storageError }"
        ><CheckCheck :size="15" />
        {{
          user.storageError
            ? 'Mentési hiba — készíts biztonsági mentést'
            : user.savedAt
              ? 'Mentve a böngészőben'
              : 'Helyi árlista · nincs automatikus piaci frissítés'
        }}</span
      >
    </div>
    <section class="filter-bar">
      <label class="search-field"
        ><Search :size="16" /><input
          v-model="search"
          aria-label="Árlista keresése"
          placeholder="Tárgy neve vagy VNUM…"
      /></label>
      <div class="segmented" aria-label="Árlista szűrő">
        <button
          v-for="entry in filters"
          :key="entry.key"
          :class="{ active: filter === entry.key }"
          :aria-pressed="filter === entry.key"
          @click="filter = entry.key"
        >
          {{ entry.label }}
        </button>
      </div>
    </section>
    <div class="result-line">
      <strong>{{ filtered.length }}</strong> tárgy · Enter: mentés · Esc: elvetés · 1b = 1 billió Yang
    </div>
    <table v-if="filtered.length" class="price-table">
      <caption class="sr-only">
        Saját piaci árak és beszerzési lehetőségek
      </caption>
      <thead>
        <tr>
          <th scope="col">Tárgy</th>
          <th scope="col">Felhasználás</th>
          <th scope="col">Legjobb ismert ár / db</th>
          <th scope="col">Saját piaci egységár</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="item in filtered.slice(0, visibleCount)" :key="item.vnum"
          ><tr>
            <td>
              <div class="item-identity">
                <ItemIcon :vnum="item.vnum" :size="42" />
                <div>
                  <strong>{{ itemName(item) }}</strong
                  ><small>#{{ item.vnum }}</small>
                </div>
              </div>
            </td>
            <td>
              <button
                v-if="market.downstream.get(item.vnum)?.length"
                class="usage-button"
                :aria-expanded="expanded.has(item.vnum)"
                :aria-label="`${itemName(item)} felhasználása`"
                @click="toggle(item.vnum)"
              >
                {{ market.downstream.get(item.vnum)?.length }} továbbváltás <ChevronDown :size="13" /></button
              ><span v-else class="muted">Kapott tárgy</span>
            </td>
            <td>
              <div class="table-cost">
                <CurrencyAmount
                  :value="market.bestCosts.get(item.vnum)?.unitCost ?? user.marketPrice(item.vnum)"
                /><small>{{
                  market.bestCosts.get(item.vnum)?.kind === 'shop'
                    ? market.bestCosts.get(item.vnum)?.npcName
                    : user.marketPrice(item.vnum) !== null
                      ? 'Játékospiac'
                      : 'Nincs teljes áradat'
                }}</small
                ><RouterLink
                  v-if="market.byItem.has(item.vnum)"
                  class="text-link"
                  :to="{ path: '/osszehasonlitas', query: { item: item.vnum } }"
                  >Váltások →</RouterLink
                >
              </div>
            </td>
            <td>
              <div class="table-price">
                <PriceInput
                  compact
                  :label="`${itemName(item)} piaci ára`"
                  :model-value="user.priceFor(item.vnum).marketPrice"
                  @update:model-value="user.updatePrice(item.vnum, $event)"
                /><PriceStatus :vnum="item.vnum" /><button
                  v-if="user.marketPrice(item.vnum) !== null && isStale(user.priceFor(item.vnum))"
                  class="confirm-price"
                  :aria-label="`${itemName(item)} ára ellenőrizve`"
                  @click="user.refreshPrice(item.vnum)"
                >
                  Az ár még érvényes ✓
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="expanded.has(item.vnum)" class="usage-detail">
            <td colspan="4">
              <div class="downstream-panel">
                <h3>Ebből kiváltható</h3>
                <RouterLink
                  v-for="entry in market.downstream.get(item.vnum)"
                  :key="entry.key"
                  :to="{ path: '/osszehasonlitas', query: { item: entry.offer.item_vnum } }"
                  ><div class="item-identity">
                    <ItemIcon :vnum="entry.offer.item_vnum" :size="32" />
                    <div>
                      <strong>{{ itemName(data.getItem(entry.offer.item_vnum)) }}</strong
                      ><small>{{ entry.shop.npc_name }}</small>
                    </div>
                  </div>
                  <span>Becsült profit / db <CurrencyAmount :value="entry.profit" signed /></span
                  ><span class="text-link">Részletek →</span></RouterLink
                >
              </div>
            </td>
          </tr></template
        >
      </tbody>
    </table>
    <button v-if="visibleCount < filtered.length" class="button load-more" @click="visibleCount += 60">
      További {{ Math.min(60, filtered.length - visibleCount) }} tárgy betöltése
    </button>
    <section v-if="!filtered.length" class="empty-state">
      <Tags :size="30" />
      <h2>Nincs találat</h2>
      <p>Módosítsd a keresést vagy válassz másik szűrőt.</p>
    </section>
  </div>
</template>
<style scoped src="./PricesView.css"></style>
