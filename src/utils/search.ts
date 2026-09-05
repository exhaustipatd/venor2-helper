export function normalizeSearchText(value: string | number): string {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('hu')
    .replace(/\s+/g, ' ')
    .trim()
}
