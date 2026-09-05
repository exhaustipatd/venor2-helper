import { describe, expect, it } from 'vitest'
import type { ShopTab } from '@/types/domain'
import { calculateBestCosts, calculateOfferCost, planAcquisition, sourceForOffer } from '@/utils/cost'
const shop: ShopTab = {
  vnum: 1,
  npc_vnum: 10,
  npc_name: 'Kereskedő',
  name: 'Teszt',
  coin_type: 'Gold',
  offers: [
    { order: 1, item_vnum: 200, count: 2, prices: [{ price_type: 1, amount: 11, price_vnum: 0 }] },
    { order: 2, item_vnum: 300, count: 1, prices: [{ price_type: 3, amount: 3, price_vnum: 200 }] },
  ],
}
describe('batch-aware planning', () => {
  it('distinguishes a rounded unit estimate from actual whole-batch cash', () => {
    const costs = calculateBestCosts([shop], () => null)
    expect(costs.get(200)?.unitCost).toBe(6n)
    expect(costs.get(300)?.unitCost).toBe(18n)
    const plan = planAcquisition(300, 1n, costs.get(300)!)
    expect(plan.totalCost).toBe(22n)
    expect(plan.leftovers.get(200)).toBe(1n)
    expect(plan.exchanges.map((e) => e.batches)).toEqual([2n, 1n])
  })
  it('reuses leftovers across branches without counting them as revenue', () => {
    const branching: ShopTab = {
      ...shop,
      offers: [
        ...shop.offers,
        { order: 3, item_vnum: 400, count: 1, prices: [{ price_type: 3, amount: 1, price_vnum: 200 }] },
        {
          order: 4,
          item_vnum: 500,
          count: 1,
          prices: [
            { price_type: 3, amount: 1, price_vnum: 300 },
            { price_type: 3, amount: 1, price_vnum: 400 },
          ],
        },
      ],
    }
    const costs = calculateBestCosts([branching], () => null)
    const plan = planAcquisition(500, 1n, costs.get(500)!)
    expect(plan.totalCost).toBe(22n)
    expect(plan.leftovers.size).toBe(0)
  })
  it('preserves huge integer quantities exactly', () => {
    const plan = planAcquisition(1, 9007199254740993n, { vnum: 1, kind: 'market', unitCost: 11n })
    expect(plan.totalCost).toBe(99079191802150923n)
  })
  it('rejects invalid quantities and unsupported currencies', () => {
    expect(() => planAcquisition(1, 0n, { kind: 'market', unitCost: 1n })).toThrow()
    expect(
      calculateOfferCost(
        { ...shop.offers[0]!, prices: [{ price_type: 100, amount: 2, price_vnum: 0 }] },
        new Map(),
      ).complete,
    ).toBe(false)
    expect(
      calculateOfferCost(
        { ...shop.offers[0]!, prices: [{ price_type: 100, amount: 0, price_vnum: 0 }] },
        new Map(),
      ).unitCost,
    ).toBe(0n)
  })
})
describe('cycle-free provenance', () => {
  it('resolves a seeded cycle independent of shop ordering', () => {
    const cyclic: ShopTab = {
      ...shop,
      offers: [
        { order: 1, item_vnum: 10, count: 1, prices: [{ price_type: 3, amount: 1, price_vnum: 20 }] },
        { order: 2, item_vnum: 20, count: 1, prices: [{ price_type: 3, amount: 1, price_vnum: 10 }] },
        { order: 3, item_vnum: 10, count: 1, prices: [{ price_type: 1, amount: 5, price_vnum: 0 }] },
      ],
    }
    for (const offers of [cyclic.offers, [...cyclic.offers].reverse()]) {
      const costs = calculateBestCosts([{ ...cyclic, offers }], (id) => (id === 20 ? 100n : null))
      expect(costs.get(10)?.unitCost).toBe(5n)
      expect(costs.get(20)?.unitCost).toBe(5n)
      expect(planAcquisition(20, 1n, costs.get(20)!).totalCost).toBe(5n)
    }
  })
  it('does not produce a recursive trading loop', () => {
    const loop: ShopTab = {
      ...shop,
      offers: [{ order: 1, item_vnum: 10, count: 2, prices: [{ price_type: 3, amount: 1, price_vnum: 10 }] }],
    }
    const costs = calculateBestCosts([loop], () => 20n)
    expect(costs.get(10)?.unitCost).toBe(20n)
    expect(sourceForOffer(loop, loop.offers[0]!, costs)).toBeNull()
  })
})
