import type { Item, ShopTab, WikiMeta } from '../types/domain'
export function validateItems(value: unknown, allowEmpty?: boolean): Item[]
export function validateShops(value: unknown, allowEmpty?: boolean): ShopTab[]
export function validateMeta(value: unknown): WikiMeta
export function validateIcons(value: unknown): Record<string, string>
export function applyShopOverrides(shops: ShopTab[], overrides: ShopTab[]): ShopTab[]
export function validateReferences(items: Item[], shops: ShopTab[]): number[]
