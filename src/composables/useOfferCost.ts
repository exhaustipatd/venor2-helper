import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import type { ShopOffer } from '@/types/domain'
import type { CostSource } from '@/utils/cost'
import { useUserStore } from '@/stores/user'

export function useOfferCost(
  offer: MaybeRefOrGetter<ShopOffer>,
  bestCosts: MaybeRefOrGetter<ReadonlyMap<number, CostSource>>,
) {
  const userStore = useUserStore()

  return computed(() => {
    const current = toValue(offer)
    const availableCosts = toValue(bestCosts)
    const sources = new Map<number, CostSource>()
    let yang = 0n
    let gaya = 0n
    const missing: number[] = []
    const unsupported: number[] = []

    for (const price of current.prices) {
      if (price.price_type === 1) {
        yang += BigInt(price.amount)
      } else if (price.price_type === 100) {
        gaya += BigInt(price.amount)
      } else if (price.price_type === 3 && price.price_vnum) {
        const source = availableCosts.get(price.price_vnum)
        if (!source) missing.push(price.price_vnum)
        else {
          sources.set(price.price_vnum, source)
          yang += source.unitCost * BigInt(price.amount)
        }
      } else {
        unsupported.push(price.price_type)
      }
    }

    const resultMarketPrice = userStore.marketPrice(current.item_vnum)
    const revenue = resultMarketPrice === null ? null : resultMarketPrice * BigInt(current.count)
    const profit = revenue === null || missing.length || unsupported.length || gaya > 0n ? null : revenue - yang
    const count = BigInt(Math.max(current.count, 1))

    return {
      yang,
      gaya,
      missing,
      unsupported,
      sources,
      complete: missing.length === 0 && unsupported.length === 0,
      perItem: missing.length === 0 && unsupported.length === 0 && current.count > 0
        ? (yang + count - 1n) / count
        : null,
      revenue,
      profit,
    }
  })
}
