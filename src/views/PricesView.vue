<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronDown, Search, Tags } from '@lucide/vue'
import { useDataStore } from '@/stores/data'
import type { ShopOffer, ShopTab } from '@/types/domain'
import { useUserStore } from '@/stores/user'
import { formatYang, itemName } from '@/utils/format'
import { calculateBestCosts, calculateOfferCost } from '@/utils/cost'
import { normalizeSearchText } from '@/utils/search'
import ItemIcon from '@/components/ItemIcon.vue'
import PriceInput from '@/components/PriceInput.vue'
import LoadingState from '@/components/LoadingState.vue'

const dataStore = useDataStore()
const userStore = useUserStore()
const search = ref('')
const filter = ref<'all' | 'missing' | 'set'>('all')
const visibleCount = ref(80)
const expandedItems = ref(new Set<number>())

type DownstreamEntry = {
  offer: ShopOffer
  shop: ShopTab
  unitCost: bigint | null
  profit: bigint | null
  missing: number[]
}

const bestCosts = computed(() => calculateBestCosts(dataStore.shops, (vnum) => userStore.marketPrice(vnum)))
const exchangeSummaries = computed(() => {
  const result = new Map<number, { total: number; complete: number; bestCost: bigint | null; npcName: string }>()
  for (const shop of dataStore.shops) {
    for (const offer of shop.offers) {
      const current = result.get(offer.item_vnum) ?? { total: 0, complete: 0, bestCost: null, npcName: '' }
      const cost = calculateOfferCost(offer, bestCosts.value)
      current.total++
      if (cost.unitCost !== null) {
        current.complete++
        if (current.bestCost === null || cost.unitCost < current.bestCost) {
          current.bestCost = cost.unitCost
          current.npcName = shop.npc_name
        }
      }
      result.set(offer.item_vnum, current)
    }
  }
  return result
})
const downstreamOffers = computed(() => {
  const result = new Map<number, DownstreamEntry[]>()
  for (const shop of dataStore.shops) {
    for (const offer of shop.offers) {
      const cost = calculateOfferCost(offer, bestCosts.value)
      const outputPrice = userStore.marketPrice(offer.item_vnum)
      const entry: DownstreamEntry = {
        offer,
        shop,
        unitCost: cost.unitCost,
        profit: cost.unitCost !== null && outputPrice !== null ? outputPrice - cost.unitCost : null,
        missing: cost.missing,
      }
      const ingredientIds = new Set(offer.prices
        .filter((price) => price.price_type === 3 && price.price_vnum)
        .map((price) => price.price_vnum))
      for (const ingredientId of ingredientIds) {
        const entries = result.get(ingredientId) ?? []
        entries.push(entry)
        result.set(ingredientId, entries)
      }
    }
  }
  for (const entries of result.values()) {
    entries.sort((a, b) => {
      if (a.unitCost !== null && b.unitCost === null) return -1
      if (a.unitCost === null && b.unitCost !== null) return 1
      if (a.profit !== null && b.profit !== null && a.profit !== b.profit) return a.profit > b.profit ? -1 : 1
      return itemName(dataStore.getItem(a.offer.item_vnum)).localeCompare(itemName(dataStore.getItem(b.offer.item_vnum)), 'hu')
    })
  }
  return result
})
const filteredItems = computed(() => {
  const term = normalizeSearchText(search.value)
  return dataStore.relevantItems.filter((item) => {
    const hasPrice = userStore.marketPrice(item.vnum) !== null
    if (filter.value === 'missing' && hasPrice) return false
    if (filter.value === 'set' && !hasPrice) return false
    return !term || normalizeSearchText(itemName(item)).includes(term) || String(item.vnum).includes(term)
  })
})
const visibleItems = computed(() => filteredItems.value.slice(0, visibleCount.value))
watch([search, filter], () => { visibleCount.value = 80 })

function toggleExpanded(vnum: number) {
  const next = new Set(expandedItems.value)
  next.has(vnum) ? next.delete(vnum) : next.add(vnum)
  expandedItems.value = next
}

function ingredientAmount(offer: ShopOffer, vnum: number): number {
  return offer.prices
    .filter((price) => price.price_type === 3 && price.price_vnum === vnum)
    .reduce((sum, price) => sum + price.amount, 0)
}

function missingNames(entry: DownstreamEntry): string {
  return entry.missing.map((vnum) => itemName(dataStore.getItem(vnum))).join(', ')
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value
}
</script>

