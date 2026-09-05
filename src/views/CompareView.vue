<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowRightLeft, CircleAlert, Search, ShoppingCart, Store, TrendingUp } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import type { ShopOffer, ShopPrice, ShopTab } from '@/types/domain'
import type { CostSource } from '@/utils/cost'
import { calculateBestCosts, calculateOfferCost } from '@/utils/cost'
import { formatInteger, formatYang, itemName } from '@/utils/format'
import { normalizeSearchText } from '@/utils/search'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'
import ItemIcon from '@/components/ItemIcon.vue'
import LoadingState from '@/components/LoadingState.vue'
import PriceInput from '@/components/PriceInput.vue'

type OfferEntry = { offer: ShopOffer; shop: ShopTab }
type ItemGroup = {
  vnum: number
  offers: OfferEntry[]
  marketPrice: bigint | null
  bestProfit: bigint | null
  completeExchangeCount: number
}
type ComparisonRoute = {
  key: string
  kind: 'market' | 'shop'
  offer?: ShopOffer
  shop?: ShopTab
  count: number
  totalCost: bigint
  unitCost: bigint | null
  profit: bigint | null
  unitProfit: bigint | null
  margin: number | null
  missing: number[]
  complete: boolean
}

const dataStore = useDataStore()
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()
const search = ref('')
const selectedVnum = ref<number | null>(Number(route.query.item) || null)

const bestCosts = computed(() => calculateBestCosts(dataStore.shops, (vnum) => userStore.marketPrice(vnum)))

const itemGroups = computed<ItemGroup[]>(() => {
  const grouped = new Map<number, OfferEntry[]>()
  for (const shop of dataStore.shops) {
    for (const offer of shop.offers) {
      const entries = grouped.get(offer.item_vnum) ?? []
      entries.push({ offer, shop })
      grouped.set(offer.item_vnum, entries)
    }
  }

  return [...grouped].map(([vnum, offers]) => {
    const marketPrice = userStore.marketPrice(vnum)
    let bestProfit: bigint | null = null
    let completeExchangeCount = 0
    for (const { offer } of offers) {
      const cost = calculateOfferCost(offer, bestCosts.value)
      if (cost.unitCost === null) continue
      completeExchangeCount++
      if (marketPrice !== null) {
        const profit = marketPrice - cost.unitCost
        if (bestProfit === null || profit > bestProfit) bestProfit = profit
      }
    }
    return { vnum, offers, marketPrice, bestProfit, completeExchangeCount }
  }).sort((a, b) => {
    const aReady = a.bestProfit !== null
    const bReady = b.bestProfit !== null
    if (aReady !== bReady) return aReady ? -1 : 1
    if (aReady && bReady && a.bestProfit !== b.bestProfit) return a.bestProfit! > b.bestProfit! ? -1 : 1
    const aPriced = a.marketPrice !== null
    const bPriced = b.marketPrice !== null
    if (aPriced !== bPriced) return aPriced ? -1 : 1
    if (a.completeExchangeCount !== b.completeExchangeCount) return b.completeExchangeCount - a.completeExchangeCount
    return itemName(dataStore.getItem(a.vnum)).localeCompare(itemName(dataStore.getItem(b.vnum)), 'hu')
  })
})

const filteredGroups = computed(() => {
  const term = normalizeSearchText(search.value)
  if (!term) return itemGroups.value
  return itemGroups.value.filter((group) => {
    const name = normalizeSearchText(itemName(dataStore.getItem(group.vnum)))
    return name.includes(term) || String(group.vnum).includes(term)
  })
})

const selectedGroup = computed(() => itemGroups.value.find((group) => group.vnum === selectedVnum.value) ?? filteredGroups.value[0])
watch(selectedGroup, (group) => {
  if (!group || group.vnum === selectedVnum.value) return
  selectedVnum.value = group.vnum
}, { immediate: true })
watch(selectedVnum, (item) => router.replace({ query: item ? { item } : {} }))

