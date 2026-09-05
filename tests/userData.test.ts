import { describe, expect, it } from 'vitest'
import { parseGamePrices, serializeGamePrices } from '@/domain/userData'
import type { UserPrice } from '@/types/domain'

const price = (marketPrice: string): UserPrice => ({ marketPrice, updatedAt: '2026-01-01T00:00:00.000Z' })

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
