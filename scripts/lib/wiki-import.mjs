import {
  validateItems,
  validateShops,
  validateReferences,
  applyShopOverrides,
  validateMeta,
} from '../../src/domain/catalog.mjs'
import { WIKI, PETS } from './wiki-export.mjs'

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const integer = (n, min = 0) => Number.isSafeInteger(n) && n >= min
const text = (s) => typeof s === 'string' && s.trim().length > 0
export function wikiId(url, kind = 'items') {
  assert(typeof url === 'string', `Missing ${kind} URL`)
  const match = new RegExp(`^https://wiki\\.venor2\\.hu/${kind}/(\\d+)$`).exec(url)
  assert(match && integer(Number(match[1]), 1), `Invalid ${kind} URL: ${url}`)
  return Number(match[1])
}
export function wikiAmount(raw) {
  assert(typeof raw === 'string', 'Missing amount')
  const digits = raw.trim().replace(/\s/g, '')
  assert(/^\d+$/.test(digits) && integer(Number(digits)), `Invalid integer amount: ${raw}`)
  return Number(digits)
}
export function iconFilename(url) {
  const match =
    typeof url === 'string' && /^https:\/\/wiki\.venor2\.hu\/assets\/icons\/([a-f0-9]{16}\.png)$/.exec(url)
  assert(match, `Missing or unsupported item icon: ${url}`)
  return match[1]
}

const bonusTypes = {
  'Szörnyek elleni erő': 'APPLY_ATTBONUS_MONSTER',
  'Kövek elleni erő': 'APPLY_ATTBONUS_STONE',
  'Főszörnyek elleni erő': 'APPLY_ATTBONUS_BOSS',
  'Yohara kövek elleni erő': 'APPLY_ATTBONUS_SUNGMA_STONE',
  'Yohara főszörnyek elleni erő': 'APPLY_ATTBONUS_SUNGMA_BOSS',
  'Zodiákus szörnyek elleni erő': 'APPLY_ATTBONUS_ZODIAC',
  'Ördögök elleni erő': 'APPLY_ATTBONUS_DEVIL',
  'Dupla tárgy dobás esélye': 'APPLY_DOUBLE_DROP',
  'Átlagos károk': 'APPLY_NORMAL_HIT_DAMAGE_BONUS',
  'Átlagos kár védelem': 'APPLY_NORMAL_HIT_DEFEND_BONUS',
  'Készség károk': 'APPLY_SKILL_DAMAGE_BONUS',
  'Mágikus/közelharci támadás': 'APPLY_MELEE_MAGIC_ATTBONUS_PER',
  Varázssebesség: 'APPLY_CAST_SPEED',
  'Esély kritikus találatra': 'APPLY_CRITICAL_PCT',
  'Sötétség ereje': 'APPLY_ENCHANT_DARK',
  'Tűz ereje': 'APPLY_ENCHANT_FIRE',
  'Jég ereje': 'APPLY_ENCHANT_ICE',
  'Föld ereje': 'APPLY_ENCHANT_EARTH',
  'Szél ereje': 'APPLY_ENCHANT_WIND',
  'Villám ereje': 'APPLY_ENCHANT_ELECT',
  'Sungma Erő': 'APPLY_SUNGMA_STR',
  'Sungma VIT': 'APPLY_SUNGMA_HP',
  Erő: 'APPLY_STR',
  Ügyesség: 'APPLY_DEX',
  Intelligencia: 'APPLY_INT',
  Életerő: 'APPLY_CON',
}
const flatTypes = new Set([
  'APPLY_SUNGMA_STR',
  'APPLY_SUNGMA_HP',
  'APPLY_STR',
  'APPLY_DEX',
  'APPLY_INT',
  'APPLY_CON',
])
export function petBonuses(bonuses) {
  assert(
    Array.isArray(bonuses) && bonuses.length > 0 && bonuses.length <= 4,
    'Incomplete or unsupported pet bonuses',
  )
  const result = {}
  const seen = new Set()
  bonuses.forEach((bonus, index) => {
    const match = typeof bonus?.value === 'string' && /^\+?(\d+)(%)?$/.exec(bonus.value)
    assert(match, `Invalid pet bonus value: ${bonus?.value}`)
    const percent = Boolean(match[2])
    const type =
      bonus.label === 'Max. TP' ? (percent ? 'APPLY_MAX_HP_PCT' : 'APPLY_MAX_HP') : bonusTypes[bonus.label]
    assert(
      type && (bonus.label === 'Max. TP' || percent !== flatTypes.has(type)),
      `Unknown bonus or unit: ${bonus.label} ${bonus.value}`,
    )
    assert(!seen.has(type), `Repeated bonus: ${type}`)
    seen.add(type)
    result[`apply_type${index}`] = type
    result[`apply_value${index}`] = wikiAmount(match[1])
  })
  return result
}

