import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useDataStore } from './data'
import { useUserStore } from './user'
import { calculateBestCosts, calculateOfferCost, offerKey, sourceForOffer } from '@/utils/cost'

/** Shared reactive indexes and calculation results used by every screen. */
export const useMarketStore = defineStore('market', () => {
  const data = useDataStore(),
    user = useUserStore()
  const activeShops = computed(() => data.shops.filter((shop) => user.isNpcEnabled(shop.npc_vnum)))
  const entries = computed(() =>
    activeShops.value.flatMap((shop) =>
      shop.offers.map((offer) => ({ shop, offer, key: offerKey(shop, offer) })),
    ),
  )
  const bestCosts = computed(() => calculateBestCosts(activeShops.value, user.marketPrice))
  const offers = computed(() =>
    entries.value.map((entry) => {
      const source = sourceForOffer(entry.shop, entry.offer, bestCosts.value)
      const estimate = calculateOfferCost(entry.offer, source?.ingredients ?? bestCosts.value)
      const cyclic = estimate.complete && !source
      const cost = cyclic ? { ...estimate, complete: false, unitCost: null } : estimate
      const price = user.marketPrice(entry.offer.item_vnum)
      return {
        ...entry,
        cost,
        source,
        cyclic,
        profit: price !== null && cost.unitCost !== null ? price - cost.unitCost : null,
      }
    }),
  )
  const byKey = computed(() => new Map(offers.value.map((entry) => [entry.key, entry])))
  const byItem = computed(() => {
    const index = new Map<number, typeof offers.value>()
    for (const entry of offers.value)
      index.set(entry.offer.item_vnum, [...(index.get(entry.offer.item_vnum) ?? []), entry])
    for (const list of index.values())
      list.sort((a, b) =>
        a.cost.unitCost === b.cost.unitCost
          ? a.key.localeCompare(b.key)
          : a.cost.unitCost === null
            ? 1
            : b.cost.unitCost === null
              ? -1
              : a.cost.unitCost < b.cost.unitCost
                ? -1
                : 1,
      )
    return index
  })
  const downstream = computed(() => {
    const index = new Map<number, typeof offers.value>()
    for (const entry of offers.value)
      for (const id of new Set(
        entry.offer.prices.filter((p) => p.price_type === 3).map((p) => p.price_vnum),
      )) {
        index.set(id, [...(index.get(id) ?? []), entry])
      }
    return index
  })
  const missingPriorities = computed(() => {
    const affected = new Map<number, Set<string>>()
    for (const entry of entries.value) {
      const ids = new Set<number>()
      function visit(id: number, visited = new Set<number>()) {
        if (visited.has(id)) return
        visited.add(id)
        if (user.marketPrice(id) === null) ids.add(id)
        for (const nested of byItem.value.get(id) ?? [])
          for (const p of nested.offer.prices) if (p.price_type === 3) visit(p.price_vnum, visited)
      }
      visit(entry.offer.item_vnum)
      for (const id of ids) {
        const keys = affected.get(id) ?? new Set()
        keys.add(entry.key)
        affected.set(id, keys)
      }
    }
    return [...affected]
      .map(([vnum, keys]) => ({ vnum, count: keys.size }))
      .sort((a, b) => b.count - a.count || a.vnum - b.vnum)
  })
  const opportunities = computed(() =>
    [...byItem.value.values()]
      .map((list) => list[0]!)
      .filter((entry) => entry.profit !== null && entry.profit > 0n)
      .sort((a, b) =>
        a.profit! === b.profit! ? a.key.localeCompare(b.key) : a.profit! > b.profit! ? -1 : 1,
      ),
  )
  return {
    activeShops,
    entries,
    bestCosts,
    offers,
    byKey,
    byItem,
    downstream,
    missingPriorities,
    opportunities,
  }
})
