<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, CircleAlert, PawPrint, Search, SlidersHorizontal } from '@lucide/vue'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'
import type { ShopOffer, ShopPrice, ShopTab } from '@/types/domain'
import { itemBonuses } from '@/utils/bonuses'
import { calculateBestCosts, calculateOfferCost, type OfferCost } from '@/utils/cost'
import { formatInteger, formatYang, itemName } from '@/utils/format'
import { normalizeSearchText } from '@/utils/search'
import ItemIcon from '@/components/ItemIcon.vue'
import PriceInput from '@/components/PriceInput.vue'
import LoadingState from '@/components/LoadingState.vue'

const dataStore = useDataStore()
const userStore = useUserStore()
const search = ref('')
const selectedBonus = ref('')
const minimumBonus = ref<number | null>(null)
const status = ref<'all' | 'owned' | 'missing'>('all')

type PetExchange = { offer: ShopOffer; shop: ShopTab; cost: OfferCost }

const bestCosts = computed(() => calculateBestCosts(dataStore.shops, (vnum) => userStore.marketPrice(vnum)))
const exchangesByItem = computed(() => {
  const result = new Map<number, PetExchange[]>()
  for (const shop of dataStore.shops) {
    for (const offer of shop.offers) {
      const entries = result.get(offer.item_vnum) ?? []
      entries.push({ offer, shop, cost: calculateOfferCost(offer, bestCosts.value) })
      result.set(offer.item_vnum, entries)
    }
  }
  for (const entries of result.values()) {
    entries.sort((a, b) => {
      if (a.cost.unitCost === null) return 1
      if (b.cost.unitCost === null) return -1
      return a.cost.unitCost === b.cost.unitCost ? 0 : a.cost.unitCost < b.cost.unitCost ? -1 : 1
    })
  }
  return result
})
const petExchanges = computed(() => {
  const result = new Map<number, PetExchange[]>()
  for (const pet of dataStore.pets) {
    const entries = exchangesByItem.value.get(pet.vnum)
    if (entries?.length) result.set(pet.vnum, entries)
  }
  return result
})

const bonusOptions = computed(() => {
  const options = new Map<string, string>()
  dataStore.pets.forEach((pet) => itemBonuses(pet).forEach((bonus) => options.set(bonus.type, bonus.label)))
  return [...options].map(([type, label]) => ({ type, label })).sort((a, b) => a.label.localeCompare(b.label, 'hu'))
})
const filteredPets = computed(() => {
  const term = normalizeSearchText(search.value)
  return dataStore.pets.filter((pet) => {
    const owned = userStore.isOwned(pet.vnum)
    if (status.value === 'owned' && !owned) return false
    if (status.value === 'missing' && owned) return false
    if (term && !normalizeSearchText(itemName(pet)).includes(term)) return false
    if (selectedBonus.value) {
      const bonus = itemBonuses(pet).find((entry) => entry.type === selectedBonus.value)
      if (!bonus || (minimumBonus.value !== null && bonus.value < minimumBonus.value)) return false
    }
    return true
  }).sort((a, b) => Number(userStore.isOwned(b.vnum)) - Number(userStore.isOwned(a.vnum)) || itemName(a).localeCompare(itemName(b), 'hu'))
})
const ownedCount = computed(() => dataStore.pets.filter((pet) => userStore.isOwned(pet.vnum)).length)

function itemPrices(offer: ShopOffer): ShopPrice[] {
  return offer.prices.filter((price) => price.price_type === 3 && price.price_vnum)
}

function fixedYang(offer: ShopOffer): bigint {
  return offer.prices.filter((price) => price.price_type === 1)
    .reduce((sum, price) => sum + BigInt(price.amount), 0n)
}

function otherPrices(offer: ShopOffer): ShopPrice[] {
  return offer.prices.filter((price) => price.price_type !== 1 && !(price.price_type === 3 && price.price_vnum))
}

function missingNames(cost: OfferCost): string {
  return cost.missing.map((vnum) => itemName(dataStore.getItem(vnum))).join(', ')
}

function ingredientExchanges(vnum: number): PetExchange[] {
  return exchangesByItem.value.get(vnum) ?? []
}

function isBestMarket(vnum: number): boolean {
  return bestCosts.value.get(vnum)?.kind === 'market'
}

function isBestExchange(vnum: number, offer: ShopOffer): boolean {
  const source = bestCosts.value.get(vnum)
  return source?.kind === 'shop' && source.offer === offer
}

function profitFor(vnum: number, cost: OfferCost): bigint | null {
  const marketPrice = userStore.marketPrice(vnum)
  return marketPrice === null || cost.unitCost === null ? null : marketPrice - cost.unitCost
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value
}
</script>

