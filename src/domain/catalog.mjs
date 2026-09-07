const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const integer = (value, min = 0) => Number.isSafeInteger(value) && value >= min
const fail = (message) => {
  throw new Error(`Hibás adatcsomag: ${message}`)
}
function unique(records, label, min = 1) {
  const ids = new Set()
  for (const record of records) {
    if (!object(record) || !integer(record.vnum, min) || ids.has(record.vnum))
      fail(`${label}: hibás vagy ismétlődő VNUM`)
    ids.add(record.vnum)
  }
}
export function validateItems(items, allowEmpty = false) {
  if (!Array.isArray(items) || (!allowEmpty && !items.length)) fail('üres tárgylista')
  unique(items, 'tárgyak')
  for (const item of items) {
    if (typeof item.name !== 'string' || !item.name.trim()) fail(`tárgynév #${item.vnum}`)
    for (let index = 0; index < 4; index++) {
      const value = item[`apply_value${index}`]
      if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value)))
        fail(`bónusz #${item.vnum}`)
    }
  }
  return items
}
export function validateShops(shops, allowEmpty = false) {
  if (!Array.isArray(shops) || (!allowEmpty && !shops.length)) fail('üres boltlista')
  unique(shops, 'boltok', -1) // The wiki uses -1 for the synthetic Gaya market.
  for (const shop of shops) {
    if (
      !integer(shop.npc_vnum, 1) ||
      typeof shop.name !== 'string' ||
      typeof shop.npc_name !== 'string' ||
      !Array.isArray(shop.offers)
    )
      fail(`bolt #${shop.vnum}`)
    const orders = new Set()
    for (const offer of shop.offers) {
      if (
        !object(offer) ||
        !integer(offer.order) ||
        orders.has(offer.order) ||
        !integer(offer.item_vnum, 1) ||
        !integer(offer.count, 1) ||
        !Array.isArray(offer.prices)
      )
        fail(`ajánlat #${shop.vnum}`)
      orders.add(offer.order)
      for (const price of offer.prices) {
        if (
          !object(price) ||
          !integer(price.price_type) ||
          !integer(price.amount) ||
          !integer(price.price_vnum) ||
          (price.price_type === 3 && !price.price_vnum)
        )
          fail(`ár #${shop.vnum}/${offer.order}`)
      }
    }
  }
  return shops
}
export function validateMeta(meta) {
  if (
    !object(meta) ||
    typeof meta.source !== 'string' ||
    !/^https?:\/\//.test(meta.source) ||
    typeof meta.generatedAt !== 'string' ||
    !Number.isFinite(Date.parse(meta.generatedAt)) ||
    typeof meta.completeItems !== 'boolean' ||
    typeof meta.completePets !== 'boolean'
  )
    fail('metaadatok')
  return meta
}
export function validateIcons(icons) {
  if (!object(icons)) fail('ikontérkép')
  for (const [id, path] of Object.entries(icons)) {
    if (!/^\d+$/.test(id) || typeof path !== 'string' || !/^\/?media\/items\/[a-zA-Z0-9_-]+\.png$/.test(path))
      fail(`ikon #${id}`)
  }
  return icons
}
export function applyShopOverrides(shops, overrides) {
  const remaining = new Map(overrides.map((shop) => [shop.vnum, shop]))
  const result = shops.map((shop) => {
    const override = remaining.get(shop.vnum)
    if (!override) return shop
    if (override.npc_vnum !== shop.npc_vnum) fail(`eltérő NPC a bolt felülírásában #${shop.vnum}`)
    remaining.delete(shop.vnum)
    const replaced = new Set(override.offers.map((offer) => offer.item_vnum))
    return {
      ...shop,
      offers: [...shop.offers.filter((offer) => !replaced.has(offer.item_vnum)), ...override.offers].sort(
        (a, b) => a.order - b.order,
      ),
    }
  })
  return [...result, ...remaining.values()]
}
export function validateReferences(items, shops) {
  const ids = new Set(items.map((item) => item.vnum))
  const missing = new Set()
  for (const shop of shops)
    for (const offer of shop.offers) {
      if (!ids.has(offer.item_vnum)) missing.add(offer.item_vnum)
      for (const price of offer.prices)
        if (price.price_type === 3 && !ids.has(price.price_vnum)) missing.add(price.price_vnum)
    }
  return [...missing]
}
