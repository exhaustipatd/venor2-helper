export type Item = {
  vnum: number
  name: string
  locale_name?: string
  type?: string
  sub_type?: string
  apply_type0?: string
  apply_value0?: number
  apply_type1?: string
  apply_value1?: number
  apply_type2?: string
  apply_value2?: number
  apply_type3?: string
  apply_value3?: number
  [key: string]: unknown
}

export type ShopPrice = {
  price_type: 1 | 3 | 100 | number
  amount: number
  price_vnum: number
}

export type ShopOffer = {
  order: number
  item_vnum: number
  count: number
  prices: ShopPrice[]
}

export type ShopTab = {
  vnum: number
  name: string
  coin_type: string
  npc_vnum: number
  npc_name: string
  offers: ShopOffer[]
}

export type WikiMeta = {
  source: string
  generatedAt: string
  completeItems: boolean
  completePets: boolean
  note?: string
}

export type UserPrice = {
  marketPrice: string
  updatedAt: string
  source?: 'manual' | 'game'
}

export type Bonus = {
  type: string
  label: string
  value: number
  display: string
}
