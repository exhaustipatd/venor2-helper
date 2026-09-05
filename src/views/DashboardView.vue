<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, ArrowRightLeft, CircleAlert, PawPrint, Store, Tags, WalletCards } from '@lucide/vue'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'
import LoadingState from '@/components/LoadingState.vue'

const dataStore = useDataStore()
const userStore = useUserStore()
const offerCount = computed(() => dataStore.shops.reduce((sum, shop) => sum + shop.offers.length, 0))
const requiredPriceIds = computed(() => {
  const ids = new Set<number>()
  dataStore.shops.forEach((shop) => shop.offers.forEach((offer) => {
    ids.add(offer.item_vnum)
    offer.prices.forEach((price) => {
      if (price.price_type === 3 && price.price_vnum) ids.add(price.price_vnum)
    })
  }))
  return ids
})
const missingPrices = computed(() => [...requiredPriceIds.value].filter((vnum) => userStore.marketPrice(vnum) === null).length)
const ownedCount = computed(() => dataStore.pets.filter((pet) => userStore.isOwned(pet.vnum)).length)
const petProgress = computed(() => dataStore.pets.length ? Math.round((ownedCount.value / dataStore.pets.length) * 100) : 0)
</script>

<template>
  <LoadingState v-if="dataStore.loading" />
  <div v-else>
    <section class="page-heading page-heading--hero">
      <div>
        <span class="eyebrow">VENOR2 SEGÉDLET</span>
        <h1>Minden ár. Minden csere.<br><em>Egy helyen.</em></h1>
        <p>Kövesd a piaci árakat, számold ki az NPC-cseréket, és tartsd számon a kisállat-gyűjteményedet.</p>
      </div>
      <div class="hero-orb" aria-hidden="true"><span>V</span></div>
    </section>

    <div v-if="!dataStore.meta.completeItems" class="notice notice--warning">
      <CircleAlert :size="19" />
      <div><strong>Részleges wiki-adatcsomag</strong><span>{{ dataStore.meta.note }}</span></div>
      <RouterLink to="/beallitasok">Részletek</RouterLink>
    </div>

    <section class="stat-grid">
      <article class="stat-card"><span class="stat-card__icon"><Store /></span><div><small>NPC-K</small><strong>{{ dataStore.npcs.length }}</strong><p>{{ offerCount }} ajánlat</p></div></article>
      <article class="stat-card"><span class="stat-card__icon stat-card__icon--purple"><PawPrint /></span><div><small>KISÁLLATOK</small><strong>{{ ownedCount }}<i>/ {{ dataStore.pets.length }}</i></strong><p>{{ petProgress }}% megszerezve</p></div></article>
      <article class="stat-card"><span class="stat-card__icon stat-card__icon--amber"><Tags /></span><div><small>SAJÁT ÁRAK</small><strong>{{ userStore.pricedItemCount }}</strong><p>mentett tárgy</p></div></article>
      <article class="stat-card"><span class="stat-card__icon stat-card__icon--red"><WalletCards /></span><div><small>HIÁNYZÓ ÁRAK</small><strong>{{ missingPrices }}</strong><p>a teljes számításhoz</p></div></article>
    </section>

    <section class="section-block">
      <div class="section-heading"><div><span class="eyebrow">GYORS ELÉRÉS</span><h2>Hol folytatod?</h2></div></div>
      <div class="action-grid">
        <RouterLink to="/boltok" class="action-card"><Store /><div><h3>NPC-boltok</h3><p>Ajánlatok és valós csereköltségek.</p></div><ArrowRight /></RouterLink>
        <RouterLink to="/osszehasonlitas" class="action-card"><ArrowRightLeft /><div><h3>Cserekereső</h3><p>Legolcsóbb váltások és várható profit.</p></div><ArrowRight /></RouterLink>
        <RouterLink to="/kisallatok" class="action-card"><PawPrint /><div><h3>Kisállat-gyűjtemény</h3><p>Keress név és bónusz alapján.</p></div><ArrowRight /></RouterLink>
        <RouterLink to="/arlista" class="action-card"><Tags /><div><h3>Árlista feltöltése</h3><p>Add meg a tárgyak egységes piaci árát.</p></div><ArrowRight /></RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped src="./DashboardView.css"></style>
