import { describe, expect, it } from 'vitest'
import { normalizeSearchText } from '@/utils/search'

describe('keresési szöveg normalizálása', () => {
  it('nem érzékeny a kis- és nagybetűkre', () => {
    expect(normalizeSearchText('SzÉl KrIsTáLy')).toBe('szel kristaly')
  })

  it('a magyar ékezetes és ékezet nélküli betűket azonosan kezeli', () => {
    expect(normalizeSearchText('Árvíztűrő tükörfúrógép')).toBe('arvizturo tukorfurogep')
  })

  it('egységesíti a felesleges szóközöket', () => {
    expect(normalizeSearchText('  szél   kristály  ')).toBe('szel kristaly')
  })
})
