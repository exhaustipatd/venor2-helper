import { access, cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  )
/** A backup survives process termination between directory renames. Recovery runs before any fetch. */
export async function recoverDataset(dataDir) {
  const backup = `${dataDir}.backup`,
    next = `${dataDir}.next`
  if (await exists(backup)) {
    if (!(await exists(dataDir))) await rename(backup, dataDir)
    else await rm(backup, { recursive: true, force: true })
  }
  await rm(next, { recursive: true, force: true })
}
export async function replaceDataset(dataDir, files, move = rename) {
  const backup = `${dataDir}.backup`,
    next = `${dataDir}.next`
  await recoverDataset(dataDir)
  await mkdir(dirname(dataDir), { recursive: true })
  if (await exists(dataDir)) await cp(dataDir, next, { recursive: true })
  else await mkdir(next)
  try {
    for (const [name, value] of Object.entries(files)) {
      await writeFile(join(next, name), JSON.stringify(value, null, name === 'meta.json' ? 2 : 0))
      JSON.parse(await readFile(join(next, name), 'utf8'))
    }
    const hadPrevious = await exists(dataDir)
    if (hadPrevious) await move(dataDir, backup)
    try {
      await move(next, dataDir)
    } catch (error) {
      if (hadPrevious) await rename(backup, dataDir)
      throw error
    }
    // Publication is already successful; interrupted cleanup is handled on the next run.
    await rm(backup, { recursive: true, force: true }).catch(() => {})
  } finally {
    await rm(next, { recursive: true, force: true })
  }
}
