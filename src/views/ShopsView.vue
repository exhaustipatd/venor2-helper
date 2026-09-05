<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Search, Store, MapPin } from '@lucide/vue'
import { useDataStore } from '@/stores/data'
import { useQueryState } from '@/composables/useQueryState'
import { normalizeSearchText } from '@/utils/search'
import { itemName } from '@/utils/format'
import type { ShopOffer } from '@/types/domain'
import OfferCard from '@/components/OfferCard.vue'
const data = useDataStore(),
  route = useRoute(),
  router = useRouter()
function selectNpc(id: number) {
  void router.replace({ query: { ...route.query, npc: String(id), tab: undefined } })
}
const search = useQueryState('q'),
  selection = useQueryState('npc'),
  tabSelection = useQueryState('tab', 'all')
const term = computed(() => normalizeSearchText(search.value))
const matchesOffer = (offer: ShopOffer) =>
  normalizeSearchText(`${itemName(data.getItem(offer.item_vnum))} ${offer.item_vnum}`).includes(term.value)
const matchesNpc = (npc: { name: string; vnum: number }) =>
  normalizeSearchText(`${npc.name} ${npc.vnum}`).includes(term.value)
const filtered = computed(() =>
  data.npcs.filter((npc) => matchesNpc(npc) || npc.tabs.some((tab) => tab.offers.some(matchesOffer))),
)
const selected = computed(
  () => filtered.value.find((npc) => npc.vnum === Number(selection.value)) ?? filtered.value[0],
)
const tabs = computed(
  () =>
    selected.value?.tabs
      .filter((tab) => tabSelection.value === 'all' || tab.vnum === Number(tabSelection.value))
      .map((tab) => ({
        ...tab,
        offers: tab.offers.filter((offer) => matchesNpc(selected.value!) || matchesOffer(offer)),
      }))
      .filter((tab) => tab.offers.length) ?? [],
)
</script>
<template>
  <div>
    <header class="page-heading">
      <div>
        <span class="eyebrow">MINDEN KERESKEDŐ, EGY HELYEN</span>
        <h1>A kereskedők világa.</h1>
        <p>
          Böngéssz az NPC-k kínálatában. A receptek és az ármezők csak akkor nyílnak meg, amikor szükséged van
          rájuk.
        </p>
      </div>
      <span class="badge"><Store :size="14" /> {{ data.npcs.length }} NPC</span>
    </header>
    <div class="split-layout" :class="{ 'has-selection': !!selection && !!selected }">
      <aside class="browser-sidebar">
        <label class="search-field"
          ><Search :size="16" /><input
            v-model="search"
            aria-label="NPC vagy ajánlat keresése"
            placeholder="NPC, tárgy vagy VNUM…"
        /></label>
        <p class="result-line">{{ filtered.length }} kereskedő</p>
        <div class="browser-list">
          <button
            v-for="npc in filtered"
            :key="npc.vnum"
            :class="{ active: selected?.vnum === npc.vnum }"
            :aria-pressed="selected?.vnum === npc.vnum"
            @click="selectNpc(npc.vnum)"
          >
            <span class="npc-avatar"><Store :size="17" /></span
            ><span
              ><strong>{{ npc.name }}</strong
              ><small>{{ npc.offerCount }} ajánlat</small></span
            >
          </button>
        </div>
        <p v-if="!filtered.length" class="muted">Nincs találat.</p>
      </aside>
      <section v-if="selected" class="browser-content">
        <button class="button mobile-back" @click="selection = ''">
          <ArrowLeft :size="16" /> Vissza a kereskedőkhöz
        </button>
        <header class="merchant-header">
          <span class="merchant-mark"><Store :size="32" /></span>
          <div>
            <span class="eyebrow"><MapPin :size="12" /> NPC #{{ selected.vnum }}</span>
            <h2>{{ selected.name }}</h2>
            <p>{{ selected.tabs.length }} boltfül · {{ selected.offerCount }} ajánlat</p>
          </div>
        </header>
        <div v-if="selected.tabs.length > 1" class="shop-tabs">
          <button class="button" :aria-pressed="tabSelection === 'all'" @click="tabSelection = 'all'">
            Összes</button
          ><button
            v-for="tab in selected.tabs"
            :key="tab.vnum"
            class="button"
            :aria-pressed="tabSelection === String(tab.vnum)"
            @click="tabSelection = String(tab.vnum)"
          >
            {{ tab.name }}
          </button>
        </div>
        <section v-for="tab in tabs" :key="tab.vnum" class="shop-section">
          <div class="panel-heading">
            <h3>{{ tab.name }}</h3>
            <span class="badge">{{ tab.offers.length }} ajánlat</span>
          </div>
          <div class="shop-offers">
            <OfferCard v-for="offer in tab.offers" :key="offer.order" :offer="offer" :shop="tab" />
          </div>
        </section>
        <div v-if="!tabs.length" class="empty-state">
          <h2>Nincs ajánlat ezen a fülön</h2>
          <button class="button" @click="tabSelection = 'all'">Összes boltfül</button>
        </div>
      </section>
      <section v-else class="empty-state">
        <Store :size="30" />
        <h2>Nincs ilyen kereskedő vagy ajánlat</h2>
        <p>Próbálj másik nevet vagy VNUM-ot.</p>
      </section>
    </div>
  </div>
</template>
<style scoped src="./ShopsView.css"></style>
