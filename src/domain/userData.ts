import type { UserPrice } from '@/types/domain'
import { normalizePrice, parsePrice } from '@/utils/format'

export const STORAGE_KEY = 'venor-helper:user-data:v4'
export const PREVIOUS_KEY = 'venor-helper:user-data:v3'
export const LEGACY_KEY = 'venor-helper:user-data:v2'
export type PersistedState = {
  version: 4
  prices: Record<string, UserPrice>
  ownedPets: number[]
  targetPets: number[]
  npcEnabled: Record<string, boolean>
}
export const emptyState = (): PersistedState => ({
  version: 4,
  prices: {},
  ownedPets: [],
  targetPets: [],
  npcEnabled: {},
})
export function isNpcEnabled(settings: Record<string, boolean>, vnum: number): boolean {
  return settings[String(vnum)] ?? vnum !== 60033
}
export function readStoredUserData(storage: Pick<Storage, 'getItem'>): string | null {
  return storage.getItem(STORAGE_KEY) ?? storage.getItem(PREVIOUS_KEY) ?? storage.getItem(LEGACY_KEY)
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const validId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0
function ids(value: unknown): number[] {
  if (!Array.isArray(value) || !value.every(validId)) throw new Error('Hibás gyűjtemény a mentésben.')
  return [...new Set(value)]
}
export function migrateUserData(value: unknown): PersistedState {
  if (
    !record(value) ||
    (value.version !== 2 && value.version !== 3 && value.version !== 4) ||
    !record(value.prices)
  )
    throw new Error('Nem támogatott vagy sérült mentés.')
  const prices: Record<string, UserPrice> = {}
  for (const [key, entry] of Object.entries(value.prices)) {
    if (
      !/^\d+$/.test(key) ||
      !validId(Number(key)) ||
      !record(entry) ||
      typeof entry.marketPrice !== 'string' ||
      (entry.marketPrice !== '' && parsePrice(entry.marketPrice) === null)
    )
      throw new Error(`Hibás ár a mentésben: #${key}`)
    prices[key] = {
      marketPrice: normalizePrice(entry.marketPrice),
      updatedAt:
        typeof entry.updatedAt === 'string' && Number.isFinite(Date.parse(entry.updatedAt))
          ? entry.updatedAt
          : '',
      source: entry.source === 'game' ? 'game' : 'manual',
    }
  }
  const npcEnabled: Record<string, boolean> = {}
  if (value.version === 4) {
    if (!record(value.npcEnabled)) throw new Error('Hibás NPC-beállítások a mentésben.')
    for (const [key, enabled] of Object.entries(value.npcEnabled)) {
      if (!/^[1-9]\d*$/.test(key) || !validId(Number(key)) || typeof enabled !== 'boolean')
        throw new Error('Hibás NPC-beállítások a mentésben.')
      npcEnabled[key] = enabled
    }
  }
  return {
    version: 4,
    prices,
    ownedPets: ids(value.ownedPets),
    targetPets: value.version === 2 ? [] : ids(value.targetPets),
    npcEnabled,
  }
}
function whole(value: unknown): bigint | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null
  return typeof value === 'string' && /^\d{1,100}$/.test(value) ? BigInt(value) : null
}
export type GameImport = { prices: Record<string, UserPrice>; skipped: number }

export function serializeGamePrices(prices: Record<string, UserPrice>): string {
  const entries = Object.entries(prices)
    .map(([key, entry]) => ({ id: Number(key), price: parsePrice(entry.marketPrice) }))
    .filter(
      (entry): entry is { id: number; price: bigint } =>
        Number.isSafeInteger(entry.id) && entry.id > 0 && entry.price !== null,
    )
    .sort((a, b) => a.id - b.id)

  if (!entries.length) return '[]\n'
  const rows = entries.map(
    ({ id, price }) => `  {\n    "key": ${id},\n    "price": ${price},\n    "count": 1\n  }`,
  )
  return `[\n${rows.join(',\n')}\n]\n`
}

export function parseGamePrices(value: unknown, now = new Date().toISOString()): GameImport {
  if (!Array.isArray(value) || !value.length) throw new Error('A játékbeli árlista üres vagy nem támogatott.')
  const prices: Record<string, UserPrice> = {}
  let skipped = 0
  for (const entry of value) {
    if (!record(entry)) {
      skipped++
      continue
    }
    const id = whole(entry.key),
      price = whole(entry.price),
      count = whole(entry.count)
    if (id === null || id <= 0n || id > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error('A price_history_vnum.json fájlt válaszd ki, ne a hash változatot.')
    if (price === null || count === null || count <= 0n) {
      skipped++
      continue
    }
    prices[id.toString()] = {
      marketPrice: ((price + count - 1n) / count).toString(),
      updatedAt: now,
      source: 'game',
    }
  }
  if (!Object.keys(prices).length) throw new Error('Nem található importálható ár a fájlban.')
  return { prices, skipped }
}
export async function readImportFile(file: File): Promise<unknown> {
  if (file.size > 5 * 1024 * 1024) throw new Error('A fájl legfeljebb 5 MB lehet.')
  try {
    return JSON.parse(await file.text())
  } catch {
    throw new Error('A fájl nem érvényes JSON.')
  }
}
export function isStale(price: UserPrice, now = Date.now()): boolean {
  return (
    !price.updatedAt ||
    !Number.isFinite(Date.parse(price.updatedAt)) ||
    now - Date.parse(price.updatedAt) > 7 * 86_400_000
  )
}
