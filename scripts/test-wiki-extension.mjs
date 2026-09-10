/* global structuredClone, history */
import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { Buffer } from 'node:buffer'
import { buildWikiImport } from './lib/wiki-import.mjs'
import { preparePublication } from './lib/wiki-publication.mjs'

process.env.PLAYWRIGHT_BROWSERS_PATH ||= resolve('.cache/playwright')
const { chromium } = await import('playwright')
const browser = await chromium.launch({ headless: true })
const cache = await mkdtemp(join(tmpdir(), 'venor-extension-test-'))
const source = await readFile('tools/wiki-browser-extension/collector.js', 'utf8')
const pet = await readFile('tests/fixtures/wiki-pet.html', 'utf8')
// A valid PNG, decoded and re-encoded through the actual canvas implementation.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=',
  'base64',
)
const wiki = 'https://wiki.venor2.hu'
try {
  const context = await browser.newContext({ offline: true })
  let requests = 0
  await context.route('**/*', (route) => {
    requests++
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('.png')) return route.fulfill({ contentType: 'image/png', body: png })
    if (route.request().isNavigationRequest())
      return route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' })
    return route.abort()
  })
  const page = await context.newPage()
  await page.goto(`${wiki}/items?type=ITEM_COSTUME&subtype=COSTUME_PET`)
  await page.clock.install()
  await page.evaluate(
    ({ pet }) => {
      globalThis.chrome = {
        storage: {
          local: {
            async get() {
              return structuredClone(globalThis.saved || {})
            },
            async set(value) {
              globalThis.storageWrites ??= []
              globalThis.storageWrites.push(structuredClone(value))
              globalThis.saved = { ...globalThis.saved, ...structuredClone(value) }
            },
            async remove() {
              globalThis.saved = {}
            },
          },
        },
      }
      document.body.innerHTML = `<nav><a href="/npc-shops">NPC boltok</a></nav><main><p>1 elem</p>${pet}</main>`
      const grid = `<a class="wiki-browse-list__row" href="/npc-shops/20015"><span class="wiki-browse-list__name">Deokbae</span><span class="wiki-browse-list__count">2</span></a><a href="/mobs/20015">Deokbae</a>${[1, 2].map((n) => `<a class="wiki-browse-cell" aria-label="Same item" href="/items/100" data-price="${n}" style="display:inline-block;width:80px;height:80px"><img src="/assets/icons/1111111111111111.png"></a>`).join('')}`
      document.addEventListener('click', (e) => {
        const link = e.target.closest('a')
        if (!link?.pathname.startsWith('/npc-shops')) return
        e.preventDefault()
        history.pushState({}, '', link.href)
        document.querySelector('main').innerHTML = grid
      })
      // Delegated mouseover/out models React's synthetic mouse-enter handling.
      document.addEventListener('mouseover', (e) => {
        const cell = e.target.closest('.wiki-browse-cell')
        if (!cell || globalThis.breakTooltip) return
        const tip = document.createElement('div')
        tip.setAttribute('role', 'tooltip')
        tip.innerHTML = `<div class="wiki-hover-tooltip__title">Same item × 1</div><div class="wiki-material-list__item"><span class="wiki-material-list__name">Arany</span><span class="wiki-material-list__count">${cell.dataset.price} arany</span></div>`
        setTimeout(() => document.body.append(tip), 75)
      })
      document.addEventListener('mouseout', (e) => {
        if (e.target.closest('.wiki-browse-cell')) {
          const old = document.querySelector('[role="tooltip"]')
          setTimeout(() => old?.remove(), 200)
        }
      })
    },
    { pet },
  )
  await page.addScriptTag({ content: source })
  await page.getByRole('button', { name: 'Start / resume', exact: true }).click()
  for (let i = 0; i < 60; i++) {
    await page.clock.runFor(1000)
    if (
      await page.evaluate(
        () => globalThis.saved?.venorWikiCapture?.complete || globalThis.saved?.venorWikiCapture?.error,
      )
    )
      break
  }
  const capture = await page.evaluate(() => {
    const saved = globalThis.saved.venorWikiCapture
    return {
      ...saved,
      images: Object.fromEntries(
        saved.imageFiles.map((name) => [name, globalThis.saved['venorWikiImage:' + name]]),
      ),
    }
  })
  assert.equal(capture.complete, true, capture.error)
  assert.equal(capture.method, 'browser-extension-dom')
  assert.equal(capture.pets.records.length, 1)
  assert.deepEqual(
    capture.shops[20015].offers.map((o) => o.costs[0].amount),
    ['1 arany', '2 arany'],
  )
  assert.equal(Object.keys(capture.images).length, 2)
  const writes = await page.evaluate(() => globalThis.storageWrites)
  assert.equal(writes.flatMap(Object.keys).filter((key) => key.startsWith('venorWikiImage:')).length, 2)
  assert.ok(
    writes.filter((w) => w.venorWikiCapture).every((w) => !Object.keys(w.venorWikiCapture.images).length),
  )
  assert.ok(
    Date.parse(capture.completedAt) - Date.parse(capture.startedAt) < 3000,
    'Ready fixture should not pause between recipes or shops',
  )
  const previous = {
    items: [{ vnum: 100, name: 'Same item' }],
    itemOverrides: [],
    shopOverrides: [],
    iconMap: {},
    manifest: { items: {} },
    shops: [
      {
        vnum: 612,
        npc_vnum: 20015,
        npc_name: 'Deokbae',
        name: 'mining',
        offers: [
          { order: 0, item_vnum: 100, count: 1, prices: [{ price_type: 1, price_vnum: 0, amount: 1 }] },
        ],
      },
    ],
    meta: { source: wiki, generatedAt: '2026-09-01T00:00:00Z', completeItems: true, completePets: false },
  }
  const candidate = buildWikiImport(capture, previous)
  const files = await preparePublication(candidate, previous, cache, capture.images)
  assert.ok(Buffer.isBuffer(files['media/items/1111111111111111.png']))
  await assert.rejects(
    preparePublication(candidate, previous, cache, {
      ...capture.images,
      '1111111111111111.png': 'data:image/png;base64,AAAA',
    }),
    /invalid browser-loaded PNG/,
  )
  assert.throws(() => buildWikiImport({ ...capture, complete: false }, previous), /incomplete/)
  console.log(
    'PASS: actual collector → all fixture pets/shops → distinct alternative recipes → canvas icons → offline import',
  )

  // Resume a saved partial capture; a tooltip timeout must stop without retrying.
  await page.evaluate(() => {
    const c = globalThis.saved.venorWikiCapture
    c.complete = false
    c.shops[20015].complete = false
    c.shops[20015].offers.pop()
    globalThis.breakTooltip = true
    delete globalThis.__venorCollector
    document.querySelector('div[style*="2147483647"]').remove()
  })
  await page.addScriptTag({ content: source })
  // Loading the compact checkpoint must rehydrate PNGs for the exported file.
  const exportDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click()
  const download = await exportDownload
  const downloadPath = join(cache, 'resumed.json')
  await download.saveAs(downloadPath)
  const resumed = JSON.parse(await readFile(downloadPath, 'utf8'))
  assert.deepEqual(resumed.images, capture.images)
  const before = requests
  await page.getByRole('button', { name: 'Start / resume', exact: true }).click()
  await page.clock.runFor(31000)
  const failed = await page.evaluate(() => globalThis.saved.venorWikiCapture)
  assert.match(failed.error, /Timed out: recipe tooltip/)
  assert.equal(failed.shops[20015].offers.length, 1)
  assert.equal(requests, before)
  await page.evaluate(() => {
    globalThis.breakTooltip = false
  })
  await page.getByRole('button', { name: 'Start / resume', exact: true }).click()
  await page.clock.runFor(1000)
  assert.equal(await page.evaluate(() => globalThis.saved.venorWikiCapture.complete), true)
  assert.equal(requests, before)
  console.log('PASS: timeout checkpoints retained, immediate resume succeeds')
  await context.close()
} finally {
  await browser.close()
  await rm(cache, { recursive: true, force: true })
}
