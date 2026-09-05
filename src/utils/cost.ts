import type { ShopOffer, ShopTab } from '@/types/domain'

export type CostSource = {
  unitCost: bigint
  kind: 'market' | 'shop'
  npcName?: string
  shopName?: string
  offer?: ShopOffer
}

export type OfferCost = {
  totalCost: bigint
  unitCost: bigint | null
  missing: number[]
  unsupportedPriceTypes: number[]
  complete: boolean
}

/**
 * Egy konkrét csere költségét számolja ki a már feloldott, legolcsóbb
 * alapanyagárakból. Így a közvetett NPC-cserék is beleszámítanak.
 */
export function calculateOfferCost(
  offer: ShopOffer,
  bestCosts: ReadonlyMap<number, CostSource>,
): OfferCost {
  let totalCost = 0n
  const missing = new Set<number>()
  const unsupportedPriceTypes = new Set<number>()

  for (const price of offer.prices) {
    if (price.price_type === 1) {
      totalCost += BigInt(price.amount)
    } else if (price.price_type === 3 && price.price_vnum) {
      const source = bestCosts.get(price.price_vnum)
      if (source) totalCost += source.unitCost * BigInt(price.amount)
      else missing.add(price.price_vnum)
    } else {
      unsupportedPriceTypes.add(price.price_type)
    }
  }

  const complete = missing.size === 0 && unsupportedPriceTypes.size === 0 && offer.count > 0
  const count = BigInt(Math.max(offer.count, 1))

  return {
    totalCost,
    unitCost: complete ? (totalCost + count - 1n) / count : null,
    missing: [...missing],
    unsupportedPriceTypes: [...unsupportedPriceTypes],
    complete,
  }
}

export function calculateBestCosts(
  shops: ShopTab[],
  marketBuyPrice: (vnum: number) => bigint | null,
): Map<number, CostSource> {
  const offersByItem = new Map<number, Array<{ offer: ShopOffer; shop: ShopTab }>>()
  for (const shop of shops) {
    for (const offer of shop.offers) {
      const entries = offersByItem.get(offer.item_vnum) ?? []
      entries.push({ offer, shop })
      offersByItem.set(offer.item_vnum, entries)
    }
  }

  const memo = new Map<number, CostSource | null>()

  function resolve(vnum: number, visiting: Set<number>): CostSource | null {
    if (memo.has(vnum)) return memo.get(vnum) ?? null
    if (visiting.has(vnum)) return null

    const nextVisiting = new Set(visiting).add(vnum)
    const marketPrice = marketBuyPrice(vnum)
    let best: CostSource | null = marketPrice === null ? null : { unitCost: marketPrice, kind: 'market' }

    for (const entry of offersByItem.get(vnum) ?? []) {
      if (entry.offer.count <= 0) continue
      let total = 0n
      let usable = true

      for (const price of entry.offer.prices) {
        if (price.price_type === 1) {
          total += BigInt(price.amount)
        } else if (price.price_type === 3 && price.price_vnum) {
          const ingredient = resolve(price.price_vnum, nextVisiting)
          if (!ingredient) { usable = false; break }
          total += ingredient.unitCost * BigInt(price.amount)
        } else {
          // Gaya, TP és más valuták Yang-árfolyam nélkül nem hasonlíthatók össze.
          usable = false
          break
        }
      }

      if (!usable) continue
      const count = BigInt(entry.offer.count)
      const unitCost = (total + count - 1n) / count
      if (!best || unitCost < best.unitCost) {
        best = {
          unitCost,
          kind: 'shop',
          npcName: entry.shop.npc_name,
          shopName: entry.shop.name,
          offer: entry.offer,
        }
      }
    }

    memo.set(vnum, best)
    return best
  }

  const allIds = new Set<number>(offersByItem.keys())
  for (const shop of shops) {
    for (const offer of shop.offers) {
      for (const price of offer.prices) {
        if (price.price_type === 3 && price.price_vnum) allIds.add(price.price_vnum)
      }
    }
  }
  for (const vnum of allIds) resolve(vnum, new Set())

  return new Map([...memo].filter((entry): entry is [number, CostSource] => entry[1] !== null))
}