export function normalizeBrowserOffer(offer, position) {
  assert(
    offer?.position === position && text(offer.name) && text(offer.text),
    'Invalid offer position or missing tooltip evidence',
  )
  const title = typeof offer.title === 'string' && /^(.*) × (\d[\d\s]*)$/.exec(offer.title)
  assert(title && title[1] === offer.name, `Incorrect tooltip for ${offer.name}`)
  const count = wikiAmount(title[2])
  assert(
    count > 0 && Array.isArray(offer.costs) && offer.costs.length > 0,
    'Missing output quantity or costs',
  )
  const prices = offer.costs.map((cost) => {
    assert(text(cost?.name), 'Missing cost label')
    if (cost.url) {
      const amount = /^×\s*(\d[\d\s]*)$/.exec(cost.amount ?? '')
      assert(amount, `Invalid ingredient amount: ${cost.amount}`)
      return { price_type: 3, price_vnum: wikiId(cost.url), amount: wikiAmount(amount[1]) }
    }
    const currency = cost.name.toLocaleLowerCase('hu')
    const type = currency === 'arany' || currency === 'yang' ? 1 : currency === 'gaya' ? 100 : undefined
    const amount = /^(\d[\d\s]*)(?:\s+(arany|yang|gaya))?$/i.exec(cost.amount ?? '')
    assert(type && amount, `Unsupported currency or amount: ${cost.name} ${cost.amount}`)
    if (amount[2])
      assert((amount[2].toLowerCase() === 'gaya') === (type === 100), 'Currency label/unit mismatch')
    return { price_type: type, price_vnum: 0, amount: wikiAmount(amount[1]) }
  })
  return { order: position, item_vnum: wikiId(offer.url), count, prices }
}

