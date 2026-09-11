<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ShopOffer, ShopTab } from '@/types/domain'
import { useMarketStore } from '@/stores/market'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'
import { offerKey, currencyName } from '@/utils/cost'
import { formatInteger, itemName } from '@/utils/format'
import ItemIcon from './ItemIcon.vue'
import RecipeRows from './RecipeRows.vue'
import CurrencyAmount from './CurrencyAmount.vue'
import PriceInput from './PriceInput.vue'
import AcquisitionIngredients from './AcquisitionIngredients.vue'
const props = defineProps<{ offer: ShopOffer; shop: ShopTab; featured?: boolean; editable?: boolean }>()
const market = useMarketStore(),
  data = useDataStore(),
  user = useUserStore(),
  open = ref(false)
const entry = computed(() => market.byKey.get(offerKey(props.shop, props.offer)))
</script>
<template>
  <article class="offer-card" :class="{ featured: featured && !!entry, 'offer-card--editable': editable }">
    <header>
      <div class="item-identity">
        <ItemIcon :vnum="offer.item_vnum" :size="44" />
        <div>
          <strong>{{ editable ? shop.npc_name : itemName(data.getItem(offer.item_vnum)) }}</strong
          ><small
            >{{ editable ? `${offer.order}. ajánlat` : shop.npc_name }} · ×{{ offer.count }} / váltás</small
          >
        </div>
      </div>
      <span v-if="featured" class="badge badge--gold">KIEMELT ÚTVONAL</span>
    </header>
    <p v-if="!entry" class="offer-warning">Inaktív NPC · Ez a váltás nem szerepel a számításokban.</p>
    <div v-if="entry" class="offer-metrics">
      <div>
        <span>Becsült költség / db</span><strong><CurrencyAmount :value="entry.cost.unitCost" /></strong>
      </div>
      <div>
        <span>Becsült profit / db</span><strong><CurrencyAmount :value="entry.profit" signed /></strong>
      </div>
    </div>
    <p v-if="entry && !entry.cost.complete" class="offer-warning">
      {{
        entry.cyclic
          ? 'A jelenlegi alapanyagútvonal visszavezet ehhez a tárgyhoz; ezt a körkörös váltást nem rangsoroljuk.'
          : ''
      }}
      {{ entry.cost.missing.length ? `${entry.cost.missing.length} hiányzó alapanyagár.` : '' }}
      <template v-for="[type, amount] in entry.cost.currencies" :key="type"
        >{{ formatInteger(amount) }} {{ currencyName(type) }}: nincs Yang-árfolyam.
      </template>
    </p>
    <AcquisitionIngredients
      v-if="editable"
      class="detail-disclosure"
      :offer="offer"
      :sources="entry?.source?.ingredients"
    />
    <details v-else class="detail-disclosure" @toggle="open = ($event.target as HTMLDetailsElement).open">
      <summary>Recept és árak szerkesztése</summary>
      <div v-if="open" class="stack">
        <RecipeRows :offer="offer" :sources="entry?.source?.ingredients" /><PriceInput
          :label="`${itemName(data.getItem(offer.item_vnum))} piaci ára`"
          :model-value="user.priceFor(offer.item_vnum).marketPrice"
          @update:model-value="user.updatePrice(offer.item_vnum, $event)"
        /><RouterLink
          v-if="entry"
          class="text-link"
          :to="{ path: '/osszehasonlitas', query: { item: offer.item_vnum } }"
          >Összehasonlítás és mennyiségtervezés →</RouterLink
        >
      </div>
    </details>
  </article>
</template>
<style scoped src="./OfferCard.css"></style>
