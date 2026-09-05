<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, CircleAlert, Coins, TrendingUp } from '@lucide/vue'
import type { ShopOffer } from '@/types/domain'
import type { CostSource } from '@/utils/cost'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'
import { useOfferCost } from '@/composables/useOfferCost'
import { formatInteger, formatYang, itemName } from '@/utils/format'
import ItemIcon from './ItemIcon.vue'
import PriceInput from './PriceInput.vue'

const props = defineProps<{ offer: ShopOffer; bestCosts: ReadonlyMap<number, CostSource> }>()
const dataStore = useDataStore()
const userStore = useUserStore()
const cost = useOfferCost(() => props.offer, () => props.bestCosts)

const itemPrices = computed(() => props.offer.prices.filter((price) => price.price_type === 3 && price.price_vnum))
const fixedYang = computed(() => props.offer.prices
  .filter((price) => price.price_type === 1)
  .reduce((sum, price) => sum + BigInt(price.amount), 0n))
const fixedGaya = computed(() => props.offer.prices
  .filter((price) => price.price_type === 100)
  .reduce((sum, price) => sum + BigInt(price.amount), 0n))
const resultItem = computed(() => dataStore.getItem(props.offer.item_vnum))
</script>

<template>
  <article class="offer-card">
    <header class="offer-card__header">
      <div class="item-identity">
        <ItemIcon :vnum="offer.item_vnum" :size="48" :alt="itemName(resultItem)" />
        <div>
          <span class="overline">KAPOTT TÁRGY</span>
          <h3>{{ itemName(resultItem) }}</h3>
          <small>#{{ offer.item_vnum }}</small>
        </div>
      </div>
      <span class="quantity">×{{ offer.count }}</span>
    </header>

    <div class="offer-card__body">
      <div class="ingredient-list">
        <div v-for="price in itemPrices" :key="`${price.price_vnum}-${price.amount}`" class="ingredient">
          <ItemIcon :vnum="price.price_vnum" :size="36" />
          <div class="ingredient__name">
            <div><strong>{{ itemName(dataStore.getItem(price.price_vnum)) }}</strong><span>×{{ formatInteger(price.amount) }}</span></div>
            <small v-if="cost.sources.get(price.price_vnum)" :class="{ 'ingredient__source--shop': cost.sources.get(price.price_vnum)?.kind === 'shop' }">
              {{ cost.sources.get(price.price_vnum)?.kind === 'shop' ? 'Kiváltva' : 'Piac' }}:
              {{ formatYang(cost.sources.get(price.price_vnum)!.unitCost) }} / db
              <template v-if="cost.sources.get(price.price_vnum)?.kind === 'shop'"> · {{ cost.sources.get(price.price_vnum)?.npcName }}</template>
            </small>
            <small v-else class="text-warning">Nincs piaci vagy kiváltási ár</small>
          </div>
          <PriceInput
            compact
            label="Piaci egységár"
            :model-value="userStore.priceFor(price.price_vnum).marketPrice"
            @update:model-value="userStore.updatePrice(price.price_vnum, $event)"
          />
        </div>

        <div v-if="fixedYang > 0" class="fixed-cost">
          <Coins :size="17" />
          <span>Fix költség</span>
          <strong>{{ formatYang(fixedYang) }}</strong>
        </div>
        <div v-if="fixedGaya > 0" class="fixed-cost fixed-cost--gaya">
          <span class="gaya-dot">G</span>
          <span>Gaya költség</span>
          <strong>{{ formatInteger(fixedGaya) }} Gaya</strong>
        </div>
        <div v-if="!itemPrices.length && fixedYang === 0n && fixedGaya === 0n" class="fixed-cost">
          <span>Ingyenes ajánlat</span>
        </div>
      </div>

      <ArrowRight class="offer-card__arrow" :size="19" />

      <div class="offer-summary">
        <div>
          <span>Teljes költség</span>
          <strong v-if="cost.complete">{{ formatYang(cost.yang) }}</strong>
          <strong v-else class="text-warning">Nem számolható</strong>
          <small v-if="cost.perItem !== null && offer.count > 1">{{ formatYang(cost.perItem) }} / db</small>
          <small v-else-if="cost.missing.length" class="missing-line"><CircleAlert :size="13" /> {{ cost.missing.length }} hiányzó ár</small>
          <small v-if="cost.gaya > 0">+ {{ formatInteger(cost.gaya) }} Gaya</small>
        </div>
        <PriceInput
          compact
          label="Piaci egységár"
          :model-value="userStore.priceFor(offer.item_vnum).marketPrice"
          @update:model-value="userStore.updatePrice(offer.item_vnum, $event)"
        />
        <div v-if="cost.profit !== null" class="profit" :class="{ 'profit--negative': cost.profit < 0n }">
          <TrendingUp :size="15" />
          <span>{{ cost.profit >= 0n ? 'Profit' : 'Veszteség' }}</span>
          <strong>{{ formatYang(cost.profit < 0n ? -cost.profit : cost.profit) }}</strong>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped src="./OfferCard.css"></style>