const comparisonRoutes = computed<ComparisonRoute[]>(() => {
  const group = selectedGroup.value
  if (!group) return []
  const marketPrice = userStore.marketPrice(group.vnum)
  const result: ComparisonRoute[] = [{
    key: 'market',
    kind: 'market',
    count: 1,
    totalCost: marketPrice ?? 0n,
    unitCost: marketPrice,
    profit: marketPrice !== null ? 0n : null,
    unitProfit: marketPrice !== null ? 0n : null,
    margin: marketPrice !== null ? 0 : null,
    missing: marketPrice === null ? [group.vnum] : [],
    complete: marketPrice !== null,
  }]

  for (const { offer, shop } of group.offers) {
    const cost = calculateOfferCost(offer, bestCosts.value)
    const revenue = cost.complete && marketPrice !== null ? marketPrice * BigInt(offer.count) : null
    const profit = revenue === null ? null : revenue - cost.totalCost
    result.push({
      key: `${shop.vnum}-${offer.order}`,
      kind: 'shop',
      offer,
      shop,
      count: offer.count,
      totalCost: cost.totalCost,
      unitCost: cost.unitCost,
      profit,
      unitProfit: profit === null || cost.unitCost === null ? null : marketPrice! - cost.unitCost,
      margin: profit === null ? null : calculateMargin(profit, cost.totalCost),
      missing: cost.missing,
      complete: cost.complete,
    })
  }

  return result.sort(compareRoutes)
})

const completeRoutes = computed(() => comparisonRoutes.value.filter((entry) => entry.unitCost !== null))
const cheapestRoute = computed(() => completeRoutes.value.reduce<ComparisonRoute | null>(
  (best, current) => !best || current.unitCost! < best.unitCost! ? current : best,
  null,
))
const cheapestExchange = computed(() => comparisonRoutes.value.filter((entry) => entry.kind === 'shop' && entry.unitCost !== null)
  .reduce<ComparisonRoute | null>((best, current) => !best || current.unitCost! < best.unitCost! ? current : best, null))
const bestProfit = computed(() => comparisonRoutes.value.reduce<bigint | null>((best, current) => {
  if (current.kind !== 'shop' || current.unitProfit === null) return best
  return best === null || current.unitProfit > best ? current.unitProfit : best
}, null))

function compareRoutes(a: ComparisonRoute, b: ComparisonRoute): number {
  if (a.unitProfit !== null && b.unitProfit !== null) {
    if (a.unitProfit !== b.unitProfit) return a.unitProfit > b.unitProfit ? -1 : 1
  } else if (a.unitProfit !== null) return -1
  else if (b.unitProfit !== null) return 1

  if (a.unitCost !== null && b.unitCost !== null) {
    if (a.unitCost !== b.unitCost) return a.unitCost < b.unitCost ? -1 : 1
  } else if (a.unitCost !== null) return -1
  else if (b.unitCost !== null) return 1
  return a.key.localeCompare(b.key)
}

function calculateMargin(profit: bigint, cost: bigint): number | null {
  if (cost <= 0n) return null
  return Number((profit * 10_000n) / cost) / 100
}

function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 }).format(value)}%`
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value
}

function itemPrices(offer: ShopOffer): ShopPrice[] {
  return offer.prices.filter((price) => price.price_type === 3 && price.price_vnum)
}

function fixedYang(offer: ShopOffer): bigint {
  return offer.prices.filter((price) => price.price_type === 1)
    .reduce((sum, price) => sum + BigInt(price.amount), 0n)
}

function unsupportedPrices(offer: ShopOffer): ShopPrice[] {
  return offer.prices.filter((price) => price.price_type !== 1 && !(price.price_type === 3 && price.price_vnum))
}

function sourceFor(vnum: number): CostSource | undefined {
  return bestCosts.value.get(vnum)
}

function priceTypeName(type: number): string {
  if (type === 100) return 'Gaya'
  return `valuta #${type}`
}
</script>

