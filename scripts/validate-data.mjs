import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  validateItems,
  validateShops,
  validateMeta,
  validateIcons,
  validateReferences,
  applyShopOverrides,
} from '../src/domain/catalog.mjs'
const read = async (path) => JSON.parse(await readFile(join('public', path), 'utf8'))
const items = new Map(validateItems(await read('data/items.json')).map((item) => [item.vnum, item]))
for (const item of validateItems(await read('data/item-overrides.json'), true)) items.set(item.vnum, item)
const shops = validateShops(
  applyShopOverrides(
    validateShops(await read('data/shops.json')),
    validateShops(await read('data/shop-overrides.json'), true),
  ),
)
validateMeta(await read('data/meta.json'))
const icons = validateIcons(await read('media/icon-map.json'))
const missing = validateReferences([...items.values()], shops)
if (missing.length) throw new Error(`Hiányzó tárgyhivatkozások: ${missing.join(', ')}`)
const relevant = new Set(
  [...items.values()]
    .filter((item) => item.type === 'ITEM_COSTUME' && item.sub_type === 'COSTUME_PET')
    .map((item) => item.vnum),
)
for (const shop of shops)
  for (const offer of shop.offers) {
    relevant.add(offer.item_vnum)
    for (const price of offer.prices) if (price.price_type === 3) relevant.add(price.price_vnum)
  }
for (const id of relevant) {
  if (!icons[id]) throw new Error(`Hiányzó ikontérkép: ${id}`)
  await access(join('public', icons[id].replace(/^\/+/, '')))
}
console.log(
  `Érvényes csomag: ${items.size} tárgy, ${shops.length} boltfül, ${relevant.size} ellenőrzött ikonhivatkozás.`,
)
