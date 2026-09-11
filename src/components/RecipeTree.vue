<script setup lang="ts">
import { ref } from 'vue'
import type { CostSource } from '@/utils/cost'
import { currencyName } from '@/utils/cost'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'
import { formatInteger, itemName } from '@/utils/format'
import ItemIcon from './ItemIcon.vue'
import CurrencyAmount from './CurrencyAmount.vue'
import PriceInput from './PriceInput.vue'
defineProps<{ source: CostSource; depth?: number }>()
const data = useDataStore(),
  user = useUserStore(),
  expanded = ref(false)
</script>
<template>
  <div class="recipe-node">
    <div class="recipe-node__line">
      <ItemIcon v-if="source.vnum" :vnum="source.vnum" :size="30" />
      <div>
        <strong>{{ source.vnum ? itemName(data.getItem(source.vnum)) : 'Beszerzés' }}</strong
        ><small>{{
          source.kind === 'market'
            ? 'Játékospiac · saját egységár'
            : `${source.npcName} · ${source.offer?.count} db / váltás`
        }}</small>
      </div>
      <CurrencyAmount :value="source.unitCost" />
    </div>
    <PriceInput
      v-if="source.vnum"
      :key="source.vnum"
      compact
      :label="`${itemName(data.getItem(source.vnum))} piaci ára / db`"
      :model-value="user.priceFor(source.vnum).marketPrice"
      @update:model-value="user.updatePrice(source.vnum, $event)"
    />
    <details
      v-if="source.kind === 'shop' && (depth ?? 0) < 50"
      @toggle="expanded = ($event.target as HTMLDetailsElement).open"
    >
      <summary>Alapanyagok és további cserék</summary>
      <div v-if="expanded" class="recipe-node__children">
        <div v-for="(price, index) in source.offer?.prices" :key="index">
          <span class="recipe-quantity"
            >{{ formatInteger(price.amount) }}
            {{ price.price_type === 3 ? 'db szükséges' : currencyName(price.price_type) }}</span
          ><RecipeTree
            v-if="price.price_type === 3 && source.ingredients?.get(price.price_vnum)"
            :source="source.ingredients.get(price.price_vnum)!"
            :depth="(depth ?? 0) + 1"
          />
        </div>
      </div>
    </details>
  </div>
</template>
<style scoped>
.recipe-node {
  min-width: 0;
}
.recipe-node__line {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 0;
}
.recipe-node__line > div {
  flex: 1;
  min-width: 0;
}
.recipe-node strong {
  font-size: 12px;
  display: block;
  overflow-wrap: anywhere;
}
.recipe-node small {
  display: block;
  font-size: 10px;
  color: var(--muted);
}
.recipe-node__line > .currency-amount {
  font-size: 12px;
}
.recipe-node summary {
  font-size: 11px;
}
.recipe-node > .price-input {
  margin-bottom: 10px;
}
.recipe-node__children {
  border-left: 1px solid var(--accent-line);
  padding-left: 12px;
}
.recipe-quantity {
  display: block;
  margin-top: 10px;
  color: var(--gold);
  font-size: 11px;
}
</style>
