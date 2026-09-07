import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia'
import { nextTick } from 'vue'
import { useDataStore } from '@/stores/data'
import { useMarketStore } from '@/stores/market'
import { useUserStore } from '@/stores/user'
import { emptyState, LEGACY_KEY, PREVIOUS_KEY, STORAGE_KEY } from '@/domain/userData'
import { planAcquisition } from '@/utils/cost'
import type { ShopOffer, ShopTab } from '@/types/domain'

const offer = (item: number, amount: number, ingredient?: number): ShopOffer => ({
  order: 1,
  item_vnum: item,
  count: 1,
  prices: [{ price_type: ingredient ? 3 : 1, amount, price_vnum: ingredient ?? 0 }],
})
const shop = (id: number, npc: number, recipe: ShopOffer): ShopTab => ({
  vnum: id,
  npc_vnum: npc,
  name: `Bolt ${id}`,
  npc_name: `NPC ${npc}`,
  coin_type: 'Gold',
  offers: [recipe],
})
let pinia: Pinia
let saved: Map<string, string>
beforeEach(() => {
  saved = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
  })
  pinia = createPinia()
  setActivePinia(pinia)
})
afterEach(() => {
  disposePinia(pinia)
  vi.unstubAllGlobals()
})

describe('NPC-kapcsolók a teljes beszerzési láncban', () => {
  it('minden boltfület kizár, alternatív láncot választ, majd visszakapcsolható', () => {
    const data = useDataStore(),
      user = useUserStore(),
      market = useMarketStore()
    data.shops = [
      shop(1, 60033, offer(100, 10)),
      shop(2, 60033, offer(101, 5)),
      shop(3, 60035, offer(100, 30)),
      shop(4, 200, offer(200, 2, 100)),
    ]
    user.updatePrice(200, '100')
    expect(data.npcs).toHaveLength(3)
    expect(market.entries).toHaveLength(2)
    expect(market.bestCosts.get(200)?.unitCost).toBe(60n)
    expect(market.byKey.has('1-1')).toBe(false)
    expect(market.byItem.get(200)?.[0]?.profit).toBe(40n)

    user.setNpcEnabled(60033, true)
    expect(market.entries).toHaveLength(4)
    expect(market.bestCosts.get(200)?.unitCost).toBe(20n)
    expect(
      planAcquisition(200, 3n, market.bestCosts.get(200)!).exchanges.map((e) => e.source.shopVnum),
    ).toEqual([1, 4])

    user.setNpcEnabled(60033, false)
    const plan = planAcquisition(200, 3n, market.bestCosts.get(200)!)
    expect(plan.totalCost).toBe(180n)
    expect(plan.exchanges.map((e) => e.source.shopVnum)).toEqual([3, 4])
    expect(market.bestCosts.has(101)).toBe(false)
    expect(market.byItem.get(100)?.map((e) => e.shop.vnum)).toEqual([3])
    expect(data.shops).toHaveLength(4)
  })

  it('hiányzó alapanyag esetén nem kínál hamis tervet, a piaci árat továbbra is használja', () => {
    const data = useDataStore(),
      user = useUserStore(),
      market = useMarketStore()
    data.shops = [shop(1, 60035, offer(100, 10)), shop(2, 200, offer(200, 2, 100))]
    user.setNpcEnabled(60035, false)
    expect(market.byItem.get(200)?.[0]?.source).toBeNull()
    expect(market.byItem.get(200)?.[0]?.cost.unitCost).toBeNull()
    expect(market.opportunities).toHaveLength(0)
    user.updatePrice(100, '25')
    expect(market.bestCosts.get(200)?.unitCost).toBe(50n)
    expect(planAcquisition(200, 2n, market.bestCosts.get(200)!).purchases.get(100)?.cost).toBe(100n)
    user.setNpcEnabled(200, false)
    expect(market.entries).toHaveLength(0)
    expect(market.byItem.size).toBe(0)
    expect(market.downstream.size).toBe(0)
    expect(market.missingPriorities).toEqual([])
    expect(user.marketPrice(100)).toBe(25n)
  })
})

describe('NPC-kapcsolók helyi mentése', () => {
  it('újratöltés és visszaállítás után is megőrzi a kapcsolókat', async () => {
    const user = useUserStore()
    user.updatePrice(42, '500')
    user.toggleOwned(100)
    user.toggleTarget(200)
    user.setNpcEnabled(60033, true)
    user.setNpcEnabled(60035, false)
    await nextTick()
    const backup = JSON.parse(saved.get(STORAGE_KEY)!)
    disposePinia(pinia)
    pinia = createPinia()
    setActivePinia(pinia)
    const reloaded = useUserStore()
    expect(reloaded.serialize()).toEqual(backup)
    reloaded.clearAll()
    expect(reloaded.isNpcEnabled(60033)).toBe(false)
    reloaded.restore(backup)
    expect(reloaded.serialize()).toEqual(backup)
    expect(reloaded.isNpcEnabled(60035)).toBe(false)
  })

  it.each([LEGACY_KEY, PREVIOUS_KEY])('a régi kulcsot megőrzi migráció után: %s', async (key) => {
    const legacy = JSON.stringify({
      version: key === LEGACY_KEY ? 2 : 3,
      prices: {},
      ownedPets: [100],
      targetPets: [200],
    })
    saved.set(key, legacy)
    const user = useUserStore()
    expect(user.isOwned(100)).toBe(true)
    user.setNpcEnabled(60033, true)
    await nextTick()
    expect(JSON.parse(saved.get(STORAGE_KEY)!).version).toBe(4)
    expect(saved.get(key)).toBe(legacy)
  })

  it('sérült v4 esetén nem használ régebbi mentést és nem írja felül az eredetit', async () => {
    saved.set(STORAGE_KEY, '{broken')
    saved.set(PREVIOUS_KEY, JSON.stringify({ ...emptyState(), version: 3, ownedPets: [100] }))
    const user = useUserStore()
    expect(user.storageError).not.toBe('')
    expect(user.isOwned(100)).toBe(false)
    user.setNpcEnabled(60033, true)
    await nextTick()
    expect(saved.get(STORAGE_KEY)).toBe('{broken')
  })
})
