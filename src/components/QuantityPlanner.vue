<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ShoppingBasket, ArrowRightLeft } from '@lucide/vue'
import { useMarketStore } from '@/stores/market'
import { useUserStore } from '@/stores/user'
import { useDataStore } from '@/stores/data'
import { planAcquisition, type CostSource } from '@/utils/cost'
import { formatInteger, itemName } from '@/utils/format'
import CurrencyAmount from './CurrencyAmount.vue'
const props = defineProps<{ vnum: number }>()
const market = useMarketStore(),
  user = useUserStore(),
  data = useDataStore()
const quantity = ref('1'),
  routeKey = ref('auto')
watch(
  () => props.vnum,
  () => {
    routeKey.value = 'auto'
  },
)
const valid = computed(() => /^[1-9]\d{0,8}$/.test(quantity.value))
const routes = computed(() => {
  const candidates: Array<{ key: string; label: string; source: CostSource }> = []
  const price = user.marketPrice(props.vnum)
  if (price !== null)
    candidates.push({
      key: 'market',
      label: 'Játékospiac',
      source: { vnum: props.vnum, unitCost: price, kind: 'market' },
    })
  for (const entry of market.byItem.get(props.vnum) ?? [])
    if (entry.source)
      candidates.push({
        key: entry.key,
        label: `${entry.shop.npc_name} · ${entry.offer.order}. ajánlat (bolt #${entry.shop.vnum})`,
        source: entry.source,
      })
  return candidates
})
const plans = computed(() =>
  valid.value
    ? routes.value
        .map((route) => ({
          ...route,
          plan: planAcquisition(props.vnum, BigInt(quantity.value), route.source),
        }))
        .sort((a, b) =>
          a.plan.totalCost === b.plan.totalCost
            ? a.key.localeCompare(b.key)
            : a.plan.totalCost < b.plan.totalCost
              ? -1
              : 1,
        )
    : [],
)
watch(routes, (available) => {
  if (routeKey.value !== 'auto' && !available.some((route) => route.key === routeKey.value))
    routeKey.value = 'auto'
})
const selected = computed(() =>
  routeKey.value === 'auto' ? plans.value[0] : plans.value.find((plan) => plan.key === routeKey.value),
)
const profit = computed(() =>
  selected.value && user.marketPrice(props.vnum) !== null
    ? user.marketPrice(props.vnum)! * BigInt(quantity.value) - selected.value.plan.totalCost
    : null,
)
</script>
<template>
  <section class="quantity-planner panel">
    <div class="panel-heading">
      <div>
        <h2>Mennyiségtervező</h2>
      </div>
      <ShoppingBasket :size="22" class="positive" />
    </div>
    <p class="planner-description">
      Egész váltási csomagokkal számol, a megmaradó alapanyagokat újra felhasználja.
    </p>
    <div class="planner-controls">
      <label
        >Mennyiség<input
          v-model="quantity"
          type="text"
          inputmode="numeric"
          maxlength="9"
          :aria-invalid="!valid"
          :aria-describedby="!valid ? 'quantity-hint' : undefined" /></label
      ><label
        >Beszerzési út<select v-model="routeKey">
          <option value="auto">Legolcsóbb a kiszámolt tervek közül</option>
          <option v-for="route in routes" :key="route.key" :value="route.key">{{ route.label }}</option>
        </select></label
      >
    </div>
    <p v-if="!valid" id="quantity-hint" class="negative" role="alert">
      Adj meg 1 és 999 999 999 közötti egész mennyiséget.
    </p>
    <div v-if="selected" class="planner-result">
      <div class="planner-total">
        <span
          >Szükséges Yang<small>{{ selected.label }}</small></span
        ><strong><CurrencyAmount :value="selected.plan.totalCost" /></strong>
      </div>
      <p class="planner-profit">
        Becsült eredmény {{ quantity }} db eladásakor: <CurrencyAmount :value="profit" signed />. A maradékot
        nem számítjuk eladásnak.
      </p>
      <details>
        <summary>Bevásárlólista és lépések</summary>
        <div class="plan-lines">
          <div v-for="[id, purchase] in selected.plan.purchases" :key="id">
            <ShoppingBasket :size="14" /><span
              >{{ itemName(data.getItem(id)) }} ×{{ formatInteger(purchase.quantity) }}</span
            ><CurrencyAmount :value="purchase.cost" />
          </div>
          <div v-for="(exchange, index) in selected.plan.exchanges" :key="index">
            <ArrowRightLeft :size="14" /><span
              >{{ exchange.source.npcName }} → {{ itemName(data.getItem(exchange.source.vnum!)) }}</span
            ><strong>{{ formatInteger(exchange.batches) }} váltás</strong>
          </div>
        </div>
        <h3 v-if="selected.plan.leftovers.size" class="leftover-heading">Megmaradó tárgyak</h3>
        <div v-for="[id, count] in selected.plan.leftovers" :key="id" class="leftover-line">
          {{ itemName(data.getItem(id)) }} <strong>×{{ formatInteger(count) }}</strong>
        </div>
      </details>
    </div>
    <p v-else-if="valid" class="notice notice--warning">
      Ehhez az útvonalhoz még nincs teljes, körmentes Yang-költség. Add meg a hiányzó árakat, vagy válassz
      másik útvonalat.
    </p>
    <p class="planner-note">
      A tervező nem vizsgál minden receptkombinációt, és kizárja a körkörös váltásokat. Készletet, adót és
      piaci elérhetőséget nem vesz figyelembe.
    </p>
  </section>
</template>
<style scoped>
.planner-description {
  font-size: 12px;
}
.planner-controls {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 14px;
}
.planner-controls label {
  display: grid;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
}
.planner-controls input,
.planner-controls select {
  min-height: 46px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px;
  background: var(--input-bg);
  color: var(--text);
  width: 100%;
}
.planner-result {
  margin: 20px 0;
  padding: 18px;
  border: 1px solid var(--accent-line);
  border-radius: 10px;
  background: var(--accent-bg-soft);
}
.planner-total {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
}
.planner-total span {
  font-size: 13px;
}
.planner-total small {
  display: block;
  color: var(--muted);
  font-size: 11px;
}
.planner-total strong {
  font-size: 24px;
}
.planner-profit {
  margin: 12px 0;
  font-size: 11px;
}
.planner-note {
  font-size: 11px;
  color: var(--muted);
  margin: 16px 0 0;
}
.plan-lines > div {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
  font-size: 11px;
}
.plan-lines > div > span:first-of-type {
  flex: 1;
}
.leftover-heading {
  font-size: 13px;
  margin-top: 20px;
}
.leftover-line {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 5px 0;
}
@media (max-width: 560px) {
  .planner-controls {
    grid-template-columns: 1fr;
  }
  .planner-total {
    align-items: start;
    flex-direction: column;
  }
}
</style>
