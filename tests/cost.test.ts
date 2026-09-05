import { describe, expect, it } from 'vitest'
import type { ShopTab } from '@/types/domain'
import { calculateBestCosts, calculateOfferCost } from '@/utils/cost'

const shop: ShopTab = {
  vnum: 1,
  name: 'Tesztbolt',
  coin_type: 'Gold',
  npc_vnum: 10,
  npc_name: 'Teszt NPC',
  offers: [
    {
      order: 1,
      item_vnum: 200,
      count: 2,
      prices: [
        { price_type: 3, amount: 3, price_vnum: 100 },
        { price_type: 1, amount: 10, price_vnum: 0 },
      ],
    },
    { order: 2, item_vnum: 300, count: 1, prices: [{ price_type: 3, amount: 1, price_vnum: 301 }] },
    { order: 3, item_vnum: 301, count: 1, prices: [{ price_type: 3, amount: 1, price_vnum: 300 }] },
  ],
}

describe('legjobb beszerzési költség', () => {
  it('az olcsóbb NPC-útvonalat választja és darabszámra oszt', () => {
    const costs = calculateBestCosts([shop], (vnum) => ({ 100: 30n, 200: 100n })[vnum] ?? null)
    expect(costs.get(200)?.unitCost).toBe(50n)
    expect(costs.get(200)?.kind).toBe('shop')
  })

  it('egy konkrét váltást a legolcsóbb, akár láncolt alapanyagforrásokkal számol', () => {
    const nestedShop: ShopTab = {
      ...shop,
      offers: [
        { order: 1, item_vnum: 500, count: 2, prices: [{ price_type: 3, amount: 1, price_vnum: 100 }] },
        { order: 2, item_vnum: 600, count: 1, prices: [{ price_type: 3, amount: 3, price_vnum: 500 }] },
      ],
    }
    const costs = calculateBestCosts([nestedShop], (vnum) => (vnum === 100 ? 20n : null))
    const result = calculateOfferCost(nestedShop.offers[1]!, costs)

    expect(costs.get(500)?.unitCost).toBe(10n)
    expect(result.complete).toBe(true)
    expect(result.totalCost).toBe(30n)
    expect(result.unitCost).toBe(30n)
  })

  it('jelzi a hiányzó és a nem árazott valutákat', () => {
    const result = calculateOfferCost(
      {
        order: 4,
        item_vnum: 400,
        count: 1,
        prices: [
          { price_type: 3, amount: 2, price_vnum: 999 },
          { price_type: 100, amount: 5, price_vnum: 0 },
        ],
      },
      new Map(),
    )

    expect(result.complete).toBe(false)
    expect(result.missing).toEqual([999])
    expect(result.unsupportedPriceTypes).toEqual([100])
  })

  it('nem fut végtelen ciklusba', () => {
    const costs = calculateBestCosts([shop], () => null)
    expect(costs.has(300)).toBe(false)
    expect(costs.has(301)).toBe(false)
  })
})
