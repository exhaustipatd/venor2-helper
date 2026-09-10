/* global chrome, location, MouseEvent, PointerEvent */
// Injected only after a toolbar click, into the existing tab's isolated world.
// No fetch/XHR, extra tabs, API access, request interception or browser launch.
;(async () => {
  if (location.origin !== 'https://wiki.venor2.hu') return
  if (globalThis.__venorCollector) return globalThis.__venorCollector.show()
  const PETS = 'https://wiki.venor2.hu/items?type=ITEM_COSTUME&subtype=COSTUME_PET'
  const KEY = 'venorWikiCapture'
  const IMAGE_KEY = 'venorWikiImage:'
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  let snapshot = (await chrome.storage.local.get(KEY))[KEY]
  const savedImages = new Set(snapshot?.imageFiles || [])
  if (savedImages.size) {
    const images = await chrome.storage.local.get([...savedImages].map((name) => IMAGE_KEY + name))
    snapshot.images ??= {}
    for (const name of savedImages) {
      if (!images[IMAGE_KEY + name]) throw new Error(`Saved image is missing: ${name}`)
      snapshot.images[name] = images[IMAGE_KEY + name]
    }
  }
  let running = false
  let stopped = false
  let hovered
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:2147483647'
  const panel = host.attachShadow({ mode: 'open' })
  panel.innerHTML = `<style>
    :host { color-scheme: dark; } section { font:14px/1.5 system-ui; background:#182329;color:#f4f6f7; border:1px solid #789489;border-radius:10px;padding:16px;width:310px;box-shadow:0 4px 24px #0008 }
    p { white-space:pre-wrap;overflow-wrap:anywhere } button { margin:4px 5px 0 0;padding:7px 10px;cursor:pointer } button:disabled { cursor:default } small { color:#c4d4cb }
    </style><section><strong>Venor wiki export</strong><p id="status"></p>
    <button id="start">Start / resume</button><button id="stop" disabled>Stop</button>
    <button id="export">Export JSON</button><button id="fresh">New capture</button>
    <p><small>Leave this tab open and avoid using its links during collection. No automatic retry after an error.</small></p></section>`
  document.documentElement.appendChild(host)
  const status = (message) => {
    panel.querySelector('#status').textContent = message
  }
  const show = () => {
    host.style.display = ''
    host.scrollIntoView({ block: 'nearest' })
  }
  globalThis.__venorCollector = { show }
  const summary = () =>
    snapshot
      ? `${snapshot.pets?.records.length || 0} pets; ${Object.values(snapshot.shops || {}).filter((s) => s.complete).length}/${snapshot.directory?.length || '?'} shops.\n${snapshot.complete ? 'Complete — export ready.' : snapshot.error || 'Ready to resume.'}`
      : 'Open the wiki pet category, then press Start. Collection continues through all NPC shops.'
  status(summary())
  const persist = async () => {
    // Write PNGs only once; subsequent recipe checkpoints contain JSON metadata.
    // Images are committed first so a saved checkpoint never references unwritten data.
    const pending = Object.entries(snapshot.images || {}).filter(([name]) => !savedImages.has(name))
    if (pending.length) {
      await chrome.storage.local.set(
        Object.fromEntries(pending.map(([name, image]) => [IMAGE_KEY + name, image])),
      )
      for (const [name] of pending) savedImages.add(name)
    }
    await chrome.storage.local.set({
      [KEY]: { ...snapshot, images: {}, imageFiles: Object.keys(snapshot.images || {}) },
    })
  }
  const check = () => {
    if (stopped) throw new Error('Stopped by you. Resume when ready.')
    if (!host.isConnected) throw new Error('Page changed; reopen the exporter to resume.')
  }
  const wait = async (test, label) => {
    const deadline = Date.now() + 30000
    while (Date.now() < deadline) {
      check()
      const result = test()
      if (result) return result
      await delay(16)
    }
    throw new Error(`Timed out: ${label}. Collection stopped; no retry.`)
  }
  const tooltip = () =>
    [...document.querySelectorAll('[role="tooltip"]')].find((el) => el.getClientRects().length)
  const hover = (element, enter) => {
    const rect = element.getBoundingClientRect()
    const init = {
      bubbles: true,
      clientX: rect.x + rect.width / 2,
      clientY: rect.y + rect.height / 2,
      relatedTarget: document.body,
    }
    element.dispatchEvent(
      new PointerEvent(enter ? 'pointerover' : 'pointerout', { ...init, pointerType: 'mouse' }),
    )
    element.dispatchEvent(new MouseEvent(enter ? 'mouseover' : 'mouseout', init))
    element.dispatchEvent(new MouseEvent(enter ? 'mouseenter' : 'mouseleave', { ...init, bubbles: false }))
  }
  const hideTooltip = async () => {
    if (hovered) {
      hover(hovered, false)
      hovered = undefined
    }
    await wait(() => !tooltip(), 'previous tooltip to close')
  }
  const readIcons = async (container) => {
    for (const img of container.querySelectorAll('img')) {
      const match = /^https:\/\/wiki\.venor2\.hu\/assets\/icons\/([a-f0-9]{16}\.png)$/.exec(img.src)
      if (!match || snapshot.images[match[1]]) continue
      // Scrolling allows normal lazy loading. Do not change src/loading or fetch assets.
      const bounds = img.getBoundingClientRect()
      if (bounds.top < 0 || bounds.bottom > window.innerHeight) img.scrollIntoView({ block: 'nearest' })
      await wait(() => img.complete && img.naturalWidth, `image ${match[1]}`)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      snapshot.images[match[1]] = canvas.toDataURL('image/png')
    }
  }
  const clickLink = async (path) => {
    const link = [...document.querySelectorAll('a[href]')].find(
      (a) => new URL(a.href).origin === location.origin && new URL(a.href).pathname === path,
    )
    if (!link) throw new Error(`Missing page link: ${path}`)
    link.click()
    await wait(() => location.pathname === path, path)
  }
  const exportJSON = () => {
    if (!snapshot) return status('There is no capture to export yet.')
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `venor-wiki-${snapshot.complete ? 'complete' : 'partial'}-${snapshot.startedAt.slice(0, 10)}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
  panel.querySelector('#export').onclick = exportJSON
  panel.querySelector('#stop').onclick = () => {
    stopped = true
    status('Stopping after the current operation…')
  }
  panel.querySelector('#fresh').onclick = async () => {
    if (running) return
    // Preserve the previous capture as a download before replacing its checkpoint.
    if (snapshot) exportJSON()
    await chrome.storage.local.remove(KEY)
    snapshot = undefined
    savedImages.clear()
    status(summary())
  }
  panel.querySelector('#start').onclick = async () => {
    if (running) return
    if (snapshot?.complete) return exportJSON()
    if (snapshot && Date.now() - Date.parse(snapshot.startedAt) > 86400000)
      return status('Capture is older than 24 hours. Use New capture.')
    if (
      !snapshot?.pets &&
      (location.pathname !== '/items' || new URL(location.href).searchParams.get('subtype') !== 'COSTUME_PET')
    )
      return status(`Open the pet category first:\n${PETS}`)
    running = true
    stopped = false
    for (const id of ['start', 'fresh']) panel.querySelector(`#${id}`).disabled = true
    panel.querySelector('#stop').disabled = false
    snapshot ??= {
      version: 1,
      method: 'browser-extension-dom',
      startedAt: new Date().toISOString(),
      images: {},
      shops: {},
    }
    try {
      delete snapshot.error
      await persist()
      if (!snapshot.pets) {
        status('Reading pet cards…')
        await wait(() => document.querySelector('.wiki-petmount-list__card'), 'pet cards')
        const cards = [...document.querySelectorAll('.wiki-petmount-list__card')]
        const count = /(?:^|\n)\s*(\d+)\s+elem(?:\s|$)/m.exec(document.querySelector('main').innerText)
        if (!count || cards.length !== Number(count[1])) throw new Error('Incomplete pet listing')
        const records = []
        for (const card of cards) {
          records.push({
            url: card.querySelector('.wiki-petmount-list__card-head')?.href,
            name: card.querySelector('.wiki-petmount-list__name')?.textContent.trim(),
            icon: card.querySelector('.wiki-petmount-list__thumb img')?.src,
            bonuses: [...card.querySelectorAll('.wiki-petmount-list__bonus')].map((b) => ({
              value: b.querySelector('.wiki-petmount-list__bonus-value')?.textContent.trim(),
              label: b.querySelector('.wiki-petmount-list__bonus-label')?.textContent.trim(),
            })),
          })
          await readIcons(card)
        }
        snapshot.pets = {
          source: PETS,
          expectedCount: Number(count[1]),
          records,
          capturedAt: new Date().toISOString(),
        }
        await persist()
      }
      await hideTooltip()
      await clickLink('/npc-shops')
      await wait(() => document.querySelector('.wiki-browse-list__row'), 'NPC directory')
      const directory = [...document.querySelectorAll('.wiki-browse-list__row')].map((row) => ({
        url: row.href,
        name: row.querySelector('.wiki-browse-list__name')?.textContent.trim(),
        count: Number(row.querySelector('.wiki-browse-list__count')?.textContent),
      }))
      if (
        !directory.length ||
        directory.some((npc) => !npc.name || !Number.isSafeInteger(npc.count) || npc.count < 0)
      )
        throw new Error('Invalid NPC directory')
      if (snapshot.directory && JSON.stringify(snapshot.directory) !== JSON.stringify(directory))
        throw new Error('NPC directory changed. Start a new capture.')
      snapshot.directory = directory
      await persist()
      for (const [index, npc] of directory.entries()) {
        check()
        const path = new URL(npc.url).pathname
        const id = Number(path.split('/').at(-1))
        if (!/^\/npc-shops\/\d+$/.test(path) || !Number.isSafeInteger(id) || id < 1)
          throw new Error('Invalid NPC link')
        if (snapshot.shops[id]?.complete) continue
        status(`Shop ${index + 1}/${directory.length}: ${npc.name}`)
        await clickLink(path)
        await wait(
          () =>
            document.querySelector(`main a[href="/mobs/${id}"]`) &&
            document.querySelectorAll('.wiki-browse-cell').length === npc.count,
          `${npc.name} grid`,
        )
        const cells = [...document.querySelectorAll('.wiki-browse-cell')]
        const grid = cells.map((cell) => ({
          url: cell.href,
          name: cell.getAttribute('aria-label'),
          icon: cell.querySelector('img')?.src,
        }))
        const capture = (snapshot.shops[id] ??= {
          npc_vnum: id,
          npc_name: npc.name,
          source: npc.url,
          expectedOfferCount: npc.count,
          offers: [],
        })
        if (capture.grid && JSON.stringify(capture.grid) !== JSON.stringify(grid))
          throw new Error('Shop grid changed. Start a new capture.')
        capture.grid = grid
        for (let position = Math.max(0, capture.offers.length - 1); position < cells.length; position++) {
          if (location.pathname !== path || !cells[position].isConnected)
            throw new Error('Shop page changed during capture')
          status(`Shop ${index + 1}/${directory.length}: ${npc.name}\nRecipe ${position + 1}/${cells.length}`)
          await hideTooltip()
          await readIcons(cells[position])
          cells[position].scrollIntoView({ block: 'center' })
          hovered = cells[position]
          hover(hovered, true)
          const tip = await wait(tooltip, 'recipe tooltip')
          const details = {
            title: tip.querySelector('.wiki-hover-tooltip__title')?.textContent.trim(),
            text: tip.innerText,
            costs: [...tip.querySelectorAll('.wiki-material-list__item')].map((row) => ({
              url: row.querySelector('a')?.href,
              name: row.querySelector('.wiki-material-list__name')?.textContent.trim(),
              amount: row.querySelector('.wiki-material-list__count')?.textContent.trim(),
              icon: row.querySelector('img')?.src,
            })),
          }
          if (!details.title?.startsWith(`${grid[position].name} × `) || !details.costs.length)
            throw new Error('Missing or incorrect recipe tooltip')
          await readIcons(tip)
          if (!tip.isConnected) throw new Error('Tooltip disappeared during capture')
          const observed = { position, ...grid[position], ...details }
          if (
            position < capture.offers.length &&
            JSON.stringify(capture.offers[position]) !== JSON.stringify(observed)
          )
            throw new Error('Recipe changed since checkpoint. Start a new capture.')
          capture.offers[position] = observed
          await persist()
          await hideTooltip()
          // Waits above cover tooltip rendering and image readiness; no per-recipe sleep.
        }
        capture.complete = true
        capture.capturedAt = new Date().toISOString()
        await persist()
      }
      snapshot.complete = true
      snapshot.completedAt = new Date().toISOString()
      await persist()
      status(summary())
      exportJSON()
    } catch (error) {
      snapshot.error = error.message
      snapshot.failedAt = new Date().toISOString()
      await persist().catch(() => {
        snapshot.error += '\nCheckpoint storage failed. Export JSON before closing this tab.'
      })
      status(snapshot.error)
    } finally {
      if (hovered) {
        hover(hovered, false)
        hovered = undefined
      }
      running = false
      for (const id of ['start', 'fresh']) panel.querySelector(`#${id}`).disabled = false
      panel.querySelector('#stop').disabled = true
    }
  }
})().catch((error) => console.error('Wiki exporter initialization failed:', error))
