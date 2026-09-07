import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { UserPrice } from '@/types/domain'
import { normalizePrice, parsePrice } from '@/utils/format'
import {
  emptyState,
  isNpcEnabled,
  readStoredUserData,
  migrateUserData,
  serializeGamePrices,
  STORAGE_KEY,
  type GameImport,
  type PersistedState,
} from '@/domain/userData'

export const useUserStore = defineStore('user', () => {
  const storageError = ref('')
  const savedAt = ref('')
  let blocked = false
  let initial = emptyState()
  try {
    const raw = readStoredUserData(localStorage)
    if (raw) initial = migrateUserData(JSON.parse(raw))
  } catch {
    blocked = true
    storageError.value =
      'A helyi mentés nem olvasható. Az eredeti adatokat nem írjuk felül. Tölts le mentést a böngészőből, vagy állíts vissza egy korábbi fájlt.'
  }
  const prices = ref(initial.prices)
  const ownedPets = ref(new Set(initial.ownedPets))
  const targetPets = ref(new Set(initial.targetPets))
  const npcEnabled = ref(initial.npcEnabled)
  function setNpcEnabled(vnum: number, enabled: boolean) {
    if (!Number.isSafeInteger(vnum) || vnum <= 0) return
    npcEnabled.value = { ...npcEnabled.value, [vnum]: enabled }
  }
  const pricedItemCount = computed(
    () => Object.values(prices.value).filter((price) => parsePrice(price.marketPrice) !== null).length,
  )
  function priceFor(vnum: number): UserPrice {
    return prices.value[String(vnum)] ?? { marketPrice: '', updatedAt: '' }
  }
  function marketPrice(vnum: number) {
    return parsePrice(priceFor(vnum).marketPrice)
  }
  function serialize(): PersistedState {
    return {
      version: 4,
      prices: prices.value,
      ownedPets: [...ownedPets.value],
      targetPets: [...targetPets.value],
      npcEnabled: { ...npcEnabled.value },
    }
  }
  function persist() {
    if (blocked) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize()))
      storageError.value = ''
      savedAt.value = new Date().toISOString()
    } catch {
      storageError.value =
        'Nem sikerült a helyi mentés. A módosítások csak ezen a megnyitott lapon élnek. Tölts le biztonsági mentést!'
    }
  }
  function updatePrice(vnum: number, value: string) {
    const normalized = normalizePrice(value)
    if (value.trim() && parsePrice(value) === null) return
    if (normalized === priceFor(vnum).marketPrice) return
    prices.value[String(vnum)] = {
      marketPrice: normalized,
      updatedAt: new Date().toISOString(),
      source: 'manual',
    }
  }
  function refreshPrice(vnum: number) {
    if (marketPrice(vnum) !== null)
      prices.value[String(vnum)] = { ...priceFor(vnum), updatedAt: new Date().toISOString() }
  }
  function toggleOwned(vnum: number) {
    const next = new Set(ownedPets.value)
    if (next.has(vnum)) next.delete(vnum)
    else next.add(vnum)
    ownedPets.value = next
  }
  function toggleTarget(vnum: number) {
    const next = new Set(targetPets.value)
    if (next.has(vnum)) next.delete(vnum)
    else next.add(vnum)
    targetPets.value = next
  }
  function download(text: string, name: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function exportData() {
    download(
      JSON.stringify(serialize(), null, 2),
      `venor-helper-${new Date().toISOString().slice(0, 10)}.json`,
    )
  }
  function exportGamePrices() {
    download(serializeGamePrices(prices.value), 'price_history_vnum.json')
  }
  function exportOriginal() {
    try {
      download(readStoredUserData(localStorage) ?? '{}', 'venor-helper-eredeti.json')
    } catch {
      storageError.value = 'A böngésző nem engedi a helyi tárhely olvasását.'
    }
  }
  function restore(state: PersistedState) {
    // Validation is repeated at the mutation boundary, not just in the preview UI.
    const validated = migrateUserData(state)
    blocked = false
    prices.value = validated.prices
    ownedPets.value = new Set(validated.ownedPets)
    targetPets.value = new Set(validated.targetPets)
    npcEnabled.value = validated.npcEnabled
    persist()
  }
  function applyGamePrices(data: GameImport) {
    prices.value = { ...prices.value, ...data.prices }
  }
  function clearAll() {
    restore(emptyState())
  }
  watch([prices, ownedPets, targetPets, npcEnabled], persist, { deep: true })
  return {
    prices,
    ownedPets,
    targetPets,
    npcEnabled,
    isNpcEnabled: (id: number) => isNpcEnabled(npcEnabled.value, id),
    setNpcEnabled,
    pricedItemCount,
    storageError,
    savedAt,
    priceFor,
    marketPrice,
    updatePrice,
    refreshPrice,
    isOwned: (id: number) => ownedPets.value.has(id),
    isTarget: (id: number) => targetPets.value.has(id),
    toggleOwned,
    toggleTarget,
    serialize,
    exportData,
    exportGamePrices,
    exportOriginal,
    restore,
    applyGamePrices,
    clearAll,
    persist,
  }
})
