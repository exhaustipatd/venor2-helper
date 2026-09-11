<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowLeft, ArrowUpRight, Search, ArrowRightLeft, Calculator } from '@lucide/vue'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'
import { useMarketStore } from '@/stores/market'
import { useQueryState } from '@/composables/useQueryState'
import { normalizeSearchText } from '@/utils/search'
import { itemName } from '@/utils/format'
import ItemIcon from '@/components/ItemIcon.vue'
import PriceInput from '@/components/PriceInput.vue'
import PriceStatus from '@/components/PriceStatus.vue'
import CurrencyAmount from '@/components/CurrencyAmount.vue'
import OfferCard from '@/components/OfferCard.vue'
import QuantityPlanner from '@/components/QuantityPlanner.vue'
const data = useDataStore(),
  user = useUserStore(),
  market = useMarketStore()
const showPlanner = ref(false)
const search = useQueryState('q'),
  selection = useQueryState('item')
const groups = computed(() =>
  [...market.byItem]
    .map(([vnum, offers]) => ({ vnum, offers, profit: offers[0]?.profit ?? null }))
    .sort((a, b) =>
      a.profit === b.profit
        ? itemName(data.getItem(a.vnum)).localeCompare(itemName(data.getItem(b.vnum)), 'hu')
        : a.profit === null
          ? 1
          : b.profit === null
            ? -1
            : a.profit > b.profit
              ? -1
              : 1,
    ),
)
const filtered = computed(() =>
  groups.value.filter((group) =>
    normalizeSearchText(`${itemName(data.getItem(group.vnum))} ${group.vnum}`).includes(
      normalizeSearchText(search.value),
    ),
  ),
)
const selected = computed(
  () => filtered.value.find((group) => group.vnum === Number(selection.value)) ?? filtered.value[0],
)
const best = computed(() => (selected.value ? market.bestCosts.get(selected.value.vnum) : undefined))
</script>
<template>
  <div class="compare-page">
    <header class="page-heading">
      <div>
        <h1>Cserekereső</h1>
      </div>
    </header>
    <div class="split-layout compare-layout" :class="{ 'has-selection': !!selection && !!selected }">
      <aside class="browser-sidebar">
        <label class="search-field"
          ><Search :size="16" /><input
            v-model="search"
            aria-label="Tárgy keresése"
            placeholder="Tárgy vagy VNUM…"
        /></label>
        <p class="result-line">{{ filtered.length }} kiváltható tárgy</p>
        <div class="browser-list">
          <button
            v-for="group in filtered"
            :key="group.vnum"
            :class="{ active: selected?.vnum === group.vnum }"
            :aria-pressed="selected?.vnum === group.vnum"
            @click="selection = String(group.vnum)"
          >
            <ItemIcon :vnum="group.vnum" :size="36" /><span
              ><strong>{{ itemName(data.getItem(group.vnum)) }}</strong
              ><small v-if="group.profit !== null"><CurrencyAmount :value="group.profit" signed /> / db</small
              ><small v-else>{{ group.offers.length }} váltás · hiányzó árak</small></span
            >
          </button>
        </div>
        <p v-if="!filtered.length" class="muted">Nincs találat. Módosítsd a keresést.</p>
      </aside>
      <section v-if="selected" :key="selected.vnum" class="browser-content compare-content">
        <div>
          <button class="button mobile-back" @click="selection = ''">
            <ArrowLeft :size="16" /> Vissza a tárgyakhoz
          </button>
          <div class="compare-identity panel">
            <div class="item-identity">
              <ItemIcon :vnum="selected.vnum" :size="44" />
              <div>
                <span class="overline">TÁRGY #{{ selected.vnum }}</span>
                <h2>{{ itemName(data.getItem(selected.vnum)) }}</h2>
                <small>{{ selected.offers.length }} NPC-váltás + játékospiac</small>
              </div>
            </div>
            <div class="compare-tools">
              <div class="compare-market-input">
                <PriceInput
                  label="Piaci egységár"
                  :model-value="user.priceFor(selected.vnum).marketPrice"
                  @update:model-value="user.updatePrice(selected.vnum, $event)"
                /><PriceStatus :vnum="selected.vnum" />
              </div>
              <button
                class="button"
                :class="{ 'button--primary': showPlanner }"
                :aria-expanded="showPlanner"
                aria-controls="compare-planner"
                @click="showPlanner = !showPlanner"
              >
                <Calculator :size="16" /> Mennyiségtervező
              </button>
            </div>
          </div>
        </div>
        <div class="compare-summary">
          <div>
            <span>Legjobb ismert beszerzés / db</span>
            <strong><CurrencyAmount :value="best?.unitCost" /></strong>
            <small>{{
              best ? (best.kind === 'market' ? 'Játékospiac' : best.npcName) : 'Add meg az alapanyagárakat'
            }}</small>
          </div>
          <div>
            <span>Legolcsóbb NPC-váltás / db</span>
            <strong><CurrencyAmount :value="selected.offers[0]?.cost.unitCost" /></strong>
            <small>Egységár-becslés</small>
          </div>
          <div>
            <span>Legjobb váltási profit / db</span>
            <strong><CurrencyAmount :value="selected.profit" signed /></strong>
            <small>Becslés a saját piaci ár alapján</small>
          </div>
        </div>
        <div class="compare-workspace" :class="{ 'compare-workspace--planning': showPlanner }">
          <section class="compare-offers">
            <div class="panel-heading route-heading">
              <h2>Cserék és alapanyagárak</h2>
              <span class="badge">Költség / db szerint</span>
            </div>
            <div class="compare-offer-grid">
              <OfferCard
                v-for="entry in selected.offers"
                :key="entry.key"
                :offer="entry.offer"
                :shop="entry.shop"
                npc-heading
                hide-item-price
                :featured="
                  best?.kind === 'shop' &&
                  best.shopVnum === entry.shop.vnum &&
                  best.offer?.order === entry.offer.order
                "
              />
            </div>
          </section>
          <QuantityPlanner v-if="showPlanner" id="compare-planner" :vnum="selected.vnum" />
        </div>
        <RouterLink class="text-link" to="/arlista"
          >Az összes saját ár szerkesztése <ArrowUpRight :size="13"
        /></RouterLink>
      </section>
      <section v-else class="empty-state">
        <ArrowRightLeft :size="30" />
        <h2>Nincs ilyen tárgy</h2>
        <p>Próbálj másik nevet vagy VNUM-ot.</p>
      </section>
    </div>
  </div>
</template>
<style scoped src="./CompareView.css"></style>
