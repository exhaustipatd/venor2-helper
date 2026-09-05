import type { ShopOffer, ShopTab } from '@/types/domain'

export type CostSource = {
  vnum?: number
  unitCost: bigint
  kind: 'market' | 'shop'
  npcName?: string
  shopName?: string
  shopVnum?: number
  offer?: ShopOffer
  ingredients?: ReadonlyMap<number, CostSource>
}
export type OfferCost = {
  totalCost: bigint
  unitCost: bigint | null
  missing: number[]
  unsupportedPriceTypes: number[]
  currencies: Map<number, bigint>
  complete: boolean
}
export const currencyName = (type: number) =>
  type === 1 ? 'Yang' : type === 100 ? 'Gaya' : `Valuta #${type}`
export const ceilDivide = (value: bigint, count: bigint) => (value + count - 1n) / count
export const ingredientPrices = (offer: ShopOffer) =>
  offer.prices.filter((p) => p.price_type === 3 && p.price_vnum > 0)
export const offerKey = (shop: ShopTab, offer: ShopOffer) => `${shop.vnum}-${offer.order}`

/** Unit estimates, not the cash required to buy indivisible NPC batches. */
export function calculateOfferCost(offer: ShopOffer, costs: ReadonlyMap<number, CostSource>): OfferCost {
  let totalCost = 0n
  const missing = new Set<number>()
  const currencies = new Map<number, bigint>()
  for (const price of offer.prices) {
    if (price.price_type === 1) totalCost += BigInt(price.amount)
    else if (price.price_type === 3 && price.price_vnum > 0) {
      const source = costs.get(price.price_vnum)
      if (source) totalCost += source.unitCost * BigInt(price.amount)
      else if (price.amount > 0) missing.add(price.price_vnum)
    } else if (price.amount > 0)
      currencies.set(price.price_type, (currencies.get(price.price_type) ?? 0n) + BigInt(price.amount))
  }
  const complete = missing.size === 0 && currencies.size === 0 && offer.count > 0
  return {
    totalCost,
    unitCost: complete ? ceilDivide(totalCost, BigInt(offer.count)) : null,
    missing: [...missing],
    unsupportedPriceTypes: [...currencies.keys()],
    currencies,
    complete,
  }
}

function contains(source: CostSource, vnum: number): boolean {
  return (
    source.vnum === vnum || [...(source.ingredients?.values() ?? [])].some((child) => contains(child, vnum))
  )
}

/** Deterministic relaxation with immutable, executable, cycle-free provenance.
 * Each pass only reads the previous pass, so shop ordering cannot poison a DFS cache.
 * Arbitrage loops are deliberately excluded; this is not an inventory trading simulator.
 */
export function calculateBestCosts(
  shops: ShopTab[],
  marketPrice: (vnum: number) => bigint | null,
): Map<number, CostSource> {
  const entries = shops
    .flatMap((shop) => shop.offers.map((offer) => ({ shop, offer })))
    .sort((a, b) => a.shop.vnum - b.shop.vnum || a.offer.order - b.offer.order)
  const ids = new Set(
    entries.flatMap(({ offer }) => [offer.item_vnum, ...ingredientPrices(offer).map((p) => p.price_vnum)]),
  )
  let costs = new Map<number, CostSource>()
  for (const vnum of ids) {
    const price = marketPrice(vnum)
    if (price !== null) costs.set(vnum, { vnum, unitCost: price, kind: 'market' })
  }
  for (let pass = 0; pass < ids.size; pass++) {
    const next = new Map(costs)
    let changed = false
    for (const { shop, offer } of entries) {
      const ingredients = new Map<number, CostSource>()
      let cyclic = false
      for (const p of ingredientPrices(offer)) {
        if (!p.amount) continue
        const source = costs.get(p.price_vnum)
        if (source) {
          if (contains(source, offer.item_vnum)) {
            cyclic = true
            break
          }
          ingredients.set(p.price_vnum, source)
        }
      }
      if (cyclic) continue
      const cost = calculateOfferCost(offer, costs)
      const previous = next.get(offer.item_vnum)
      if (cost.unitCost === null || (previous && previous.unitCost <= cost.unitCost)) continue
      next.set(offer.item_vnum, {
        vnum: offer.item_vnum,
        unitCost: cost.unitCost,
        kind: 'shop',
        npcName: shop.npc_name,
        shopName: shop.name,
        shopVnum: shop.vnum,
        offer,
        ingredients,
      })
      changed = true
    }
    costs = next
    if (!changed) break
  }
  return costs
}

