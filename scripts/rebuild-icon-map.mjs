import { readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = process.cwd()
const DATA_DIR = join(ROOT, 'public', 'data')
const MEDIA_DIR = join(ROOT, 'public', 'media')
const ITEM_ICON_DIR = join(MEDIA_DIR, 'items')
const ICON_MAP_PATH = join(MEDIA_DIR, 'icon-map.json')

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function atomicJson(path, value) {
  const temporary = `${path}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await unlink(path).catch(() => {})
  await rename(temporary, path)
}

const [items, itemOverrides, shops, shopOverrides, manifest, existingMap, iconFiles] = await Promise.all([
  readJson(join(DATA_DIR, 'items.json')),
  readJson(join(DATA_DIR, 'item-overrides.json')).catch(() => []),
  readJson(join(DATA_DIR, 'shops.json')),
  readJson(join(DATA_DIR, 'shop-overrides.json')).catch(() => []),
  readJson(join(DATA_DIR, 'icon-manifest.json')),
  readJson(ICON_MAP_PATH).catch(() => ({})),
  readdir(ITEM_ICON_DIR),
])

const relevantVnums = new Set(
  [...items, ...itemOverrides]
    .filter((item) => item.type === 'ITEM_COSTUME' && item.sub_type === 'COSTUME_PET')
    .map((item) => String(item.vnum)),
)

for (const shop of [...shops, ...shopOverrides]) {
  for (const offer of shop.offers ?? []) {
    relevantVnums.add(String(offer.item_vnum))
    for (const price of offer.prices ?? []) {
      if (price.price_type === 3 && price.price_vnum) relevantVnums.add(String(price.price_vnum))
    }
  }
}

const availableFiles = new Set(iconFiles)
const localPathByHash = new Map()

for (const [vnum, localPath] of Object.entries(existingMap)) {
  const hash = manifest.items?.[vnum]
  const fileName = String(localPath).split('/').at(-1)
  if (hash && fileName && availableFiles.has(fileName) && !localPathByHash.has(hash)) {
    localPathByHash.set(hash, localPath)
  }
}

for (const fileName of availableFiles) {
  if (/^[a-f0-9]{16}\.png$/i.test(fileName)) {
    localPathByHash.set(fileName, `/media/items/${fileName}`)
  }
}

const nextMap = { ...existingMap }
const missing = []

for (const vnum of relevantVnums) {
  const hash = manifest.items?.[vnum]
  const localPath = hash && localPathByHash.get(hash)
  if (!localPath) {
    missing.push({ vnum, hash: hash ?? null })
    continue
  }
  nextMap[vnum] = localPath
}

if (missing.length) {
  console.error(`Hiányzó helyi ikon: ${missing.length}`)
  console.error(missing.slice(0, 20))
  process.exitCode = 1
} else {
  const sortedMap = Object.fromEntries(
    Object.entries(nextMap).sort(([left], [right]) => Number(left) - Number(right)),
  )
  await atomicJson(ICON_MAP_PATH, sortedMap)

  const relevantPaths = new Set([...relevantVnums].map((vnum) => sortedMap[vnum]))
  console.log(`Kész: ${relevantVnums.size} releváns VNUM, ${relevantPaths.size} egyedi helyi ikon.`)
}