/** Full wiki coverage is required before any files can be published. */
export function buildWikiImport(snapshot, previous, { allowShrink = false } = {}) {
  assert(
    snapshot?.version === 1 && snapshot.method === 'browser-extension-dom' && snapshot.complete === true,
    'Capture is incomplete',
  )
  assert(Number.isFinite(Date.parse(snapshot.completedAt)), 'Missing capture completion time')
  assert(Array.isArray(snapshot.directory) && snapshot.directory.length > 0, 'Missing NPC directory')
  assert(
    snapshot.pets?.source === PETS &&
      Array.isArray(snapshot.pets.records) &&
      snapshot.pets.records.length > 0 &&
      snapshot.pets.expectedCount === snapshot.pets.records.length,
    'Incomplete pet listing',
  )
  const oldItems = [
    ...new Map(
      [...validateItems(previous.items), ...validateItems(previous.itemOverrides, true)].map((i) => [
        i.vnum,
        i,
      ]),
    ).values(),
  ]
  const oldShops = validateShops(
    applyShopOverrides(validateShops(previous.shops), validateShops(previous.shopOverrides, true)),
  )
  const oldPets = oldItems.filter((i) => i.type === 'ITEM_COSTUME' && i.sub_type === 'COSTUME_PET')
  const items = new Map(oldItems.map((item) => [item.vnum, { ...item }]))
  const observedItems = new Set()
  const icons = {}
  const observeItem = (record) => {
    const id = wikiId(record.url)
    assert(text(record.name), `Missing item name: ${id}`)
    const filename = iconFilename(record.icon)
    assert(!icons[id] || icons[id] === filename, `Icon changed during capture: ${id}`)
    icons[id] = filename
    observedItems.add(id)
    items.set(id, {
      ...items.get(id),
      vnum: id,
      name: items.get(id)?.name || record.name,
      locale_name: record.name,
    })
    return id
  }
  const petIds = new Set()
  for (const record of snapshot.pets.records) {
    const id = observeItem(record)
    assert(!petIds.has(id), `Duplicate pet: ${id}`)
    petIds.add(id)
    const item = items.get(id)
    for (let i = 0; i < 4; i++) {
      delete item[`apply_type${i}`]
      delete item[`apply_value${i}`]
    }
    Object.assign(item, { type: 'ITEM_COSTUME', sub_type: 'COSTUME_PET' }, petBonuses(record.bonuses))
  }
  // Keep referenced item identities, but do not keep removed pets in the pet collection.
  for (const pet of oldPets)
    if (!petIds.has(pet.vnum)) {
      delete items.get(pet.vnum).type
      delete items.get(pet.vnum).sub_type
      observedItems.add(pet.vnum)
    }
  const npcIds = new Set()
  const usedShopIds = new Set(oldShops.map((shop) => shop.vnum))
  const shops = snapshot.directory.map((npc) => {
    const id = wikiId(npc.url, 'npc-shops')
    assert(!npcIds.has(id) && text(npc.name) && integer(npc.count), 'Invalid or repeated NPC')
    npcIds.add(id)
    const capture = snapshot.shops?.[id]
    assert(
      capture?.complete === true &&
        capture.npc_vnum === id &&
        capture.npc_name === npc.name &&
        capture.source === npc.url &&
        capture.expectedOfferCount === npc.count &&
        capture.offers?.length === npc.count,
      `Incomplete shop: ${npc.name}`,
    )
    // The UI aggregates tabs. Publish one local shop per NPC, retaining an existing
    // positive ID where possible; these are local identities, not inferred wiki IDs.
    const old = oldShops.filter((s) => s.npc_vnum === id).sort((a, b) => a.vnum - b.vnum)[0]
    const vnum = old?.vnum ?? 1000000 + id
    assert(old || !usedShopIds.has(vnum), `Local shop ID collision: ${vnum}`)
    usedShopIds.add(vnum)
    return {
      vnum,
      name: old?.name || npc.name,
      coin_type: old?.coin_type || 'Mixed',
      npc_vnum: id,
      npc_name: npc.name,
      offers: capture.offers.map((offer, position) => {
        observeItem(offer)
        for (const cost of offer.costs ?? []) if (cost.url) observeItem(cost)
        return normalizeBrowserOffer(offer, position)
      }),
    }
  })
  assert(
    Object.keys(snapshot.shops ?? {}).length === npcIds.size,
    'Unexpected shops outside the captured directory',
  )
  const offerCount = shops.reduce((n, shop) => n + shop.offers.length, 0)
  const shrink = (label, next, old) =>
    assert(
      allowShrink || !old || next >= old * 0.9,
      `${label} shrank by more than 10%; inspect the checkpoint and use --allow-shrink if intended`,
    )
  shrink('NPC count', npcIds.size, new Set(oldShops.map((s) => s.npc_vnum)).size)
  shrink(
    'Offer count',
    offerCount,
    oldShops.reduce((n, s) => n + s.offers.length, 0),
  )
  shrink('Pet count', petIds.size, oldPets.length)
  // Absorb overridden fields into the new base for refreshed records so stale
  // overrides cannot mask wiki changes. Preserve overrides outside this scope.
  const itemOverrides = previous.itemOverrides.filter((i) => !observedItems.has(i.vnum))
  const shopOverrides = previous.shopOverrides.filter((s) => !npcIds.has(s.npc_vnum))
  const effectiveShops = validateShops(applyShopOverrides(validateShops(shops), shopOverrides))
  const nextItems = validateItems([...items.values()].sort((a, b) => a.vnum - b.vnum))
  const missing = validateReferences(nextItems, effectiveShops)
  assert(!missing.length, `Missing item references: ${missing.join(', ')}`)
  const meta = validateMeta({
    ...previous.meta,
    source: `${WIKI}/`,
    generatedAt: snapshot.completedAt,
    completePets: true,
    completeShops: true,
    itemsGeneratedAt: previous.meta.itemsGeneratedAt || previous.meta.generatedAt,
    shopsGeneratedAt: snapshot.completedAt,
    petsGeneratedAt: snapshot.pets.capturedAt,
    itemCount: nextItems.length,
    petCount: petIds.size,
    shopCount: effectiveShops.length,
    wikiNpcCount: npcIds.size,
    wikiOfferCount: offerCount,
    syncMethod: snapshot.method,
  })
  return {
    items: nextItems,
    shops,
    itemOverrides,
    shopOverrides,
    icons,
    meta,
    report: {
      npcCount: npcIds.size,
      offerCount,
      petCount: petIds.size,
      newItems: nextItems.filter((i) => !oldItems.some((old) => old.vnum === i.vnum)).map((i) => i.vnum),
      removedPets: oldPets.filter((i) => !petIds.has(i.vnum)).map((i) => i.vnum),
      absorbedItemOverrides: previous.itemOverrides.length - itemOverrides.length,
      absorbedShopOverrides: previous.shopOverrides.length - shopOverrides.length,
    },
  }
}