export type AcquisitionPlan = {
  totalCost: bigint
  purchases: Map<number, { quantity: bigint; cost: bigint }>
  exchanges: Array<{ source: CostSource; batches: bigint }>
  leftovers: Map<number, bigint>
}

/** Exact batch spending for a chosen provenance tree, reusing leftover ingredients.
 * Does not search every combination of alternative recipes for a global bulk optimum.
 */
export function planAcquisition(vnum: number, quantity: bigint, source: CostSource): AcquisitionPlan {
  if (quantity <= 0n) throw new Error('A mennyiségnek pozitív egésznek kell lennie.')
  const plan: AcquisitionPlan = { totalCost: 0n, purchases: new Map(), exchanges: [], leftovers: new Map() }
  function acquire(id: number, requested: bigint, route: CostSource, path: Set<number>) {
    const stored = plan.leftovers.get(id) ?? 0n
    const used = stored < requested ? stored : requested
    plan.leftovers.set(id, stored - used)
    const needed = requested - used
    if (!needed) return
    if (path.has(id)) throw new Error('Körkörös beszerzési útvonal.')
    if (route.kind === 'market') {
      const cost = needed * route.unitCost
      const previous = plan.purchases.get(id) ?? { quantity: 0n, cost: 0n }
      plan.purchases.set(id, { quantity: previous.quantity + needed, cost: previous.cost + cost })
      plan.totalCost += cost
      return
    }
    const offer = route.offer
    if (!offer || offer.count <= 0) throw new Error('Hibás csereútvonal.')
    const batches = ceilDivide(needed, BigInt(offer.count))
    for (const price of offer.prices) {
      if (!price.amount) continue
      if (price.price_type === 1) plan.totalCost += BigInt(price.amount) * batches
      else if (price.price_type === 3) {
        const child = route.ingredients?.get(price.price_vnum)
        if (!child) throw new Error('Hiányzó alapanyagútvonal.')
        acquire(price.price_vnum, BigInt(price.amount) * batches, child, new Set(path).add(id))
      } else throw new Error('Nem árazott valuta.')
    }
    plan.exchanges.push({ source: route, batches })
    plan.leftovers.set(id, (plan.leftovers.get(id) ?? 0n) + batches * BigInt(offer.count) - needed)
  }
  acquire(vnum, quantity, source, new Set())
  plan.leftovers = new Map([...plan.leftovers].filter(([, count]) => count > 0n))
  return plan
}

export function sourceForOffer(
  shop: ShopTab,
  offer: ShopOffer,
  costs: ReadonlyMap<number, CostSource>,
): CostSource | null {
  // Preserve the validated provenance snapshot even if an ingredient's latest
  // cheapest route would lead back through this output item.
  const known = costs.get(offer.item_vnum)
  if (known?.kind === 'shop' && known.shopVnum === shop.vnum && known.offer?.order === offer.order)
    return known
  const cost = calculateOfferCost(offer, costs)
  if (cost.unitCost === null) return null
  const ingredients = new Map<number, CostSource>()
  for (const p of ingredientPrices(offer)) {
    if (!p.amount) continue
    const source = costs.get(p.price_vnum)
    if (!source || contains(source, offer.item_vnum)) return null
    ingredients.set(p.price_vnum, source)
  }
  return {
    vnum: offer.item_vnum,
    kind: 'shop',
    unitCost: cost.unitCost,
    npcName: shop.npc_name,
    shopName: shop.name,
    shopVnum: shop.vnum,
    offer,
    ingredients,
  }
}
