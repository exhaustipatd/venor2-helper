<script setup lang="ts">
import { computed } from 'vue'
import { Check, PawPrint, Search, SlidersHorizontal, Target, ArrowUpRight } from '@lucide/vue'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'
import { useMarketStore } from '@/stores/market'
import { useQueryState } from '@/composables/useQueryState'
import { itemBonuses, bonusLabel, totalItemBonuses } from '@/utils/bonuses'
import { itemName } from '@/utils/format'
import { normalizeSearchText } from '@/utils/search'
import ItemIcon from '@/components/ItemIcon.vue'
import DetailPanel from '@/components/DetailPanel.vue'
import CurrencyAmount from '@/components/CurrencyAmount.vue'
import PriceInput from '@/components/PriceInput.vue'
import PriceStatus from '@/components/PriceStatus.vue'
import OfferCard from '@/components/OfferCard.vue'
const data = useDataStore(),
  user = useUserStore(),
  market = useMarketStore()
const search = useQueryState('q'),
  bonus = useQueryState('bonus'),
  minimum = useQueryState('min'),
  status = useQueryState('status', 'all'),
  selection = useQueryState('pet')
const statuses = [
  { key: 'all', label: 'Mind' },
  { key: 'owned', label: 'Megvan' },
  { key: 'missing', label: 'Hiányzik' },
  { key: 'target', label: 'Céljaim' },
]
const bonusOptions = computed(() =>
  [...new Set(data.pets.flatMap((p) => itemBonuses(p).map((b) => b.type)))].sort((a, b) =>
    bonusLabel(a).localeCompare(bonusLabel(b), 'hu'),
  ),
)
const filtered = computed(() =>
  data.pets
    .filter((pet) => {
      if (status.value === 'owned' && !user.isOwned(pet.vnum)) return false
      if (status.value === 'missing' && user.isOwned(pet.vnum)) return false
      if (status.value === 'target' && !user.isTarget(pet.vnum)) return false
      if (!normalizeSearchText(`${itemName(pet)} ${pet.vnum}`).includes(normalizeSearchText(search.value)))
        return false
      return (
        !bonus.value ||
        itemBonuses(pet).some(
          (b) => b.type === bonus.value && (!minimum.value || b.value >= Number(minimum.value)),
        )
      )
    })
    .sort(
      (a, b) =>
        Number(user.isTarget(b.vnum)) - Number(user.isTarget(a.vnum)) ||
        itemName(a).localeCompare(itemName(b), 'hu'),
    ),
)
const ownedPets = computed(() => data.pets.filter((pet) => user.isOwned(pet.vnum)))
const owned = computed(() => ownedPets.value.length)
const ownedBonuses = computed(() => totalItemBonuses(ownedPets.value))
const progress = computed(() => (data.pets.length ? Math.round((owned.value / data.pets.length) * 100) : 0))
const selected = computed(() => data.pets.find((pet) => pet.vnum === Number(selection.value)))
function bestPrice(id: number) {
  return market.bestCosts.get(id)?.unitCost ?? user.marketPrice(id)
}
</script>
<template>
  <div>
    <header class="page-heading">
      <div>
        <h1>Kisállatok</h1>
      </div>
      <div class="collection-total">
        <span><PawPrint :size="16" /> MEGSZEREZVE</span
        ><strong
          >{{ owned }} <small>/ {{ data.pets.length }}</small></strong
        >
        <div class="progress-track"><span :style="{ width: `${progress}%` }" /></div>
      </div>
    </header>
    <div v-if="!data.meta.completePets" class="notice notice--warning">
      A kisállat-adatcsomag részleges. A hiányzó adatokat az alkalmazás karbantartója frissíti.
    </div>
    <section class="panel owned-bonuses" aria-labelledby="owned-bonuses-heading">
      <h2 id="owned-bonuses-heading">Meglévő kisállatok összes bónusza</h2>
      <dl v-if="ownedBonuses.length" class="owned-bonuses__list">
        <div v-for="entry in ownedBonuses" :key="entry.type">
          <dt>{{ entry.label }}</dt>
          <dd>{{ entry.display }}</dd>
        </div>
      </dl>
      <p v-else class="muted">
        {{ owned ? 'A megjelölt kisállatokhoz nincs bónuszadat.' : 'Még nincs „Megvan” jelölésű kisállat.' }}
      </p>
    </section>
    <section class="filter-bar">
      <label class="search-field"
        ><Search :size="16" /><input
          v-model="search"
          aria-label="Kisállat keresése"
          placeholder="Név vagy VNUM…" /></label
      ><label class="select-field"
        ><SlidersHorizontal :size="16" /><select v-model="bonus" aria-label="Bónusz szűrő">
          <option value="">Minden bónusz</option>
          <option v-for="type in bonusOptions" :key="type" :value="type">{{ bonusLabel(type) }}</option>
        </select></label
      ><label v-if="bonus" class="bonus-minimum"
        >Minimum érték<input v-model="minimum" type="number" min="0" placeholder="0"
      /></label>
      <div class="segmented" aria-label="Gyűjtemény szűrő">
        <button
          v-for="entry in statuses"
          :key="entry.key"
          :class="{ active: status === entry.key }"
          :aria-pressed="status === entry.key"
          @click="status = entry.key"
        >
          {{ entry.label }}
        </button>
      </div>
    </section>
    <p class="result-line">
      <strong>{{ filtered.length }}</strong> kisállat
    </p>
    <section v-if="filtered.length" class="pet-grid">
      <article
        v-for="pet in filtered"
        :key="pet.vnum"
        class="pet-card"
        :class="{ owned: user.isOwned(pet.vnum), targeted: user.isTarget(pet.vnum) }"
      >
        <div class="pet-card__top">
          <span class="pet-number">#{{ pet.vnum }}</span
          ><button
            class="target-button"
            :class="{ active: user.isTarget(pet.vnum) }"
            :aria-label="`${itemName(pet)}: gyűjteménycél`"
            :aria-pressed="user.isTarget(pet.vnum)"
            @click="user.toggleTarget(pet.vnum)"
          >
            <Target :size="17" />
          </button>
        </div>
        <button
          class="pet-open"
          :aria-label="`${itemName(pet)} részletei`"
          @click="selection = String(pet.vnum)"
        >
          <span class="pet-stage"><span class="pet-halo" /><ItemIcon :vnum="pet.vnum" :size="78" /></span>
          <h2>{{ itemName(pet) }}</h2>
        </button>
        <ul class="bonus-list">
          <li
            v-for="entry in itemBonuses(pet)"
            :key="entry.type"
            :class="{ highlighted: entry.type === bonus }"
          >
            <span>{{ entry.label }}</span
            ><strong>{{ entry.display }}</strong>
          </li>
          <li v-if="!itemBonuses(pet).length" class="muted">Nincs megadott bónusz</li>
        </ul>
        <div class="pet-cost">
          <span>Legjobb ismert ár / db</span><strong><CurrencyAmount :value="bestPrice(pet.vnum)" /></strong>
        </div>
        <div class="pet-card__actions">
          <button
            class="ownership"
            :class="{ active: user.isOwned(pet.vnum) }"
            :aria-label="`${itemName(pet)}: megvan`"
            :aria-pressed="user.isOwned(pet.vnum)"
            @click="user.toggleOwned(pet.vnum)"
          >
            <Check :size="15" /> {{ user.isOwned(pet.vnum) ? 'Megvan' : 'Megjelölöm' }}</button
          ><button
            class="pet-detail-link"
            :aria-label="`${itemName(pet)} beszerzése`"
            @click="selection = String(pet.vnum)"
          >
            Részletek <ArrowUpRight :size="14" />
          </button>
        </div>
      </article>
    </section>
    <section v-else class="empty-state">
      <PawPrint :size="32" />
      <h2>Nincs ilyen kisállat</h2>
      <p>Módosítsd a szűrőket. Célokat a kártyák jobb felső sarkában jelölhetsz ki.</p>
    </section>
    <DetailPanel
      :open="!!selected"
      :title="selected ? itemName(selected) : 'Kisállat'"
      @close="selection = ''"
      ><div v-if="selected" class="stack">
        <div class="pet-detail-hero">
          <ItemIcon :vnum="selected.vnum" :size="92" />
          <div>
            <p>#{{ selected.vnum }} · {{ user.isOwned(selected.vnum) ? 'Már megvan' : 'Még hiányzik' }}</p>
            <div class="actions">
              <button
                class="button"
                :aria-pressed="user.isOwned(selected.vnum)"
                @click="user.toggleOwned(selected.vnum)"
              >
                <Check :size="16" /> {{ user.isOwned(selected.vnum) ? 'Megvan' : 'Megjelölöm' }}</button
              ><button
                class="button"
                :aria-pressed="user.isTarget(selected.vnum)"
                @click="user.toggleTarget(selected.vnum)"
              >
                <Target :size="16" /> {{ user.isTarget(selected.vnum) ? 'Cél törlése' : 'Célként kitűzöm' }}
              </button>
            </div>
          </div>
        </div>
        <ul class="bonus-list">
          <li v-for="entry in itemBonuses(selected)" :key="entry.type">
            <span>{{ entry.label }}</span
            ><strong>{{ entry.display }}</strong>
          </li>
        </ul>
        <div class="panel stack">
          <PriceInput
            label="Kisállat piaci egységára"
            :model-value="user.priceFor(selected.vnum).marketPrice"
            @update:model-value="user.updatePrice(selected.vnum, $event)"
          /><PriceStatus :vnum="selected.vnum" />
        </div>
        <h3>Beszerzési lehetőségek</h3>
        <OfferCard
          v-for="entry in market.byItem.get(selected.vnum) ?? []"
          :key="entry.key"
          :shop="entry.shop"
          :offer="entry.offer"
        />
        <p v-if="!market.byItem.has(selected.vnum)" class="notice">Nincs ismert NPC-váltás.</p>
        <RouterLink
          v-if="market.byItem.has(selected.vnum)"
          class="button button--primary"
          :to="{ path: '/osszehasonlitas', query: { item: selected.vnum } }"
          >Összehasonlítás és tervezés <ArrowUpRight :size="16"
        /></RouterLink></div
    ></DetailPanel>
  </div>
</template>
<style scoped src="./PetsView.css"></style>
