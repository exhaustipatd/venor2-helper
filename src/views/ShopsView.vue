<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Search, Store } from '@lucide/vue'
import { useRoute, useRouter } from 'vue-router'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'
import { calculateBestCosts } from '@/utils/cost'
import { normalizeSearchText } from '@/utils/search'
import OfferCard from '@/components/OfferCard.vue'
import LoadingState from '@/components/LoadingState.vue'

const dataStore = useDataStore()
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()
const search = ref('')
const selectedVnum = ref<number | null>(Number(route.query.npc) || null)

const bestCosts = computed(() => calculateBestCosts(dataStore.shops, (vnum) => userStore.marketPrice(vnum)))
const filteredNpcs = computed(() => {
  const term = normalizeSearchText(search.value)
  return term ? dataStore.npcs.filter((npc) => normalizeSearchText(npc.name).includes(term) || String(npc.vnum).includes(term)) : dataStore.npcs
})
const selected = computed(() => dataStore.npcs.find((npc) => npc.vnum === selectedVnum.value) ?? filteredNpcs.value[0])
watch(selected, (npc) => {
  if (!npc || npc.vnum === selectedVnum.value) return
  selectedVnum.value = npc.vnum
}, { immediate: true })
watch(selectedVnum, (npc) => router.replace({ query: npc ? { npc } : {} }))
</script>

<template>
  <LoadingState v-if="dataStore.loading" />
  <div v-else>
    <header class="page-heading">
      <div><span class="eyebrow">KERESKEDŐK ÉS CSERÉK</span><h1>NPC-boltok</h1><p>Válassz kereskedőt, töltsd ki az alapanyagárakat, és azonnal látod a teljes költséget.</p></div>
    </header>

    <div class="browser-layout">
      <aside class="browser-sidebar">
        <label class="search-field"><Search :size="17" /><input v-model="search" placeholder="NPC keresése…" /></label>
        <div class="browser-sidebar__count">{{ filteredNpcs.length }} kereskedő</div>
        <div class="npc-list">
          <button v-for="npc in filteredNpcs" :key="npc.vnum" :class="{ active: selected?.vnum === npc.vnum }" @click="selectedVnum = npc.vnum">
            <span class="npc-avatar"><Store :size="17" /></span>
            <span><strong>{{ npc.name }}</strong><small>{{ npc.offerCount }} ajánlat</small></span>
          </button>
        </div>
      </aside>

      <section v-if="selected" class="browser-content">
        <header class="merchant-header">
          <span class="merchant-header__icon"><Store :size="27" /></span>
          <div><span class="overline">NPC #{{ selected.vnum }}</span><h2>{{ selected.name }}</h2><p>{{ selected.offerCount }} elérhető ajánlat</p></div>
        </header>
        <div v-for="tab in selected.tabs" :key="tab.vnum" class="shop-tab">
          <div v-if="selected.tabs.length > 1" class="shop-tab__title"><h3>{{ tab.name }}</h3><span>{{ tab.offers.length }} ajánlat</span></div>
          <div class="offer-list"><OfferCard v-for="offer in tab.offers" :key="`${tab.vnum}-${offer.order}`" :offer="offer" :best-costs="bestCosts" /></div>
        </div>
      </section>
      <section v-else class="empty-state"><Store /><h2>Nincs találat</h2><p>Próbálj másik keresőkifejezést.</p></section>
    </div>
  </div>
</template>

<style scoped src="./ShopsView.css"></style>
