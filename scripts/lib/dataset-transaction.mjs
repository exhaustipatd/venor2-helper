import { access, cp, copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Buffer } from 'node:buffer'

const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  )
const validatePath = (name) => {
  if (
    typeof name !== 'string' ||
    !name ||
    name.split(/[\\/]/).some((part) => !part || part === '.' || part === '..' || part.includes(':'))
  )
    throw new Error(`Invalid publication path: ${name}`)
}
/** Recover interrupted directory or journaled file promotion before reading the baseline. */
export async function recoverDataset(dataDir) {
  const backup = `${dataDir}.backup`,
    next = `${dataDir}.next`
  const journal = `${dataDir}.publication.json`
  if (await exists(journal)) {
    const transaction = JSON.parse(await readFile(journal, 'utf8'))
    if (transaction.version !== 1 || !Array.isArray(transaction.names) || !(await exists(backup)))
      throw new Error('Invalid or missing publication recovery data')
    transaction.names.forEach(validatePath)
    for (const name of transaction.names) {
      const target = join(dataDir, name)
      if (await exists(join(backup, name))) {
        await mkdir(dirname(target), { recursive: true })
        await copyFile(join(backup, name), target)
      } else await rm(target, { force: true })
    }
    await rm(journal)
  }
  if (await exists(backup)) {
    if (!(await exists(dataDir))) await rename(backup, dataDir)
    else await rm(backup, { recursive: true, force: true })
  }
  await rm(next, { recursive: true, force: true })
}
// Windows directory watchers can prevent renaming public while allowing file replacement.
// Keep a backup and recovery journal until every staged file has been promoted.
async function promoteFiles(dataDir, names, move) {
  const backup = `${dataDir}.backup`
  const journal = `${dataDir}.publication.json`
  await cp(dataDir, backup, { recursive: true })
  await writeFile(journal, JSON.stringify({ version: 1, names }))
  try {
    for (const name of names) {
      const target = join(dataDir, name)
      await mkdir(dirname(target), { recursive: true })
      await move(join(`${dataDir}.next`, name), target)
    }
    await rm(journal)
  } catch (error) {
    await recoverDataset(dataDir)
    throw error
  }
  await rm(backup, { recursive: true, force: true }).catch(() => {})
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
      validatePath(name)
      const path = join(next, name)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(
        path,
        Buffer.isBuffer(value) ? value : JSON.stringify(value, null, name.endsWith('meta.json') ? 2 : 0),
      )
      if (!Buffer.isBuffer(value)) JSON.parse(await readFile(path, 'utf8'))
    }
    const hadPrevious = await exists(dataDir)
    if (hadPrevious) {
      try {
        await move(dataDir, backup)
      } catch (error) {
        if (
          !['EPERM', 'EACCES', 'EBUSY'].includes(error.code) ||
          !(await exists(dataDir)) ||
          (await exists(backup))
        )
          throw error
        await promoteFiles(dataDir, Object.keys(files), move)
        return
      }
    }
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
