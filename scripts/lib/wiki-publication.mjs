import { readFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { Buffer } from 'node:buffer'
import { validateIcons, applyShopOverrides } from '../../src/domain/catalog.mjs'

export async function readPrevious(publicDir) {
  const read = async (name) => JSON.parse(await readFile(join(publicDir, name), 'utf8'))
  return {
    items: await read('data/items.json'),
    itemOverrides: await read('data/item-overrides.json'),
    shops: await read('data/shops.json'),
    shopOverrides: await read('data/shop-overrides.json'),
    meta: await read('data/meta.json'),
    iconMap: validateIcons(await read('media/icon-map.json')),
    manifest: await read('data/icon-manifest.json'),
  }
}
export async function preparePublication(candidate, previous, publicDir, images = {}) {
  const files = {
    'data/items.json': candidate.items,
    'data/shops.json': candidate.shops,
    'data/item-overrides.json': candidate.itemOverrides,
    'data/shop-overrides.json': candidate.shopOverrides,
    'data/meta.json': candidate.meta,
  }
  const iconMap = { ...previous.iconMap }
  const manifest = { ...previous.manifest, items: { ...previous.manifest.items } }
  const pathsByFilename = new Map()
  for (const [id, path] of Object.entries(previous.iconMap)) {
    const filename = previous.manifest.items?.[id]
    if (filename) pathsByFilename.set(filename, path)
  }
  for (const [id, filename] of Object.entries(candidate.icons)) {
    const target = `media/items/${filename}`
    if (!files[target]) {
      let body
      if (Object.hasOwn(images, filename)) {
        const encoded = images[filename]
        if (
          typeof encoded !== 'string' ||
          encoded.length > 2000000 ||
          !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(encoded)
        )
          throw new Error(`Invalid exported PNG: ${filename}`)
        body = Buffer.from(encoded.slice('data:image/png;base64,'.length), 'base64')
      }
      for (const path of [
        join(publicDir, target),
        ...(pathsByFilename.has(filename)
          ? [join(publicDir, pathsByFilename.get(filename).replace(/^\/+/, ''))]
          : []),
      ]) {
        if (body) break
        try {
          body = await readFile(path)
          break
        } catch (error) {
          if (error.code !== 'ENOENT') throw error
        }
      }
      if (
        !body ||
        body.length < 24 ||
        !body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        throw new Error(
          `Missing/invalid browser-loaded PNG: item ${id}, ${filename}. Existing catalog is unchanged.`,
        )
      files[target] = body
    }
    iconMap[id] = `/${target}`
    manifest.items[id] = filename
  }
  validateIcons(iconMap)
  const relevant = new Set(
    candidate.items
      .filter((i) => i.type === 'ITEM_COSTUME' && i.sub_type === 'COSTUME_PET')
      .map((i) => i.vnum),
  )
  for (const shop of applyShopOverrides(candidate.shops, candidate.shopOverrides))
    for (const offer of shop.offers) {
      relevant.add(offer.item_vnum)
      for (const price of offer.prices) if (price.price_type === 3) relevant.add(price.price_vnum)
    }
  for (const id of relevant) {
    const path = iconMap[id]?.replace(/^\/+/, '')
    if (!path) throw new Error(`Missing icon mapping: ${id}`)
    if (!files[path]) await access(join(publicDir, path))
  }
  files['media/icon-map.json'] = iconMap
  files['data/icon-manifest.json'] = manifest
  return files
}