<template>
  <LoadingState v-if="dataStore.loading" />
  <div v-else>
    <header class="page-heading"><div><span class="eyebrow">SAJÁT PIACI ADATOK</span><h1>Árlista</h1><p>Minden tárgyhoz egyetlen piaci árat adhatsz meg. Ezt használjuk az alapanyagköltséghez és a várható eladási bevételhez is.</p></div></header>
    <section class="filter-bar">
      <label class="search-field search-field--wide"><Search :size="17" /><input v-model="search" placeholder="Tárgy vagy VNUM keresése…" /></label>
      <div class="segmented"><button :class="{ active: filter === 'all' }" @click="filter = 'all'">Mind</button><button :class="{ active: filter === 'missing' }" @click="filter = 'missing'">Hiányzó</button><button :class="{ active: filter === 'set' }" @click="filter = 'set'">Beállított</button></div>
    </section>
    <div class="result-line"><strong>{{ filteredItems.length }}</strong> tárgy</div>

    <section v-if="visibleItems.length" class="price-table">
      <header><span>Tárgy</span><span>Felhasználás</span><span>Kiváltási árak</span><span>Legjobb beszerzés</span><span>Piaci ár</span></header>
      <article v-for="item in visibleItems" :key="item.vnum">
        <div class="item-identity"><ItemIcon :vnum="item.vnum" :size="42" /><div><strong>{{ itemName(item) }}</strong><small>#{{ item.vnum }}</small></div></div>
        <button
          v-if="downstreamOffers.get(item.vnum)?.length"
          class="usage-badge usage-badge--button"
          :class="{ active: expandedItems.has(item.vnum) }"
          :aria-expanded="expandedItems.has(item.vnum)"
          @click="toggleExpanded(item.vnum)"
        >
          {{ downstreamOffers.get(item.vnum)?.length }} továbbváltás
          <ChevronDown :size="13" />
        </button>
        <span v-else class="usage-badge">Kapott tárgy</span>
        <div v-if="exchangeSummaries.get(item.vnum)" class="exchange-cost">
          <strong v-if="exchangeSummaries.get(item.vnum)?.bestCost !== null">{{ formatYang(exchangeSummaries.get(item.vnum)!.bestCost!) }}</strong>
          <strong v-else>Nem számolható</strong>
          <RouterLink :to="{ path: '/osszehasonlitas', query: { item: item.vnum } }">
            {{ exchangeSummaries.get(item.vnum)?.complete }}/{{ exchangeSummaries.get(item.vnum)?.total }} váltás · részletek
          </RouterLink>
        </div>
        <span v-else class="exchange-cost exchange-cost--missing">Nem kiváltható</span>
        <div v-if="bestCosts.get(item.vnum)" class="best-cost" :class="{ 'best-cost--shop': bestCosts.get(item.vnum)?.kind === 'shop' }">
          <strong>{{ formatYang(bestCosts.get(item.vnum)!.unitCost) }}</strong>
          <span>{{ bestCosts.get(item.vnum)?.kind === 'shop' ? bestCosts.get(item.vnum)?.npcName : 'Játékospiac' }}</span>
        </div>
        <span v-else class="best-cost best-cost--missing">Nincs elég adat</span>
        <PriceInput compact label="Piaci ár" :model-value="userStore.priceFor(item.vnum).marketPrice" @update:model-value="userStore.updatePrice(item.vnum, $event)" />

        <section v-if="expandedItems.has(item.vnum)" class="downstream-panel">
          <header><div><span>EBBŐL KIVÁLTHATÓ</span><strong>{{ downstreamOffers.get(item.vnum)?.length }} lehetőség</strong></div><small>A megadott piaci ár változásakor automatikusan újraszámolva</small></header>
          <div class="downstream-list">
            <article v-for="entry in downstreamOffers.get(item.vnum)" :key="`${entry.shop.vnum}-${entry.offer.order}`" class="downstream-entry">
              <div class="item-identity"><ItemIcon :vnum="entry.offer.item_vnum" :size="34" /><div><strong>{{ itemName(dataStore.getItem(entry.offer.item_vnum)) }}</strong><small>{{ entry.shop.npc_name }}</small></div></div>
              <div class="downstream-requirement"><span>Ebből szükséges</span><strong>×{{ ingredientAmount(entry.offer, item.vnum) }}</strong></div>
              <div class="downstream-cost"><span>Kiváltási ár / db</span><strong v-if="entry.unitCost !== null">{{ formatYang(entry.unitCost) }}</strong><strong v-else class="text-warning">Nem számolható</strong><small v-if="entry.missing.length">Hiányzik: {{ missingNames(entry) }}</small></div>
              <div class="downstream-profit" :class="{ positive: entry.profit !== null && entry.profit >= 0n, negative: entry.profit !== null && entry.profit < 0n }"><span>Profit / db</span><strong v-if="entry.profit !== null">{{ entry.profit >= 0n ? '+' : '−' }}{{ formatYang(absolute(entry.profit)) }}</strong><strong v-else>—</strong></div>
              <RouterLink :to="{ path: '/osszehasonlitas', query: { item: entry.offer.item_vnum } }">Részletek</RouterLink>
            </article>
          </div>
        </section>
      </article>
      <button v-if="visibleCount < filteredItems.length" class="load-more" @click="visibleCount += 80">További 80 tárgy betöltése</button>
    </section>
    <section v-else class="empty-state"><Tags /><h2>Nincs találat</h2><p>Módosítsd a keresést vagy a szűrőt.</p></section>
  </div>
</template>

<style scoped src="./PricesView.css"></style>
