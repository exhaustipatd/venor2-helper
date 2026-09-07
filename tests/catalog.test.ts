import { describe, expect, it } from 'vitest'
import { applyShopOverrides, validateShops } from '../src/domain/catalog.mjs'
import baseShops from '../public/data/shops.json'
import shopOverrides from '../public/data/shop-overrides.json'

describe('event shop catalog', () => {
  it('preserves wind and summer alongside all lightning alternatives after an upstream sync', () => {
    const base = validateShops(baseShops)
    const overrides = validateShops(shopOverrides)
    const shops = validateShops(applyShopOverrides(base, overrides))
    const lightning = shops.find((shop) => shop.npc_vnum === 60035)!
    expect(lightning.vnum).toBe(618)
    expect(lightning.offers).toHaveLength(57)
    expect(lightning.offers.filter((offer) => offer.item_vnum === 230046)).toHaveLength(32)
    expect(shops.find((shop) => shop.npc_vnum === 60033)?.offers).toEqual(
      base.find((shop) => shop.npc_vnum === 60033)?.offers,
    )
    expect(shops.find((shop) => shop.npc_vnum === 60319)?.offers).toHaveLength(52)
    const synced = validateShops(applyShopOverrides([...base, lightning], overrides))
    expect(synced.sort((a, b) => a.vnum - b.vnum)).toEqual(shops.sort((a, b) => a.vnum - b.vnum))
  })

  it('rejects an override belonging to another NPC instead of mixing merchants', () => {
    const shop = validateShops(baseShops)[0]!
    expect(() => applyShopOverrides([shop], [{ ...shop, npc_vnum: 60035 }])).toThrow('eltérő NPC')
  })
})
