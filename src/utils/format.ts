const integerFormatter = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 })

export function formatInteger(value: bigint | number | string): string {
  try {
    return integerFormatter.format(typeof value === 'bigint' ? value : BigInt(value || 0))
  } catch {
    return '0'
  }
}

export function formatYang(value: bigint | number | string): string {
  return `${formatInteger(value)} Yang`
}

export function parsePrice(value: string | number | undefined): bigint | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? BigInt(Math.trunc(value)) : null

  const normalized = value.trim().toLowerCase().replace(/\s/g, '').replace(',', '.')
  const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)(k{1,4}|m|mrd|b)?$/)
  if (!match) {
    const digits = normalized.replace(/[^0-9]/g, '')
    return digits ? BigInt(digits) : null
  }

  const amount = Number(match[1])
  if (!Number.isFinite(amount)) return null
  const multiplier = {
    k: 1_000,
    kk: 1_000_000,
    kkk: 1_000_000_000,
    kkkk: 1_000_000_000_000,
    m: 1_000_000,
    mrd: 1_000_000_000,
    b: 1_000_000_000_000,
  }[match[2] ?? ''] ?? 1
  return BigInt(Math.round(amount * multiplier))
}

export function normalizePrice(value: string): string {
  return parsePrice(value)?.toString() ?? ''
}

export function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return 'ismeretlen'
  return new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

export function itemName(item?: { locale_name?: string; name?: string; vnum?: number }): string {
  return item?.locale_name || item?.name || `Tárgy #${item?.vnum ?? '?'}`
}
