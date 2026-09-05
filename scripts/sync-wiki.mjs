import { mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const BASE_URL = (process.env.VENOR_WIKI_URL || 'https://wiki.venor2.hu').replace(/\/$/, '')
const DATA_DIR = join(process.cwd(), 'public', 'data')
const requestDelayMs = Number(process.env.VENOR_SYNC_DELAY_MS || 10_000)

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchWithRetry(url, attempts = 4) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
      return response
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        const delay = attempt * requestDelayMs
        console.warn(`  Sikertelen kérés (${attempt}/${attempts}), újrapróbálás ${delay / 1000} mp múlva…`)
        await wait(delay)
      }
    }
  }
  throw lastError
}

async function fetchJson(path) {
  const url = `${BASE_URL}${path}`
  console.log(`Adatlekérés: ${url}`)
  const response = await fetchWithRetry(url)
  const text = await response.text()
  if (/^\s*</.test(text)) throw new Error(`${path}: JSON helyett HTML érkezett (valószínűleg védelmi oldal).`)
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${path}: érvénytelen JSON válasz.`)
  }
}

async function atomicJson(path, value, compact = false) {
  const temporary = `${path}.tmp`
  await writeFile(temporary, JSON.stringify(value, null, compact ? 0 : 2), 'utf8')
  await unlink(path).catch(() => {})
  await rename(temporary, path)
}

await mkdir(DATA_DIR, { recursive: true })

try {
  const items = await fetchJson('/api/items?locale=hu')
  await wait(requestDelayMs)
  const shops = await fetchJson('/api/shops?locale=hu')

  if (!Array.isArray(items) || items.length === 0) throw new Error('A wiki nem adott vissza tárgyakat.')
  if (!Array.isArray(shops) || shops.length === 0) throw new Error('A wiki nem adott vissza boltokat.')

  const pets = items.filter((item) => item.type === 'ITEM_COSTUME' && item.sub_type === 'COSTUME_PET')
  if (pets.length === 0) throw new Error('A tárgyadatok között nem található COSTUME_PET kisállat.')

  await atomicJson(join(DATA_DIR, 'items.json'), items, true)
  await atomicJson(join(DATA_DIR, 'shops.json'), shops, true)
  await atomicJson(join(DATA_DIR, 'meta.json'), {
    source: `${BASE_URL}/`,
    generatedAt: new Date().toISOString(),
    completeItems: true,
    completePets: true,
    itemCount: items.length,
    petCount: pets.length,
    shopCount: shops.length,
  })

  const offerCount = shops.reduce((sum, shop) => sum + (shop.offers?.length ?? 0), 0)
  const npcCount = new Set(shops.map((shop) => shop.npc_vnum)).size
  console.log(`Kész: ${items.length} tárgy, ${pets.length} kisállat, ${npcCount} NPC, ${shops.length} boltfül, ${offerCount} ajánlat.`)
} catch (error) {
  console.error(`\nA szinkronizálás nem sikerült: ${error instanceof Error ? error.message : error}`)
  console.error('A meglévő adatfájlok változatlanok maradtak.')
  process.exitCode = 1
}
