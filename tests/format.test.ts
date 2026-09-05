import { describe, expect, it } from 'vitest'
import { normalizePrice, parsePrice } from '@/utils/format'

describe('árfeldolgozás', () => {
  it('egész számot és elválasztókat olvas', () => {
    expect(parsePrice('1 250 000')).toBe(1_250_000n)
  })

  it('érti a Metin2-es k rövidítéseket', () => {
    expect(parsePrice('5k')).toBe(5_000n)
    expect(parsePrice('500kk')).toBe(500_000_000n)
    expect(parsePrice('2kkk')).toBe(2_000_000_000n)
    expect(parsePrice('3kkkk')).toBe(3_000_000_000_000n)
    expect(parsePrice('3b')).toBe(3_000_000_000_000n)
  })

  it('magyar milliárdos rövidítést olvas', () => {
    expect(parsePrice('1,5mrd')).toBe(1_500_000_000n)
  })

  it('normalizálja a mentett értéket', () => {
    expect(normalizePrice('2m')).toBe('2000000')
  })

  it('üres értéket hiányzóként kezel', () => {
    expect(parsePrice('')).toBeNull()
  })
})
