import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { UserPrice } from '@/types/domain'
import { normalizePrice, parsePrice } from '@/utils/format'

const STORAGE_KEY = 'venor-helper:user-data:v2'

type PersistedState = {
  version: 2
  prices: Record<string, UserPrice>
  ownedPets: number[]
}

type GamePriceEntry = {
  key?: unknown
  price?: unknown
  count?: unknown
}

export type GamePriceImportResult = {
  imported: number
  skipped: number
}

const emptyState = (): PersistedState => ({ version: 2, prices: {}, ownedPets: [] })

function sanitizePrices(value: unknown): Record<string, UserPrice> {
  if (!value || typeof value !== 'object') return {}
  const result: Record<string, UserPrice> = {}

  for (const [vnum, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== 'object') continue
    const saved = entry as Partial<UserPrice>
    if (typeof saved.marketPrice !== 'string') continue
    result[vnum] = {
      marketPrice: normalizePrice(saved.marketPrice),
      updatedAt: typeof saved.updatedAt === 'string' ? saved.updatedAt : '',
    }
  }

  return result
}

function initialState(): PersistedState {
  if (typeof window === 'undefined') return emptyState()
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as Partial<PersistedState>
    if (parsed.version !== 2 || !Array.isArray(parsed.ownedPets)) return emptyState()
    return {
      version: 2,
      prices: sanitizePrices(parsed.prices),
      ownedPets: parsed.ownedPets.filter(Number.isFinite),
    }
  } catch {
    return emptyState()
  }
}

function wholeBigInt(value: unknown): bigint | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value)
  return null
}

export const useUserStore = defineStore('user', () => {
  const initial = initialState()
  const prices = ref<Record<string, UserPrice>>(initial.prices)
  const ownedPets = ref(new Set(initial.ownedPets))

  const pricedItemCount = computed(() => Object.values(prices.value)
    .filter((price) => parsePrice(price.marketPrice) !== null).length)

  function priceFor(vnum: number): UserPrice {
    return prices.value[String(vnum)] ?? { marketPrice: '', updatedAt: '' }
  }

  function updatePrice(vnum: number, value: string) {
    prices.value[String(vnum)] = {
      marketPrice: normalizePrice(value),
      updatedAt: new Date().toISOString(),
    }
  }

  function marketPrice(vnum: number): bigint | null {
    return parsePrice(priceFor(vnum).marketPrice)
  }

  function isOwned(vnum: number) {
    return ownedPets.value.has(vnum)
  }

  function toggleOwned(vnum: number) {
    const next = new Set(ownedPets.value)
    next.has(vnum) ? next.delete(vnum) : next.add(vnum)
    ownedPets.value = next
  }

  function serialize(): PersistedState {
    return { version: 2, prices: prices.value, ownedPets: [...ownedPets.value] }
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `venor-helper-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importData(file: File) {
    const parsed = JSON.parse(await file.text()) as Partial<PersistedState>
    if (parsed.version !== 2 || !parsed.prices || !Array.isArray(parsed.ownedPets)) {
      throw new Error('Nem támogatott vagy sérült mentés.')
    }
    prices.value = sanitizePrices(parsed.prices)
    ownedPets.value = new Set(parsed.ownedPets.filter(Number.isFinite))
  }

  async function importGamePrices(file: File): Promise<GamePriceImportResult> {
    const parsed: unknown = JSON.parse(await file.text())
    if (!Array.isArray(parsed) || !parsed.length) {
      throw new Error('A játékbeli árlista üres vagy nem támogatott formátumú.')
    }

    const entries = parsed as GamePriceEntry[]
    if (entries.some((entry) => wholeBigInt(entry?.key) === null || wholeBigInt(entry.key)! <= 0n)) {
      throw new Error('A price_history_vnum.json fájlt válaszd ki, ne a hash változatot.')
    }

    const importedPrices: Record<string, UserPrice> = {}
    const importedAt = new Date().toISOString()
    let skipped = 0

    for (const entry of entries) {
      const vnumValue = wholeBigInt(entry.key)
      const price = wholeBigInt(entry.price)
      const count = wholeBigInt(entry.count)
      if (vnumValue === null || vnumValue > BigInt(Number.MAX_SAFE_INTEGER) || price === null || count === null || count <= 0n) {
        skipped++
        continue
      }

      const unitPrice = (price + count - 1n) / count
      importedPrices[String(Number(vnumValue))] = {
        marketPrice: unitPrice.toString(),
        updatedAt: importedAt,
      }
    }

    const imported = Object.keys(importedPrices).length
    if (!imported) throw new Error('Nem található importálható ár a fájlban.')
    prices.value = { ...prices.value, ...importedPrices }
    return { imported, skipped }
  }

  function clearAll() {
    prices.value = {}
    ownedPets.value = new Set()
  }

  watch([prices, ownedPets], () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize()))
  }, { deep: true })

  return {
    prices, ownedPets, pricedItemCount,
    priceFor, updatePrice, marketPrice,
    isOwned, toggleOwned, exportData, importData, importGamePrices, clearAll,
  }
})
