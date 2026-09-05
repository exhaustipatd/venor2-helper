<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, ArrowUpRight, Search, ArrowRightLeft, Crown, ShoppingCart } from '@lucide/vue'
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
  <div>
    <header class="page-heading">
      <div>
        <span class="eyebrow">A JÓ CSERE NEM VÉLETLEN</span>
        <h1>Találd meg a jobb utat.</h1>
        <p>
          Piaci vásárlás vagy NPC-váltás? Hasonlítsd össze a költséget, értsd meg az útvonalat, és tervezz
          egész csomagokkal.
        </p>
      </div>
      <span class="badge badge--gold"><ArrowRightLeft :size="14" /> CSEREKERESŐ</span>
    </header>
    <div class="split-layout" :class="{ 'has-selection': !!selection && !!selected }">
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
      <section v-if="selected" :key="selected.vnum" class="browser-content stack">
        <div>
          <button class="button mobile-back" @click="selection = ''">
            <ArrowLeft :size="16" /> Vissza a tárgyakhoz
          </button>
          <div class="compare-identity panel">
            <div class="item-identity">
              <ItemIcon :vnum="selected.vnum" :size="64" />
              <div>
                <span class="overline">TÁRGY #{{ selected.vnum }}</span>
                <h2>{{ itemName(data.getItem(selected.vnum)) }}</h2>
                <small>{{ selected.offers.length }} NPC-váltás + játékospiac</small>
              </div>
            </div>
            <div class="compare-market-input">
              <PriceInput
                label="Piaci egységár"
                :model-value="user.priceFor(selected.vnum).marketPrice"
                @update:model-value="user.updatePrice(selected.vnum, $event)"
              /><PriceStatus :vnum="selected.vnum" />
            </div>
          </div>
        </div>
        <section v-if="best" class="best-route-banner">
          <div class="best-route-icon"><Crown :size="25" /></div>
          <div>
            <span class="eyebrow">LEGJOBB ISMERT EGYSÉGÁR</span>
            <h3>{{ best.kind === 'market' ? 'Közvetlenül a játékospiacról' : best.npcName }}</h3>
            <p>
              {{
                best.kind === 'market'
                  ? 'A megadott piaci ár kedvezőbb vagy azonos.'
                  : 'A megadott árak és a körmentes NPC-útvonalak alapján.'
              }}
            </p>
          </div>
          <strong><CurrencyAmount :value="best.unitCost" /><small>becslés / db</small></strong>
        </section>
        <div class="metrics">
          <article class="metric">
            <span>Legolcsóbb NPC-váltás / db</span
            ><strong><CurrencyAmount :value="selected.offers[0]?.cost.unitCost" /></strong
            ><small>egységár-becslés</small>
          </article>
          <article class="metric">
            <span>Saját piaci ár / db</span
            ><strong><CurrencyAmount :value="user.marketPrice(selected.vnum)" /></strong
            ><small>vételhez és eladáshoz is</small>
          </article>
          <article class="metric">
            <span>Legjobb váltási profit / db</span
            ><strong><CurrencyAmount :value="selected.profit" signed /></strong
            ><small>nem garantált eladási eredmény</small>
          </article>
        </div>
        <QuantityPlanner :vnum="selected.vnum" />
        <div class="panel-heading route-heading">
          <div>
            <span class="eyebrow">AZ ÁR MÖGÖTTI ÚTVONAL</span>
            <h2>Alternatív beszerzések</h2>
          </div>
          <span class="badge">Költség / db szerint</span>
        </div>
        <div class="market-route">
          <ShoppingCart :size="20" />
          <div><strong>Játékospiac</strong><small>Nincs váltási csomag · saját egységár</small></div>
          <CurrencyAmount :value="user.marketPrice(selected.vnum)" />
        </div>
        <OfferCard
          v-for="entry in selected.offers"
          :key="entry.key"
          :offer="entry.offer"
          :shop="entry.shop"
          :featured="
            best?.kind === 'shop' &&
            best.shopVnum === entry.shop.vnum &&
            best.offer?.order === entry.offer.order
          "
        />
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
