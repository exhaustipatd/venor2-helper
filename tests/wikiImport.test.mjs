import { describe, it, expect } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm, rename, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Buffer } from 'node:buffer'
import {
  buildWikiImport,
  normalizeBrowserOffer,
  petBonuses,
  wikiAmount,
} from '../scripts/lib/wiki-import.mjs'
import { readCachedExport, saveJson } from '../scripts/lib/wiki-export.mjs'
import { replaceDataset, recoverDataset } from '../scripts/lib/dataset-transaction.mjs'

const icon = 'https://wiki.venor2.hu/assets/icons/1111111111111111.png'
const itemUrl = (id) => `https://wiki.venor2.hu/items/${id}`
const offer = (position = 0, amount = '500 000 000 arany') => ({
  position,
  url: itemUrl(100),
  name: 'Thing',
  icon,
  title: 'Thing × 2',
  text: `Thing × 2\nArany ${amount}`,
  costs: [{ name: 'Arany', amount }],
})
const previous = () => ({
  items: [
    { vnum: 100, name: 'Thing' },
    {
      vnum: 101,
      name: 'Pet',
      type: 'ITEM_COSTUME',
      sub_type: 'COSTUME_PET',
      apply_type0: 'APPLY_MAX_HP',
      apply_value0: 3,
    },
  ],
  itemOverrides: [
    {
      vnum: 101,
      name: 'Pet',
      type: 'ITEM_COSTUME',
      sub_type: 'COSTUME_PET',
      apply_type0: 'APPLY_MAX_HP',
      apply_value0: 7,
      manualNote: 'keep',
    },
  ],
  shops: [
    {
      vnum: 612,
      npc_vnum: 20015,
      npc_name: 'Deokbae',
      name: 'mining',
      coin_type: 'Gold',
      offers: [{ order: 0, item_vnum: 100, count: 2, prices: [{ price_type: 1, price_vnum: 0, amount: 5 }] }],
    },
  ],
  shopOverrides: [],
  meta: {
    source: 'https://wiki.venor2.hu/',
    generatedAt: '2026-09-01T00:00:00Z',
    completeItems: true,
    completePets: true,
  },
})
const capture = () => ({
  version: 1,
  method: 'browser-extension-dom',
  complete: true,
  completedAt: '2026-09-10T00:00:00Z',
  pets: {
    source: 'https://wiki.venor2.hu/items?type=ITEM_COSTUME&subtype=COSTUME_PET',
    expectedCount: 1,
    capturedAt: '2026-09-10T00:00:00Z',
    records: [{ url: itemUrl(101), name: 'Pet HU', icon, bonuses: [{ label: 'Max. TP', value: '+1500' }] }],
  },
  directory: [{ url: 'https://wiki.venor2.hu/npc-shops/20015', name: 'Deokbae', count: 2 }],
  shops: {
    20015: {
      npc_vnum: 20015,
      npc_name: 'Deokbae',
      source: 'https://wiki.venor2.hu/npc-shops/20015',
      complete: true,
      expectedOfferCount: 2,
      offers: [offer(), offer(1, '200 000 000 arany')],
    },
  },
})

describe('unattended wiki import', () => {
  it('preserves recipe alternatives and manual metadata while refreshing overridden bonuses', () => {
    const result = buildWikiImport(capture(), previous())
    expect(result.shops[0].vnum).toBe(612)
    expect(result.shops[0].offers.map((o) => o.prices[0].amount)).toEqual([500000000, 200000000])
    expect(result.items.find((i) => i.vnum === 101)).toMatchObject({
      locale_name: 'Pet HU',
      manualNote: 'keep',
      apply_value0: 1500,
    })
    expect(result.itemOverrides).toEqual([])
    expect(result.meta.itemsGeneratedAt).toBe('2026-09-01T00:00:00Z')
  })
  it('blocks missing shops, repeated pets, missing icons and truncated captures', () => {
    for (const mutate of [
      (s) => {
        delete s.shops[20015]
      },
      (s) => {
        s.pets.records.push(s.pets.records[0])
        s.pets.expectedCount++
      },
      (s) => {
        delete s.pets.records[0].icon
      },
      (s) => {
        s.shops[20015].offers.pop()
      },
      (s) => {
        s.complete = false
      },
    ]) {
      const s = capture()
      mutate(s)
      expect(() => buildWikiImport(s, previous())).toThrow()
    }
  })
  it('rejects large shrink, even for complete captures, unless explicitly overridden', () => {
    const old = previous()
    old.shops[0].offers = Array.from({ length: 10 }, (_, order) => ({ ...old.shops[0].offers[0], order }))
    expect(() => buildWikiImport(capture(), old)).toThrow('shrank')
    expect(buildWikiImport(capture(), old, { allowShrink: true }).report.offerCount).toBe(2)
  })
  it('handles nonbreaking-space currencies and linked ingredients without rounding', () => {
    expect(wikiAmount('500\u00a0000\u202f000')).toBe(500000000)
    const s = offer()
    s.costs = [
      { name: 'Gaya', amount: '1 000 gaya' },
      { name: 'Ingredient', url: itemUrl(200), amount: '× 500' },
    ]
    expect(normalizeBrowserOffer(s, 0).prices).toEqual([
      { price_type: 100, price_vnum: 0, amount: 1000 },
      { price_type: 3, price_vnum: 200, amount: 500 },
    ])
    for (const amount of ['-5', '1.5', '9007199254740992']) expect(() => wikiAmount(amount)).toThrow()
    s.costs = [{ name: 'Unknown coins', amount: '500' }]
    expect(() => normalizeBrowserOffer(s, 0)).toThrow('Unsupported currency')
  })
  it('distinguishes flat and percent HP and refuses unknown bonus labels/units', () => {
    expect(petBonuses([{ label: 'Max. TP', value: '+5%' }]).apply_type0).toBe('APPLY_MAX_HP_PCT')
    expect(petBonuses([{ label: 'Max. TP', value: '+1500' }]).apply_type0).toBe('APPLY_MAX_HP')
    expect(() => petBonuses([{ label: 'Unknown', value: '+5%' }])).toThrow()
    expect(() => petBonuses([{ label: 'Sungma Erő', value: '+5%' }])).toThrow()
  })
})

