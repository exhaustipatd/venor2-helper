import { describe, expect, it } from 'vitest'
import {
  emptyState,
  isNpcEnabled,
  migrateUserData,
  parseGamePrices,
  serializeGamePrices,
} from '@/domain/userData'
import type { UserPrice } from '@/types/domain'

const price = (marketPrice: string): UserPrice => ({ marketPrice, updatedAt: '2026-01-01T00:00:00.000Z' })

describe('NPC-beállítások és mentésmigráció', () => {
  it.each([2, 3])('a v%i mentés árai és gyűjteménye megmaradnak', (version) => {
    const migrated = migrateUserData({
      version,
      prices: { 42: price('500') },
      ownedPets: [100],
      targetPets: [200],
    })
    expect(migrated.version).toBe(4)
    expect(migrated.prices['42']?.marketPrice).toBe('500')
    expect(migrated.ownedPets).toEqual([100])
    expect(migrated.targetPets).toEqual(version === 2 ? [] : [200])
    expect(isNpcEnabled(migrated.npcEnabled, 60033)).toBe(false)
    expect(isNpcEnabled(migrated.npcEnabled, 60035)).toBe(true)
  })

  it('az egyéni kapcsolók felülírják az alapértékeket és visszaállíthatók', () => {
    const state = { ...emptyState(), npcEnabled: { 60033: true, 60035: false, 123: false } }
    const restored = migrateUserData(JSON.parse(JSON.stringify(state)))
    expect(restored).toEqual(state)
    expect(isNpcEnabled(restored.npcEnabled, 60033)).toBe(true)
    expect(isNpcEnabled(restored.npcEnabled, 60035)).toBe(false)
    expect(isNpcEnabled(restored.npcEnabled, 999)).toBe(true)
  })

  it.each([
    undefined,
    [],
    null,
    { 0: true },
    { '-1': false },
    { '01': true },
    { 60033: 'false' },
    { 60033: null },
    { '9007199254740992': true },
  ])('elutasítja a hibás v4 NPC-beállítást: %j', (npcEnabled) => {
    expect(() => migrateUserData({ ...emptyState(), npcEnabled })).toThrow('NPC')
  })
})

describe('játékbeli árlista export', () => {
  it('VNUM szerint rendezett, egydarabos játékbeli ársorokat készít', () => {
    const exported = serializeGamePrices({
      '200': price('2500'),
      '12': price('500'),
      '99': price(''),
    })

    expect(JSON.parse(exported)).toEqual([
      { key: 12, price: 500, count: 1 },
      { key: 200, price: 2500, count: 1 },
    ])
  })

  it('veszteség nélkül írja ki a JavaScript számtartományán túli árakat', () => {
    const exported = serializeGamePrices({ '42': price('99999999999999999999') })

    expect(exported).toContain('"price": 99999999999999999999')
  })

  it('visszaimportálva megtartja az egységárakat', () => {
    const exported = serializeGamePrices({ '12': price('500'), '200': price('2500') })
    const imported = parseGamePrices(JSON.parse(exported), '2026-02-01T00:00:00.000Z')

    expect(imported.prices['12']?.marketPrice).toBe('500')
    expect(imported.prices['200']?.marketPrice).toBe('2500')
    expect(imported.skipped).toBe(0)
  })
})
