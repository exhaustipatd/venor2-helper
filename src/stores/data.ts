import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Item, ShopTab, WikiMeta } from '@/types/domain'

const emptyMeta: WikiMeta = {
  source: 'https://wiki.venor2.hu/',
  generatedAt: '',
  completeItems: false,
  completePets: false,
}

function publicPath(path: string): string {
  if (/^(?:[a-z]+:)?\/\//i.test(path)) return path
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}

function applyShopOverrides(shops: ShopTab[], overrides: ShopTab[]): ShopTab[] {
  const overridesByShop = new Map(overrides.map((shop) => [shop.vnum, shop]))
  const result = shops.map((shop) => {
    const override = overridesByShop.get(shop.vnum)
    if (!override) return shop
    overridesByShop.delete(shop.vnum)
    const replacedItems = new Set(override.offers.map((offer) => offer.item_vnum))
    return {
      ...shop,
      offers: [
        ...shop.offers.filter((offer) => !replacedItems.has(offer.item_vnum)),
        ...override.offers,
      ].sort((a, b) => a.order - b.order),
    }
  })
  return [...result, ...overridesByShop.values()]
}

export const useDataStore = defineStore('data', () => {
  const items = ref<Item[]>([])
  const shops = ref<ShopTab[]>([])
  const meta = ref<WikiMeta>(emptyMeta)
  const iconMap = ref<Record<string, string>>({})
  const loading = ref(false)
  const error = ref('')

  const itemMap = computed(() => new Map(items.value.map((item) => [item.vnum, item])))
  const pets = computed(() => items.value.filter(
    (item) => item.type === 'ITEM_COSTUME' && item.sub_type === 'COSTUME_PET',
  ))
  const npcs = computed(() => {
    const grouped = new Map<number, { vnum: number; name: string; tabs: ShopTab[]; offerCount: number }>()
    for (const tab of shops.value) {
      const current = grouped.get(tab.npc_vnum)
      if (current) {
        current.tabs.push(tab)
        current.offerCount += tab.offers.length
      } else {
        grouped.set(tab.npc_vnum, {
          vnum: tab.npc_vnum,
          name: tab.npc_name || `NPC #${tab.npc_vnum}`,
          tabs: [tab],
          offerCount: tab.offers.length,
        })
      }
    }
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'hu'))
  })
  const relevantItemIds = computed(() => {
    const ids = new Set<number>(pets.value.map((pet) => pet.vnum))
    for (const tab of shops.value) {
      for (const offer of tab.offers) {
        ids.add(offer.item_vnum)
        for (const price of offer.prices) {
          if (price.price_type === 3 && price.price_vnum) ids.add(price.price_vnum)
        }
      }
    }
    return ids
  })
  const relevantItems = computed(() => [...relevantItemIds.value]
    .map((vnum) => itemMap.value.get(vnum) ?? ({ vnum, name: `Tárgy #${vnum}` } as Item))
    .sort((a, b) => (a.locale_name || a.name).localeCompare(b.locale_name || b.name, 'hu')))

  function getItem(vnum: number): Item {
    return itemMap.value.get(vnum) ?? { vnum, name: `Tárgy #${vnum}` }
  }

  function iconFor(vnum: number): string | undefined {
    const path = iconMap.value[String(vnum)]
    return path ? publicPath(path) : undefined
  }

  async function load() {
    if (loading.value || items.value.length) return
    loading.value = true
    error.value = ''
    try {
      const [itemsResponse, itemOverridesResponse, shopsResponse, overridesResponse, metaResponse] = await Promise.all([
        fetch(publicPath('data/items.json')),
        fetch(publicPath('data/item-overrides.json')),
        fetch(publicPath('data/shops.json')),
        fetch(publicPath('data/shop-overrides.json')),
        fetch(publicPath('data/meta.json')),
      ])
      if (!itemsResponse.ok || !shopsResponse.ok || !metaResponse.ok) throw new Error('Az adatfájlok nem tölthetők be.')
      const loadedItems: Item[] = await itemsResponse.json()
      const itemOverrides: Item[] = itemOverridesResponse.ok ? await itemOverridesResponse.json() : []
      const itemsByVnum = new Map(loadedItems.map((item) => [item.vnum, item]))
      for (const item of itemOverrides) itemsByVnum.set(item.vnum, item)
      items.value = [...itemsByVnum.values()]
      const loadedShops: ShopTab[] = await shopsResponse.json()
      const overrides: ShopTab[] = overridesResponse.ok ? await overridesResponse.json() : []
      shops.value = applyShopOverrides(loadedShops, overrides)
      meta.value = await metaResponse.json()
      const iconResponse = await fetch(publicPath('media/icon-map.json'))
      if (iconResponse.ok) iconMap.value = await iconResponse.json()
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Ismeretlen betöltési hiba.'
    } finally {
      loading.value = false
    }
  }

  return {
    items, shops, meta, iconMap, loading, error,
    itemMap, pets, npcs, relevantItemIds, relevantItems,
    getItem, iconFor, load,
  }
})
