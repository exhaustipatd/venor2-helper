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
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null
  if (value.length > 100) return null
  const normalized = value.trim().toLowerCase().replace(/\s/g, '').replace(',', '.')
  const match = normalized.match(/^(\d+)(?:\.(\d+))?(k{1,4}|m|mrd|b)?$/)
  if (!match) return null
  const multiplier =
    {
      k: 1_000n,
      kk: 1_000_000n,
      kkk: 1_000_000_000n,
      kkkk: 1_000_000_000_000n,
      m: 1_000_000n,
      mrd: 1_000_000_000n,
      b: 1_000_000_000_000n,
    }[match[3] ?? ''] ?? 1n
  const fraction = match[2] ?? ''
  const scale = 10n ** BigInt(fraction.length)
  const numerator = BigInt(`${match[1]}${fraction}`) * multiplier
  return (numerator * 2n + scale) / (scale * 2n)
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
