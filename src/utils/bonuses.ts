import type { Bonus, Item } from '@/types/domain'

const labels: Record<string, string> = {
  APPLY_MAX_HP: 'Max. TP',
  APPLY_MAX_SP: 'Max. MP',
  APPLY_MAX_HP_PCT: 'Max. TP',
  APPLY_MAX_SP_PCT: 'Max. MP',
  APPLY_ATT_SPEED: 'Támadási sebesség',
  APPLY_MOV_SPEED: 'Mozgási sebesség',
  APPLY_CAST_SPEED: 'Varázssebesség',
  APPLY_CRITICAL_PCT: 'Esély kritikus találatra',
  APPLY_PENETRATE_PCT: 'Esély átható találatra',
  APPLY_ATTBONUS_HUMAN: 'Félemberek elleni erő',
  APPLY_ATTBONUS_MONSTER: 'Szörnyek elleni erő',
  APPLY_ATTBONUS_BOSS: 'Főszörnyek elleni erő',
  APPLY_ATTBONUS_STONE: 'Metinkövek elleni erő',
  APPLY_ATTBONUS_DEVIL: 'Ördögök elleni erő',
  APPLY_ATTBONUS_ZODIAC: 'Zodiákus szörnyek elleni erő',
  APPLY_ATTBONUS_ELEMENTAL: 'Elementek elleni erő',
  APPLY_ATTBONUS_SUNGMA_STONE: 'Yohara kövek elleni erő',
  APPLY_ATTBONUS_SUNGMA_BOSS: 'Yohara főszörnyek elleni erő',
  APPLY_ITEM_DROP_BONUS: 'Tárgydobási esély',
  APPLY_DOUBLE_DROP: 'Dupla tárgydobás esélye',
  APPLY_GOLD_DOUBLE_BONUS: 'Aranyduplázási esély',
  APPLY_EXP_DOUBLE_BONUS: 'EXP bónusz esélye',
  APPLY_ATT_BONUS_PERCENT: 'Támadó érték',
  APPLY_NORMAL_HIT_DAMAGE_BONUS: 'Normál támadási sebzés',
  APPLY_NORMAL_HIT_DEFEND_BONUS: 'Normál támadással szembeni ellenállás',
  APPLY_SKILL_DAMAGE_BONUS: 'Készségkár',
  APPLY_MELEE_MAGIC_ATTBONUS_PER: 'Mágikus/közelharci támadás',
  APPLY_ENCHANT_DARK: 'Sötétség ereje',
  APPLY_ENCHANT_FIRE: 'Tűz ereje',
  APPLY_ENCHANT_ICE: 'Jég ereje',
  APPLY_ENCHANT_EARTH: 'Föld ereje',
  APPLY_ENCHANT_WIND: 'Szél ereje',
  APPLY_ENCHANT_ELECT: 'Villám ereje',
  APPLY_SUNGMA_STR: 'Sungma erő',
  APPLY_SUNGMA_HP: 'Sungma vit',
  APPLY_STR: 'Erő',
  APPLY_DEX: 'Ügyesség',
  APPLY_INT: 'Intelligencia',
  APPLY_CON: 'Vitalitás',
}

function humanize(type: string): string {
  return type
    .replace(/^APPLY_/, '')
    .toLocaleLowerCase('hu')
    .split('_')
    .map((word) => word.charAt(0).toLocaleUpperCase('hu') + word.slice(1))
    .join(' ')
}

export function bonusLabel(type: string): string {
  return labels[type] ?? humanize(type)
}

function formatBonus(type: string, value: number): string {
  const percent = /PCT|BONUS|ATTBONUS|RESIST|SPEED|DROP|PERCENT|ENCHANT|MELEE_MAGIC/i.test(type)
  return `${value > 0 ? '+' : ''}${value}${percent ? '%' : ''}`
}

export function itemBonuses(item: Item): Bonus[] {
  const result: Bonus[] = []
  for (let index = 0; index < 4; index += 1) {
    const type = item[`apply_type${index}`]
    const rawValue = item[`apply_value${index}`]
    if (typeof type !== 'string' || !type || type === 'APPLY_NONE') continue
    const value = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0)
    if (!Number.isFinite(value)) continue
    result.push({
      type,
      label: bonusLabel(type),
      value,
      display: formatBonus(type, value),
    })
  }
  return result
}

/** Sum by bonus type, keeping flat and percentage bonuses separate. */
export function totalItemBonuses(items: readonly Item[]): Bonus[] {
  const totals = new Map<string, number>()
  for (const item of items) {
    for (const bonus of itemBonuses(item)) {
      totals.set(bonus.type, (totals.get(bonus.type) ?? 0) + bonus.value)
    }
  }
  return [...totals]
    .map(([type, value]) => ({ type, label: bonusLabel(type), value, display: formatBonus(type, value) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'hu') || a.type.localeCompare(b.type))
}
