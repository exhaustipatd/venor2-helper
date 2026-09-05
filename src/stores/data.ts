import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Item, ShopTab, WikiMeta } from '@/types/domain'
import {
  applyShopOverrides,
  validateIcons,
  validateItems,
  validateMeta,
  validateReferences,
  validateShops,
} from '@/domain/catalog.mjs'

const publicPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
export const useDataStore = defineStore('data', () => {
  const items = ref<Item[]>([])
  const shops = ref<ShopTab[]>([])
  const meta = ref<WikiMeta>({
    source: 'https://wiki.venor2.hu/',
    generatedAt: '',
    completeItems: false,
    completePets: false,
  })
  const iconMap = ref<Record<string, string>>({})
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')
  const warnings = ref<string[]>([])
  const itemMap = computed(() => new Map(items.value.map((item) => [item.vnum, item])))
  const pets = computed(() =>
    items.value.filter((item) => item.type === 'ITEM_COSTUME' && item.sub_type === 'COSTUME_PET'),
  )
  const npcs = computed(() => {
    const grouped = new Map<number, { vnum: number; name: string; tabs: ShopTab[]; offerCount: number }>()
    for (const tab of shops.value) {
      const npc = grouped.get(tab.npc_vnum) ?? {
        vnum: tab.npc_vnum,
        name: tab.npc_name,
        tabs: [],
        offerCount: 0,
      }
      npc.tabs.push(tab)
      npc.offerCount += tab.offers.length
      grouped.set(tab.npc_vnum, npc)
    }
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'hu'))
  })
  const relevantItemIds = computed(
    () =>
      new Set([
        ...pets.value.map((pet) => pet.vnum),
        ...shops.value.flatMap((shop) =>
          shop.offers.flatMap((offer) => [
            offer.item_vnum,
            ...offer.prices.filter((p) => p.price_type === 3).map((p) => p.price_vnum),
          ]),
        ),
      ]),
  )
  function getItem(vnum: number): Item {
    return itemMap.value.get(vnum) ?? { vnum, name: `Tárgy #${vnum}` }
  }
  const relevantItems = computed(() =>
    [...relevantItemIds.value]
      .map(getItem)
      .sort((a, b) => (a.locale_name || a.name).localeCompare(b.locale_name || b.name, 'hu')),
  )
  function iconFor(vnum: number) {
    const path = iconMap.value[String(vnum)]
    return path ? publicPath(path) : undefined
  }
  async function load(force = false) {
    if (loading.value || (loaded.value && !force)) return
    loading.value = true
    error.value = ''
    try {
      async function json(path: string) {
        const response = await fetch(publicPath(path), {
          signal: AbortSignal.timeout(20_000),
          cache: 'no-cache',
        })
        if (!response.ok) throw new Error(`Nem tölthető be: ${path} (${response.status})`)
        return response.json() as Promise<unknown>
      }
      const [rawItems, rawItemOverrides, rawShops, rawShopOverrides, rawMeta] = await Promise.all([
        json('data/items.json'),
        json('data/item-overrides.json'),
        json('data/shops.json'),
        json('data/shop-overrides.json'),
        json('data/meta.json'),
      ])
      const nextItems = new Map(validateItems(rawItems).map((item) => [item.vnum, item]))
      for (const item of validateItems(rawItemOverrides, true)) nextItems.set(item.vnum, item)
      const nextShops = validateShops(
        applyShopOverrides(validateShops(rawShops), validateShops(rawShopOverrides, true)),
      )
      const nextMeta = validateMeta(rawMeta)
      const nextWarnings: string[] = []
      const missing = validateReferences([...nextItems.values()], nextShops)
      if (missing.length)
        nextWarnings.push(
          `${missing.length} tárgy neve hiányzik az adatcsomagból; VNUM alapján továbbra is használhatók.`,
        )
      let nextIcons: Record<string, string> = {}
      try {
        nextIcons = validateIcons(await json('media/icon-map.json'))
      } catch {
        nextWarnings.push(
          'Az ikonok nem tölthetők be. A számítások működnek; próbáld újratölteni az adatokat.',
        )
      }
      // Only publish a fully validated snapshot. A failed refresh keeps the last good data.
      items.value = [...nextItems.values()]
      shops.value = nextShops
      meta.value = nextMeta
      iconMap.value = nextIcons
      warnings.value = nextWarnings
      loaded.value = true
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Ismeretlen betöltési hiba.'
    } finally {
      loading.value = false
    }
  }
  return {
    items,
    shops,
    meta,
    iconMap,
    loading,
    loaded,
    error,
    warnings,
    itemMap,
    pets,
    npcs,
    relevantItemIds,
    relevantItems,
    getItem,
    iconFor,
    load,
  }
})
