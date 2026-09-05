import type { UserPrice } from '@/types/domain'
import { normalizePrice, parsePrice } from '@/utils/format'

export const STORAGE_KEY = 'venor-helper:user-data:v3'
export const LEGACY_KEY = 'venor-helper:user-data:v2'
export type PersistedState = {
  version: 3
  prices: Record<string, UserPrice>
  ownedPets: number[]
  targetPets: number[]
}
export const emptyState = (): PersistedState => ({ version: 3, prices: {}, ownedPets: [], targetPets: [] })
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const validId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0
function ids(value: unknown): number[] {
  if (!Array.isArray(value) || !value.every(validId)) throw new Error('Hibás gyűjtemény a mentésben.')
  return [...new Set(value)]
}
export function migrateUserData(value: unknown): PersistedState {
  if (!record(value) || (value.version !== 2 && value.version !== 3) || !record(value.prices))
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
  return {
    version: 3,
    prices,
    ownedPets: ids(value.ownedPets),
    targetPets: value.version === 3 ? ids(value.targetPets) : [],
  }
}
function whole(value: unknown): bigint | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null
  return typeof value === 'string' && /^\d{1,100}$/.test(value) ? BigInt(value) : null
}
export type GameImport = { prices: Record<string, UserPrice>; skipped: number }
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
