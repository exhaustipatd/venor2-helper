<script setup lang="ts">
import { computed } from 'vue'
import type { ShopOffer, ShopPrice } from '@/types/domain'
import { currencyName, type CostSource } from '@/utils/cost'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'
import { useMarketStore } from '@/stores/market'
import { formatInteger, itemName } from '@/utils/format'
import ItemIcon from './ItemIcon.vue'
import PriceInput from './PriceInput.vue'
import CurrencyAmount from './CurrencyAmount.vue'

const props = defineProps<{ offer: ShopOffer; sources?: ReadonlyMap<number, CostSource> }>()
const data = useDataStore(),
  user = useUserStore(),
  market = useMarketStore()
const rows = computed(() => {
  const result: Array<{
    key: string
    price: ShopPrice
    parent: number
    depth: number
    source?: CostSource
    cheaper: boolean
  }> = []
  function visit(
    offer: ShopOffer,
    sources: ReadonlyMap<number, CostSource>,
    path: string,
    ancestors: number[],
  ) {
    offer.prices.forEach((price, index) => {
      const source = price.price_type === 3 ? sources.get(price.price_vnum) : undefined
      const marketPrice = price.price_type === 3 ? user.marketPrice(price.price_vnum) : null
      const key = `${path}-${index}-${price.price_vnum}`
      result.push({
        key,
        price,
        parent: offer.item_vnum,
        depth: ancestors.length - 1,
        source,
        cheaper: source?.kind === 'shop' && marketPrice !== null && source.unitCost < marketPrice,
      })
      if (
        source?.kind === 'shop' &&
        source.offer &&
        !ancestors.includes(price.price_vnum) &&
        ancestors.length < 50
      ) {
        visit(source.offer, source.ingredients ?? new Map(), key, [...ancestors, price.price_vnum])
      }
    })
  }
  visit(props.offer, props.sources ?? market.bestCosts, 'root', [props.offer.item_vnum])
  return result
})
</script>
<template>
  <div class="acquisition-ingredients">
    <div class="ingredient-columns" aria-hidden="true">
      <span>Alapanyag / váltás</span><span>Piaci ár / db</span><span>Beszerzés / db</span>
    </div>
    <div
      v-for="row in rows"
      :key="row.key"
      class="ingredient-line"
      :class="{ 'ingredient-line--nested': row.depth > 0, 'ingredient-line--cheaper': row.cheaper }"
    >
      <div class="item-identity" :style="{ '--ingredient-depth': Math.min(row.depth, 2) }">
        <span v-if="row.depth" class="ingredient-branch" aria-hidden="true">↳</span>
        <ItemIcon v-if="row.price.price_type === 3" :vnum="row.price.price_vnum" :size="28" />
        <div>
          <strong>{{
            row.price.price_type === 3
              ? itemName(data.getItem(row.price.price_vnum))
              : currencyName(row.price.price_type)
          }}</strong>
          <small
            >{{ formatInteger(row.price.amount) }}
            {{ row.price.price_type === 3 ? 'db' : currencyName(row.price.price_type)
            }}{{ row.depth ? ` · ${itemName(data.getItem(row.parent))} váltásához` : ' / váltás' }}</small
          >
        </div>
      </div>
      <template v-if="row.price.price_type === 3">
        <div class="ingredient-market">
          <span class="ingredient-mobile-label" aria-hidden="true">Piaci ár / db</span>
          <PriceInput
            compact
            hide-label
            :label="`${itemName(data.getItem(row.price.price_vnum))} piaci ára / db`"
            :model-value="user.priceFor(row.price.price_vnum).marketPrice"
            @update:model-value="user.updatePrice(row.price.price_vnum, $event)"
          />
        </div>
        <div class="ingredient-source">
          <template v-if="row.source?.kind === 'shop'">
            <span class="ingredient-source-npc">Csere · {{ row.source.npcName }}</span>
            <div class="ingredient-exchange-cost" :class="{ positive: row.cheaper }">
              <strong><CurrencyAmount :value="row.source.unitCost" /></strong>
              <span v-if="row.cheaper" class="ingredient-cheaper">✓ olcsóbb</span>
            </div>
          </template>
          <span v-else class="muted">{{ row.source ? 'Játékospiac' : 'Hiányzó ár' }}</span>
        </div>
      </template>
      <span v-else class="ingredient-fixed" :class="{ 'text-warning': row.price.price_type !== 1 }">{{
        row.price.price_type === 1 ? 'Fix költség' : 'Nincs Yang-árfolyam'
      }}</span>
    </div>
    <p v-if="!rows.length" class="ingredients-empty">Nincs szükséges alapanyag vagy fix költség.</p>
  </div>
</template>
<style scoped>
.acquisition-ingredients {
  container-type: inline-size;
}
.ingredient-columns,
.ingredient-line {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(125px, 0.9fr) minmax(0, 1fr);
  gap: 16px;
  align-items: center;
}
.ingredient-columns {
  padding-bottom: 10px;
  font-size: 11px;
  color: var(--muted);
}
.ingredient-line {
  padding: 12px 0;
  border-top: 1px solid var(--line-soft);
}
.ingredient-line--nested {
  border-top: 0;
  padding-block: 8px;
}
.item-identity {
  position: relative;
  padding-left: calc(var(--ingredient-depth) * 12px);
  gap: 8px;
}
.item-identity strong {
  font-size: 12px;
}
.item-identity small {
  font-size: 10px;
  overflow-wrap: anywhere;
}
.ingredient-branch {
  position: absolute;
  left: calc((var(--ingredient-depth) - 1) * 12px);
  color: var(--muted);
  font-size: 13px;
}
.ingredient-market,
.ingredient-source {
  min-width: 0;
}
.ingredient-source {
  font-size: 11px;
  overflow-wrap: anywhere;
}
.ingredient-source-npc {
  display: block;
  margin-bottom: 4px;
  color: var(--muted);
}
.ingredient-exchange-cost {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
}
.ingredient-exchange-cost strong {
  font-size: 13px;
  font-weight: 600;
}
.ingredient-cheaper {
  font-size: 10px;
  white-space: nowrap;
}
.ingredient-fixed {
  grid-column: 2 / -1;
  color: var(--muted);
  font-size: 11px;
}
.ingredient-fixed.text-warning {
  color: var(--amber);
}
.ingredient-mobile-label {
  display: none;
}
.ingredients-empty {
  font-size: 12px;
  margin: 0;
}
@container (max-width: 470px) {
  .ingredient-columns {
    display: none;
  }
  .ingredient-line {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 8px 12px;
  }
  .item-identity {
    grid-column: 1 / -1;
  }
  .ingredient-mobile-label {
    display: block;
    color: var(--muted);
    font-size: 10px;
    margin-bottom: 4px;
  }
  .ingredient-fixed {
    grid-column: 1 / -1;
  }
}
@container (max-width: 320px) {
  .ingredient-line {
    grid-template-columns: minmax(0, 1fr);
  }
  .ingredient-source {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
  }
  .ingredient-source-npc {
    margin: 0;
  }
}
</style>
