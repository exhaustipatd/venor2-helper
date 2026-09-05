<script setup lang="ts">
import type { ShopOffer } from '@/types/domain'
import { currencyName, type CostSource } from '@/utils/cost'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'
import { useMarketStore } from '@/stores/market'
import { formatInteger, itemName } from '@/utils/format'
import ItemIcon from './ItemIcon.vue'
import PriceInput from './PriceInput.vue'
import RecipeTree from './RecipeTree.vue'
const props = defineProps<{ offer: ShopOffer; sources?: ReadonlyMap<number, CostSource> }>()
const data = useDataStore(),
  user = useUserStore(),
  market = useMarketStore()
const sourceFor = (id: number) => (props.sources ?? market.bestCosts).get(id)
</script>
<template>
  <div class="recipe-rows">
    <div v-for="(price, index) in offer.prices" :key="index" class="recipe-row">
      <template v-if="price.price_type === 3"
        ><div class="item-identity">
          <ItemIcon :vnum="price.price_vnum" :size="36" />
          <div>
            <strong>{{ itemName(data.getItem(price.price_vnum)) }}</strong
            ><small>×{{ formatInteger(price.amount) }} / váltás</small>
          </div>
        </div>
        <PriceInput
          compact
          :label="`${itemName(data.getItem(price.price_vnum))} piaci ára`"
          :model-value="user.priceFor(price.price_vnum).marketPrice"
          @update:model-value="user.updatePrice(price.price_vnum, $event)" />
        <details v-if="sourceFor(price.price_vnum)" class="recipe-row__source">
          <summary>Beszerzési útvonal megtekintése</summary>
          <RecipeTree :source="sourceFor(price.price_vnum)!" /></details></template
      ><template v-else
        ><span>{{ price.price_type === 1 ? 'Fix költség / váltás' : 'Nem árazott valuta / váltás' }}</span
        ><strong :class="{ 'text-warning': price.price_type !== 1 }"
          >{{ formatInteger(price.amount) }} {{ currencyName(price.price_type) }}</strong
        ></template
      >
    </div>
  </div>
</template>
<style scoped>
.recipe-rows {
  display: grid;
  gap: 12px;
}
.recipe-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(140px, 0.65fr);
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--line-soft);
  border-radius: 9px;
  background: var(--panel-soft);
  align-items: center;
}
.recipe-row > span,
.recipe-row > strong {
  font-size: 12px;
}
.recipe-row__source {
  grid-column: 1 / -1;
}
.recipe-row__source summary {
  font-size: 11px;
}
@media (max-width: 560px) {
  .recipe-row {
    grid-template-columns: 1fr;
  }
}
</style>
