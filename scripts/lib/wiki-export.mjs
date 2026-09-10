import { readFile, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'

export const WIKI = 'https://wiki.venor2.hu'
export const PETS = `${WIKI}/items?type=ITEM_COSTUME&subtype=COSTUME_PET`

export async function saveJson(path, value) {
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2))
  await rename(`${path}.tmp`, path)
}

export async function readCachedExport(cache) {
  let snapshot
  try {
    snapshot = JSON.parse(await readFile(join(cache, 'capture.json'), 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (snapshot?.method !== 'browser-extension-dom' || snapshot.complete !== true)
    throw new Error('No complete browser extension export is cached; use --capture <file.json>')
  return snapshot
}