describe('export cache and publication recovery', () => {
  it('publishes through a journal when the directory is locked and rolls back file failures', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'venor-file-publish-'))
    const target = join(dir, 'public')
    const lockedDirectory = async (from, to) => {
      if (from === target) throw Object.assign(new Error('directory locked'), { code: 'EPERM' })
      await rename(from, to)
    }
    try {
      await mkdir(target)
      await writeFile(join(target, 'original.json'), '{"old":true}')
      await writeFile(join(target, 'keep.txt'), 'keep')
      await expect(
        replaceDataset(target, { 'original.json': { changed: true }, 'new.json': {} }, async (from, to) => {
          if (from.endsWith('new.json')) throw new Error('file promotion failed')
          await lockedDirectory(from, to)
        }),
      ).rejects.toThrow('file promotion failed')
      expect(await readFile(join(target, 'original.json'), 'utf8')).toBe('{"old":true}')
      await expect(access(join(target, 'new.json'))).rejects.toThrow()
      await replaceDataset(
        target,
        { 'original.json': { changed: true }, 'media/icon.png': Buffer.from([1, 2, 3]) },
        lockedDirectory,
      )
      expect(JSON.parse(await readFile(join(target, 'original.json'), 'utf8'))).toEqual({ changed: true })
      expect(await readFile(join(target, 'keep.txt'), 'utf8')).toBe('keep')
      expect(await readFile(join(target, 'media/icon.png'))).toEqual(Buffer.from([1, 2, 3]))
      await expect(access(`${target}.publication.json`)).rejects.toThrow()
      // Simulate termination after one overwritten file and one newly added file.
      await mkdir(`${target}.backup`)
      await writeFile(join(`${target}.backup`, 'original.json'), '{"old":true}')
      await writeFile(join(target, 'new.json'), '{}')
      await writeFile(
        `${target}.publication.json`,
        JSON.stringify({ version: 1, names: ['original.json', 'new.json'] }),
      )
      await recoverDataset(target)
      expect(await readFile(join(target, 'original.json'), 'utf8')).toBe('{"old":true}')
      await expect(access(join(target, 'new.json'))).rejects.toThrow()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
  it('loads only complete extension exports from the local cache', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'venor-export-cache-'))
    try {
      await expect(readCachedExport(dir)).rejects.toThrow('No complete browser extension export')
      for (const snapshot of [
        { ...capture(), complete: false },
        { ...capture(), method: 'unsupported' },
      ]) {
        await saveJson(join(dir, 'capture.json'), snapshot)
        await expect(readCachedExport(dir)).rejects.toThrow('No complete browser extension export')
        expect(() => buildWikiImport(snapshot, previous())).toThrow()
      }
      await saveJson(join(dir, 'capture.json'), capture())
      expect(await readCachedExport(dir)).toEqual(capture())
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
  it('publishes data and binary media together, retaining unrelated files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'venor-publish-'))
    const target = join(dir, 'public')
    try {
      await mkdir(target)
      await writeFile(join(target, 'keep.txt'), 'keep')
      await replaceDataset(target, {
        'data/meta.json': { ok: true },
        'media/items/icon.png': Buffer.from([1, 2, 3]),
      })
      expect(await readFile(join(target, 'keep.txt'), 'utf8')).toBe('keep')
      expect(JSON.parse(await readFile(join(target, 'data/meta.json'), 'utf8'))).toEqual({ ok: true })
      expect(await readFile(join(target, 'media/items/icon.png'))).toEqual(Buffer.from([1, 2, 3]))
      await expect(replaceDataset(target, { '../outside.json': {} })).rejects.toThrow(
        'Invalid publication path',
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
  it('rolls back failed promotion and recovers an interrupted directory rename', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'venor-rollback-'))
    const target = join(dir, 'public')
    try {
      await mkdir(target)
      await writeFile(join(target, 'original.json'), '{"old":true}')
      await expect(
        replaceDataset(target, { 'new.json': {} }, async (from, to) => {
          if (from.endsWith('.next')) throw new Error('simulated promotion failure')
          await rename(from, to)
        }),
      ).rejects.toThrow('simulated')
      expect(await readFile(join(target, 'original.json'), 'utf8')).toBe('{"old":true}')
      await rename(target, `${target}.backup`)
      await recoverDataset(target)
      await access(join(target, 'original.json'))
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