<template>
  <LoadingState v-if="dataStore.loading" />
  <div v-else>
    <header class="page-heading page-heading--split">
      <div><span class="eyebrow">GYŰJTEMÉNY</span><h1>Kisállatok</h1><p>Szűrj bónuszokra, hasonlítsd össze az árakat, és jelöld, melyik kisállat van már meg.</p></div>
      <div class="collection-total"><span><PawPrint :size="18" /> Megszerezve</span><strong>{{ ownedCount }} <small>/ {{ dataStore.pets.length }}</small></strong></div>
    </header>

    <div v-if="!dataStore.meta.completePets" class="notice notice--warning">
      <CircleAlert :size="19" /><div><strong>A teljes kisállat-adatcsomag még nincs letöltve</strong><span>Futtasd az <code>npm run sync-data</code> parancsot, amikor a wiki ismét elérhető.</span></div>
    </div>

    <section class="filter-bar">
      <label class="search-field search-field--wide"><Search :size="17" /><input v-model="search" placeholder="Kisállat keresése…" /></label>
      <label class="select-field"><SlidersHorizontal :size="17" /><select v-model="selectedBonus"><option value="">Minden bónusz</option><option v-for="bonus in bonusOptions" :key="bonus.type" :value="bonus.type">{{ bonus.label }}</option></select></label>
      <label v-if="selectedBonus" class="number-field"><span>Legalább</span><input v-model.number="minimumBonus" type="number" placeholder="0" /><b>%</b></label>
      <div class="segmented"><button :class="{ active: status === 'all' }" @click="status = 'all'">Mind</button><button :class="{ active: status === 'owned' }" @click="status = 'owned'">Megvan</button><button :class="{ active: status === 'missing' }" @click="status = 'missing'">Hiányzik</button></div>
    </section>

    <div class="result-line"><strong>{{ filteredPets.length }}</strong> találat</div>
    <section v-if="filteredPets.length" class="pet-grid">
      <article v-for="pet in filteredPets" :key="pet.vnum" class="pet-card" :class="{ owned: userStore.isOwned(pet.vnum) }">
        <button class="ownership" :aria-pressed="userStore.isOwned(pet.vnum)" @click="userStore.toggleOwned(pet.vnum)"><span><Check :size="14" /></span>{{ userStore.isOwned(pet.vnum) ? 'Megvan' : 'Megjelölöm' }}</button>
        <div class="pet-card__visual"><ItemIcon :vnum="pet.vnum" :size="72" :alt="itemName(pet)" /></div>
        <div class="pet-card__title"><h2>{{ itemName(pet) }}</h2><span>#{{ pet.vnum }}</span></div>
        <ul class="bonus-list"><li v-for="bonus in itemBonuses(pet)" :key="bonus.type" :class="{ highlighted: selectedBonus === bonus.type }"><span>{{ bonus.label }}</span><strong>{{ bonus.display }}</strong></li><li v-if="!itemBonuses(pet).length" class="muted">Nincs megadott bónusz</li></ul>

        <section v-if="petExchanges.get(pet.vnum)?.length" class="pet-exchanges">
          <div class="pet-exchanges__heading">
            <span>KIVÁLTÁSI LEHETŐSÉG</span>
            <RouterLink :to="{ path: '/osszehasonlitas', query: { item: pet.vnum } }">Részletek</RouterLink>
          </div>
          <article v-for="(exchange, index) in petExchanges.get(pet.vnum)" :key="`${exchange.shop.vnum}-${exchange.offer.order}`" class="pet-exchange">
            <header><strong>{{ exchange.shop.npc_name }}</strong><span v-if="index === 0 && exchange.cost.unitCost !== null">LEGJOBB</span></header>
            <div class="pet-recipe">
              <div v-for="price in itemPrices(exchange.offer)" :key="`${price.price_vnum}-${price.amount}`" class="pet-recipe__item">
                <ItemIcon :vnum="price.price_vnum" :size="25" />
                <span>{{ itemName(dataStore.getItem(price.price_vnum)) }}</span>
                <strong>×{{ formatInteger(price.amount) }}</strong>

                <div class="pet-ingredient-routes">
                  <section class="pet-acquisition" :class="{ 'pet-acquisition--best': isBestMarket(price.price_vnum) }">
                    <header>
                      <span>Piaci vásárlás</span>
                      <b v-if="isBestMarket(price.price_vnum)">LEGOLCSÓBB</b>
                      <strong v-if="userStore.marketPrice(price.price_vnum) !== null">{{ formatYang(userStore.marketPrice(price.price_vnum)!) }} / db</strong>
                      <strong v-else class="text-warning">Nincs ár</strong>
                    </header>
                    <PriceInput
                      compact
                      label="Piaci egységár"
                      :model-value="userStore.priceFor(price.price_vnum).marketPrice"
                      @update:model-value="userStore.updatePrice(price.price_vnum, $event)"
                    />
                  </section>

                  <section
                    v-for="option in ingredientExchanges(price.price_vnum)"
                    :key="`${option.shop.vnum}-${option.offer.order}`"
                    class="pet-acquisition pet-acquisition--exchange"
                    :class="{ 'pet-acquisition--best': isBestExchange(price.price_vnum, option.offer) }"
                  >
                    <header>
                      <span>Váltás · {{ option.shop.npc_name }}</span>
                      <b v-if="isBestExchange(price.price_vnum, option.offer)">LEGOLCSÓBB</b>
                      <strong v-if="option.cost.unitCost !== null">{{ formatYang(option.cost.unitCost) }} / db</strong>
                      <strong v-else class="text-warning">Nem számolható</strong>
                    </header>
                    <div class="pet-acquisition__recipe">
                      <div v-for="nestedPrice in itemPrices(option.offer)" :key="`${nestedPrice.price_vnum}-${nestedPrice.amount}`" class="pet-acquisition__ingredient">
                        <div>
                          <ItemIcon :vnum="nestedPrice.price_vnum" :size="21" />
                          <span>{{ itemName(dataStore.getItem(nestedPrice.price_vnum)) }}</span>
                          <strong>×{{ formatInteger(nestedPrice.amount) }}</strong>
                        </div>
                        <PriceInput
                          compact
                          label="Alapanyag piaci egységára"
                          :model-value="userStore.priceFor(nestedPrice.price_vnum).marketPrice"
                          @update:model-value="userStore.updatePrice(nestedPrice.price_vnum, $event)"
                        />
                      </div>
                      <div v-if="fixedYang(option.offer) > 0n" class="pet-acquisition__fixed"><span>+ Fix költség</span><strong>{{ formatYang(fixedYang(option.offer)) }}</strong></div>
                      <div v-for="nestedPrice in otherPrices(option.offer)" :key="`${nestedPrice.price_type}-${nestedPrice.amount}`" class="pet-acquisition__fixed pet-acquisition__fixed--warning"><span>+ Nem árazott valuta</span><strong>{{ formatInteger(nestedPrice.amount) }} {{ nestedPrice.price_type === 100 ? 'Gaya' : `#${nestedPrice.price_type}` }}</strong></div>
                    </div>
                  </section>
                </div>
              </div>
              <div v-if="fixedYang(exchange.offer) > 0n" class="pet-recipe__fixed"><span>Fix költség</span><strong>{{ formatYang(fixedYang(exchange.offer)) }}</strong></div>
              <div v-for="price in otherPrices(exchange.offer)" :key="`${price.price_type}-${price.amount}`" class="pet-recipe__fixed pet-recipe__fixed--warning"><span>Nem árazott valuta</span><strong>{{ formatInteger(price.amount) }} {{ price.price_type === 100 ? 'Gaya' : `#${price.price_type}` }}</strong></div>
            </div>
            <footer>
              <div><span>Kiváltási ár</span><strong v-if="exchange.cost.unitCost !== null">{{ formatYang(exchange.cost.unitCost) }}</strong><strong v-else class="text-warning">Nem számolható</strong></div>
              <div v-if="profitFor(pet.vnum, exchange.cost) !== null" class="pet-exchange__profit" :class="{ negative: profitFor(pet.vnum, exchange.cost)! < 0n }"><span>{{ profitFor(pet.vnum, exchange.cost)! >= 0n ? 'Várható profit' : 'Várható veszteség' }}</span><strong>{{ profitFor(pet.vnum, exchange.cost)! >= 0n ? '+' : '−' }}{{ formatYang(absolute(profitFor(pet.vnum, exchange.cost)!)) }}</strong></div>
              <small v-else-if="exchange.cost.missing.length">Hiányzó ár: {{ missingNames(exchange.cost) }}</small>
              <small v-else-if="exchange.cost.unsupportedPriceTypes.length">A külön valuta miatt nem számolható Yangban.</small>
              <small v-else>Add meg a pet piaci árát a profit kiszámításához.</small>
            </footer>
          </article>
        </section>
        <div v-else class="pet-exchanges pet-exchanges--empty">Nincs ismert kiváltási lehetőség.</div>

        <div class="pet-card__prices"><PriceInput compact label="Piaci ár" :model-value="userStore.priceFor(pet.vnum).marketPrice" @update:model-value="userStore.updatePrice(pet.vnum, $event)" /></div>
      </article>
    </section>
    <section v-else class="empty-state"><PawPrint /><h2>{{ dataStore.pets.length ? 'Nincs ilyen kisállat' : 'Még nincs kisállatadat' }}</h2><p>{{ dataStore.pets.length ? 'Módosítsd a keresést vagy a szűrőket.' : 'A felület készen áll; a teljes wiki-adatcsomagot szinkronizálni kell.' }}</p></section>
  </div>
</template>

<style scoped src="./PetsView.css"></style>
