import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCachedExport, saveJson } from './lib/wiki-export.mjs'
import { buildWikiImport } from './lib/wiki-import.mjs'
import { readPrevious, preparePublication } from './lib/wiki-publication.mjs'
import { recoverDataset, replaceDataset } from './lib/dataset-transaction.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
process.chdir(root)
const argv = process.argv.slice(2)
const captureIndex = argv.indexOf('--capture')
const capturePath = captureIndex < 0 ? undefined : argv[captureIndex + 1]
if (captureIndex >= 0) argv.splice(captureIndex, capturePath && !capturePath.startsWith('--') ? 2 : 1)
const args = new Set(argv)
const allowed = ['--dry-run', '--offline', '--allow-shrink', '--status', '--help']
const cache = join(root, '.cache', 'wiki-sync')
const publicDir = join(root, 'public')
const lock = join(root, '.venor-sync-lock')
let locked = false

async function acquireLock() {
  try {
    await mkdir(lock)
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    let owner
    try {
      owner = JSON.parse(await readFile(join(lock, 'owner.json'), 'utf8'))
    } catch (error) {
      if (Date.now() - (await stat(lock)).mtimeMs < 60000)
        throw new Error('Another sync may be starting', { cause: error })
    }
    if (Number.isSafeInteger(owner?.pid) && owner.pid > 0) {
      try {
        process.kill(owner.pid, 0)
        throw new Error(`Sync already running (PID ${owner.pid})`, { cause: error })
      } catch (error) {
        if (error.code !== 'ESRCH') throw error
      }
    }
    // The resolved lock is always the named folder inside this repository.
    await rm(lock, { recursive: true, force: true })
    await mkdir(lock)
  }
  locked = true
  await writeFile(
    join(lock, 'owner.json'),
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
  )
}

try {
  for (const arg of args) if (!allowed.includes(arg)) throw new Error(`Unknown option: ${arg}`)
  if (captureIndex >= 0 && (!capturePath || capturePath.startsWith('--')))
    throw new Error('--capture requires an exported JSON file path')
  if (capturePath && args.has('--offline')) throw new Error('Use --capture or --offline, not both')
  if (args.has('--help') || (!capturePath && !args.has('--offline') && !args.has('--status'))) {
    console.log(
      'Sync is offline only. Load tools/wiki-browser-extension in your normal browser and export the wiki.\nThen: npm run sync-data -- --capture <export.json> [--dry-run] [--allow-shrink]\n--offline uses a complete cached export. --status shows the last local capture.\nInstructions: docs/WIKI-CAPTURE.md',
    )
  } else if (args.has('--status')) {
    const snapshot = JSON.parse(await readFile(join(cache, 'capture.json'), 'utf8'))
    console.log(
      JSON.stringify(
        {
          startedAt: snapshot.startedAt,
          complete: snapshot.complete || false,
          published: snapshot.published || false,
          pets: snapshot.pets?.records.length || 0,
          shops: Object.values(snapshot.shops || {}).filter((s) => s.complete).length,
          expectedShops: snapshot.directory?.length,
          error: snapshot.error,
        },
        null,
        2,
      ),
    )
  } else {
    await acquireLock()
    await mkdir(cache, { recursive: true })
    const snapshot = capturePath
      ? JSON.parse(await readFile(resolve(capturePath), 'utf8'))
      : await readCachedExport(cache)
    // Recover interrupted publication before reading any candidate baseline.
    await recoverDataset(publicDir)
    const previous = await readPrevious(publicDir)
    const candidate = buildWikiImport(snapshot, previous, { allowShrink: args.has('--allow-shrink') })
    const files = await preparePublication(candidate, previous, publicDir, snapshot.images)
    await saveJson(join(cache, 'capture.json'), snapshot)
    await saveJson(join(cache, 'report.json'), candidate.report)
    console.log(JSON.stringify(candidate.report, null, 2))
    if (args.has('--dry-run'))
      console.log(
        'Validated. Public data unchanged; the next run can publish this cached capture without revisiting the wiki.',
      )
    else {
      await saveJson(join(cache, 'previous-overrides.json'), {
        items: previous.itemOverrides,
        shops: previous.shopOverrides,
      })
      await replaceDataset(publicDir, files)
      snapshot.published = true
      await saveJson(join(cache, 'capture.json'), snapshot)
      console.log('Published shops, pets, referenced items and icons together.')
    }
  }
} catch (error) {
  console.error(`Wiki sync stopped: ${error.message}`)
  process.exitCode = 1
} finally {
  if (locked) await rm(lock, { recursive: true, force: true })
}