<template>
  <LoadingState v-if="dataStore.loading" />
  <div v-else>
    <header class="page-heading">
      <div>
        <span class="eyebrow">PIAC ÉS NPC-CSERÉK</span>
        <h1>Csere-összehasonlító</h1>
        <p>Hasonlítsd össze a piaci vásárlást az összes váltással. Az alapanyagoknál automatikusan a piac és a további NPC-cserék közül a legolcsóbb út számít.</p>
      </div>
    </header>

    <div class="compare-layout">
      <aside class="compare-sidebar">
        <label class="search-field"><Search :size="17" /><input v-model="search" placeholder="Tárgy keresése…" /></label>
        <div class="compare-sidebar__count">{{ filteredGroups.length }} kiváltható tárgy</div>
        <div class="compare-item-list">
          <button
            v-for="group in filteredGroups"
            :key="group.vnum"
            :class="{ active: selectedGroup?.vnum === group.vnum }"
            @click="selectedVnum = group.vnum"
          >
            <ItemIcon :vnum="group.vnum" :size="34" />
            <span>
              <strong>{{ itemName(dataStore.getItem(group.vnum)) }}</strong>
              <small v-if="group.bestProfit !== null" class="sidebar-profit" :class="{ negative: group.bestProfit < 0n }">{{ group.bestProfit >= 0n ? '+' : '−' }}{{ formatYang(absolute(group.bestProfit)) }} / db</small>
              <small v-else-if="group.marketPrice !== null" class="sidebar-ready">Piaci ár kitöltve · {{ group.completeExchangeCount }}/{{ group.offers.length }} váltás</small>
              <small v-else>{{ group.completeExchangeCount ? `${group.completeExchangeCount}/${group.offers.length} váltás számolható` : `${group.offers.length} váltás · hiányzó árak` }}</small>
            </span>
          </button>
        </div>
      </aside>

      <main v-if="selectedGroup" class="compare-content">
        <section class="compare-hero">
          <div class="compare-hero__identity">
            <ItemIcon :vnum="selectedGroup.vnum" :size="58" />
            <div><span class="overline">TÁRGY #{{ selectedGroup.vnum }}</span><h2>{{ itemName(dataStore.getItem(selectedGroup.vnum)) }}</h2><p>{{ selectedGroup.offers.length }} NPC-váltás + piaci vásárlás</p></div>
          </div>
          <div class="compare-price-inputs">
            <PriceInput label="Piaci egységár" :model-value="userStore.priceFor(selectedGroup.vnum).marketPrice" @update:model-value="userStore.updatePrice(selectedGroup.vnum, $event)" />
          </div>
        </section>

        <section class="comparison-stats">
          <article><span>Legjobb beszerzés</span><strong v-if="cheapestRoute">{{ formatYang(cheapestRoute.unitCost!) }}</strong><strong v-else>—</strong><small v-if="cheapestRoute">{{ cheapestRoute.kind === 'market' ? 'Játékospiac' : cheapestRoute.shop?.npc_name }}</small><small v-else>Nincs elég áradat</small></article>
          <article><span>Legolcsóbb váltás</span><strong v-if="cheapestExchange">{{ formatYang(cheapestExchange.unitCost!) }}</strong><strong v-else>—</strong><small v-if="cheapestExchange">darabonként</small><small v-else>Nincs számolható váltás</small></article>
          <article :class="{ 'stat-positive': bestProfit !== null && bestProfit > 0n, 'stat-negative': bestProfit !== null && bestProfit < 0n }"><span>Legjobb váltási profit</span><strong v-if="bestProfit !== null">{{ bestProfit >= 0n ? '+' : '−' }}{{ formatYang(absolute(bestProfit)) }}</strong><strong v-else>—</strong><small>darabonként, a piaci árhoz képest</small></article>
        </section>

        <div v-if="userStore.marketPrice(selectedGroup.vnum) === null" class="notice notice--warning">
          <CircleAlert :size="18" /><div><strong>Hiányzik a piaci ár</strong><span>A profit és az árrés ennek megadása után jelenik meg.</span></div>
        </div>

        <div class="route-heading"><div><span class="eyebrow">LEHETŐSÉGEK</span><h3>Beszerzési rangsor</h3></div><span>Profit / db szerint rendezve</span></div>
        <section class="route-list">
          <article
            v-for="(entry, index) in comparisonRoutes"
            :key="entry.key"
            class="route-card"
            :class="{ 'route-card--best': cheapestRoute?.key === entry.key, 'route-card--incomplete': !entry.complete }"
          >
            <header class="route-card__header">
              <span class="route-rank">#{{ index + 1 }}</span>
              <span class="route-icon"><ShoppingCart v-if="entry.kind === 'market'" :size="18" /><Store v-else :size="18" /></span>
              <div>
                <strong>{{ entry.kind === 'market' ? 'Piaci vásárlás' : entry.shop?.npc_name }}</strong>
                <small>{{ entry.kind === 'market' ? 'Közvetlen beszerzés játékostól' : entry.shop?.name }}</small>
              </div>
              <span v-if="cheapestRoute?.key === entry.key" class="best-badge">LEGJOBB BESZERZÉS</span>
              <span v-else-if="cheapestExchange?.key === entry.key" class="exchange-badge">LEGOLCSÓBB VÁLTÁS</span>
            </header>

            <div v-if="entry.kind === 'market'" class="route-source route-source--market">
              <ShoppingCart :size="17" /><span>1 db a játékospiacról</span>
              <strong v-if="entry.unitCost !== null">{{ formatYang(entry.unitCost) }}</strong><strong v-else class="text-warning">Nincs piaci ár</strong>
            </div>

            <div v-else-if="entry.offer" class="route-recipe">
              <div v-for="price in itemPrices(entry.offer)" :key="`${price.price_vnum}-${price.amount}`" class="recipe-item">
                <ItemIcon :vnum="price.price_vnum" :size="34" />
                <div><strong>{{ itemName(dataStore.getItem(price.price_vnum)) }} ×{{ formatInteger(price.amount) }}</strong><small v-if="sourceFor(price.price_vnum)">{{ formatYang(sourceFor(price.price_vnum)!.unitCost) }} / db · {{ sourceFor(price.price_vnum)!.kind === 'market' ? 'piac' : sourceFor(price.price_vnum)!.npcName }}</small><small v-else class="text-warning">Hiányzó beszerzési ár</small></div>
              </div>
              <div v-if="fixedYang(entry.offer) > 0n" class="recipe-fixed"><span>+ Fix Yang</span><strong>{{ formatYang(fixedYang(entry.offer)) }}</strong></div>
              <div v-for="price in unsupportedPrices(entry.offer)" :key="`${price.price_type}-${price.amount}`" class="recipe-fixed recipe-fixed--warning"><span>+ Nem árazott valuta</span><strong>{{ formatInteger(price.amount) }} {{ priceTypeName(price.price_type) }}</strong></div>
              <ArrowRightLeft class="recipe-arrow" :size="18" />
              <div class="recipe-result"><ItemIcon :vnum="selectedGroup.vnum" :size="34" /><div><strong>{{ itemName(dataStore.getItem(selectedGroup.vnum)) }}</strong><small>×{{ entry.count }}</small></div></div>
            </div>

            <div v-if="entry.missing.length && entry.kind === 'shop'" class="missing-prices">
              <div class="missing-prices__label"><CircleAlert :size="16" /><span>Add meg a hiányzó alapanyagárakat:</span></div>
              <div v-for="vnum in entry.missing" :key="vnum" class="missing-price-row">
                <div class="item-identity"><ItemIcon :vnum="vnum" :size="32" /><strong>{{ itemName(dataStore.getItem(vnum)) }}</strong></div>
                <PriceInput compact label="Piaci ár" :model-value="userStore.priceFor(vnum).marketPrice" @update:model-value="userStore.updatePrice(vnum, $event)" />
              </div>
            </div>

            <footer class="route-metrics">
              <div><span>Költség / db</span><strong v-if="entry.unitCost !== null">{{ formatYang(entry.unitCost) }}</strong><strong v-else>—</strong></div>
              <div><span>Piaci ár / db</span><strong v-if="userStore.marketPrice(selectedGroup.vnum) !== null">{{ formatYang(userStore.marketPrice(selectedGroup.vnum)!) }}</strong><strong v-else>—</strong></div>
              <div :class="{ positive: entry.unitProfit !== null && entry.unitProfit >= 0n, negative: entry.unitProfit !== null && entry.unitProfit < 0n }"><span>Profit / db</span><strong v-if="entry.unitProfit !== null">{{ entry.unitProfit >= 0n ? '+' : '−' }}{{ formatYang(absolute(entry.unitProfit)) }}</strong><strong v-else>—</strong></div>
              <div :class="{ positive: entry.margin !== null && entry.margin >= 0, negative: entry.margin !== null && entry.margin < 0 }"><span>Árrés</span><strong>{{ formatPercent(entry.margin) }}</strong></div>
              <div v-if="entry.count > 1" class="batch-total"><TrendingUp :size="14" /><span>1 váltás: {{ entry.count }} db · költség {{ formatYang(entry.totalCost) }}<template v-if="entry.profit !== null"> · teljes {{ entry.profit >= 0n ? 'profit' : 'veszteség' }} {{ formatYang(absolute(entry.profit)) }}</template></span></div>
            </footer>
          </article>
        </section>
      </main>

      <section v-else class="empty-state"><ArrowRightLeft /><h2>Nincs találat</h2><p>Próbálj másik keresőkifejezést.</p></section>
    </div>
  </div>
</template>

<style scoped src="./CompareView.css"></style>
