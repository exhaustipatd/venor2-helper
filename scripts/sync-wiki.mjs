import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import {
  validateItems,
  validateShops,
  validateReferences,
  applyShopOverrides,
} from '../src/domain/catalog.mjs'
import { recoverDataset, replaceDataset } from './lib/dataset-transaction.mjs'

const base = (process.env.VENOR_WIKI_URL || 'https://wiki.venor2.hu').replace(/\/$/, '')
const dataDir = join(process.cwd(), 'public', 'data')
const lock = join(process.cwd(), '.venor-sync-lock')
const delay = Math.max(10_000, Number(process.env.VENOR_SYNC_DELAY_MS) || 10_000)
const dryRun = process.argv.includes('--dry-run')
const allowShrink = process.argv.includes('--allow-shrink')
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function fetchJson(path) {
  let error
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      console.log(`Adatlekérés: ${path}`)
      const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(30_000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (caught) {
      error = caught
      if (attempt < 3) await wait(delay * (attempt + 1))
    }
  }
  throw error
}
let locked = false
try {
  await mkdir(lock)
  locked = true
  await recoverDataset(dataDir)
  const items = validateItems(await fetchJson('/api/items?locale=hu'))
  await wait(delay)
  const shops = validateShops(await fetchJson('/api/shops?locale=hu'))
  const pets = items.filter((item) => item.type === 'ITEM_COSTUME' && item.sub_type === 'COSTUME_PET')
  if (!pets.length) throw new Error('Nincsenek kisállatok az új csomagban.')
  let previous
  try {
    previous = JSON.parse(await readFile(join(dataDir, 'meta.json'), 'utf8'))
  } catch {
    /* first sync */
  }
  const counts = { itemCount: items.length, petCount: pets.length, shopCount: shops.length }
  for (const [key, count] of Object.entries(counts)) {
    if (!allowShrink && previous?.[key] && count < previous[key] * 0.9)
      throw new Error(`${key}: több mint 10% csökkenés. Ellenőrzés után használd a --allow-shrink kapcsolót.`)
  }
  // Validate the effective catalog too: future wiki changes must not silently
  // collide with preserved manual overrides.
  const itemOverrides = validateItems(
    JSON.parse(await readFile(join(dataDir, 'item-overrides.json'), 'utf8')),
    true,
  )
  const shopOverrides = validateShops(
    JSON.parse(await readFile(join(dataDir, 'shop-overrides.json'), 'utf8')),
    true,
  )
  const effectiveItems = new Map([...items, ...itemOverrides].map((item) => [item.vnum, item]))
  const effectiveShops = validateShops(applyShopOverrides(shops, shopOverrides))
  const missing = validateReferences([...effectiveItems.values()], effectiveShops)
  if (missing.length)
    console.warn(`${missing.length} hivatkozott tárgy hiányzik a wikiből (VNUM helyettesítés).`)
  const meta = {
    source: `${base}/`,
    generatedAt: new Date().toISOString(),
    completeItems: true,
    completePets: true,
    ...counts,
  }
  console.log(JSON.stringify({ previous, next: meta, missingReferences: missing }, null, 2))
  if (!dryRun) await replaceDataset(dataDir, { 'items.json': items, 'shops.json': shops, 'meta.json': meta })
  console.log(
    dryRun
      ? 'Ellenőrzés kész; fájlok nem változtak.'
      : 'Adatcsomag publikálva. Kézi javítások és médiafájlok megőrizve.',
  )
} catch (error) {
  console.error(`Szinkronizálási hiba: ${error.message}`)
  console.error(
    locked
      ? 'A korábbi csomag megmaradt vagy visszaállítható. Újraindításkor automatikus helyreállítás fut.'
      : 'Másik szinkronizálás futhat. Összeomlás után, ha biztosan nem fut folyamat, töröld a .venor-sync-lock mappát.',
  )
  process.exitCode = 1
} finally {
  if (locked) await rm(lock, { recursive: true, force: true })
}
