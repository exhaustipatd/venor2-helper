<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowUpRight,
  ArrowRight,
  ArrowRightLeft,
  PawPrint,
  Store,
  Tags,
  Sparkles,
  CircleAlert,
} from '@lucide/vue'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'
import { useMarketStore } from '@/stores/market'
import { itemName, formatDate } from '@/utils/format'
import { isStale } from '@/domain/userData'
import GamePriceImport from '@/components/GamePriceImport.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import CurrencyAmount from '@/components/CurrencyAmount.vue'
const data = useDataStore(),
  user = useUserStore(),
  market = useMarketStore()
const owned = computed(() => data.pets.filter((p) => user.isOwned(p.vnum)).length)
const progress = computed(() => (data.pets.length ? Math.round((owned.value / data.pets.length) * 100) : 0))
const nextPets = computed(() =>
  data.pets
    .filter((p) => !user.isOwned(p.vnum))
    .sort((a, b) => Number(user.isTarget(b.vnum)) - Number(user.isTarget(a.vnum)))
    .slice(0, 4),
)
const staleCount = computed(
  () => Object.values(user.prices).filter((p) => p.marketPrice && isStale(p)).length,
)
</script>
<template>
  <div class="dashboard">
    <section class="dashboard-hero">
      <div class="hero-copy">
        <span class="eyebrow"><span /> A KÖVETKEZŐ LÉPÉS RAJTAD ÁLL</span>
        <h1>Kevesebb találgatás.<br /><em>Több lehetőség.</em></h1>
        <p>Ismerd az árát. Találd meg a jobb cserét.<br />Építs gyűjteményt, ne táblázatokat.</p>
        <div class="actions">
          <RouterLink class="button button--primary" to="/osszehasonlitas"
            ><ArrowRightLeft :size="16" /> Cserék felfedezése <ArrowRight :size="15" /></RouterLink
          ><RouterLink class="button button--ghost" to="/kisallatok">A gyűjteményem</RouterLink>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="seal-orbit seal-orbit--outer" />
        <div class="seal-orbit seal-orbit--inner" />
        <div class="seal-diamond" />
        <span class="seal-north">✦</span>
        <div class="seal-center"><span>V</span><small>VENOR II</small></div>
        <span class="seal-label">TUDÁS · KERESKEDELEM · GYŰJTEMÉNY</span>
      </div>
    </section>
    <div class="dashboard-status">
      <span
        ><span class="status-jewel" /> Wiki: {{ formatDate(data.meta.generatedAt) }} ·
        {{ data.meta.completeItems && data.meta.completePets ? 'teljes csomag' : 'részleges csomag' }}</span
      ><RouterLink :to="{ path: '/arlista', query: { filter: 'stale' } }"
        >Saját árak: {{ staleCount ? `${staleCount} ellenőrizendő` : 'nincs régi mentett ár' }}
        <ArrowUpRight :size="12"
      /></RouterLink>
    </div>
    <div v-if="!data.meta.completeItems || !data.meta.completePets" class="notice notice--warning">
      <CircleAlert :size="18" />
      <div>
        <strong>Részleges wiki-adatcsomag</strong
        >{{
          data.meta.note ||
          'Néhány tárgy vagy kisállat hiányozhat. A frissítést az alkalmazás karbantartója végzi.'
        }}
      </div>
      <RouterLink class="text-link" to="/beallitasok">Részletek →</RouterLink>
    </div>
    <section class="dashboard-stats" aria-label="Áttekintő számok">
      <RouterLink to="/boltok"
        ><Store :size="19" />
        <div>
          <span>NPC-KERESKEDŐ</span
          ><strong
            >{{ data.npcs.length }}<small>{{ market.entries.length }} ajánlat</small></strong
          >
        </div>
        <ArrowUpRight :size="15" /></RouterLink
      ><RouterLink to="/kisallatok"
        ><PawPrint :size="19" />
        <div>
          <span>GYŰJTEMÉNY</span
          ><strong
            >{{ owned }}<small>/ {{ data.pets.length }} kisállat</small></strong
          >
        </div>
        <ArrowUpRight :size="15" /></RouterLink
      ><RouterLink to="/arlista"
        ><Tags :size="19" />
        <div>
          <span>SAJÁT PIACI ÁR</span><strong>{{ user.pricedItemCount }}<small>mentett tárgy</small></strong>
        </div>
        <ArrowUpRight :size="15"
      /></RouterLink>
    </section>
    <div class="dashboard-grid">
      <section class="panel opportunity-panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">A SZÁMAID ALAPJÁN</span>
            <h2>Érdemes megnézned</h2>
          </div>
          <Sparkles :size="21" class="gold-icon" />
        </div>
        <template v-if="market.opportunities.length"
          ><p class="section-intro">Pozitív becsült profit, a saját piaci áraidhoz képest.</p>
          <RouterLink
            v-for="(entry, index) in market.opportunities.slice(0, 4)"
            :key="entry.key"
            :to="{ path: '/osszehasonlitas', query: { item: entry.offer.item_vnum } }"
            class="opportunity-row"
            ><span class="opportunity-rank">0{{ index + 1 }}</span
            ><ItemIcon :vnum="entry.offer.item_vnum" :size="42" />
            <div>
              <strong>{{ itemName(data.getItem(entry.offer.item_vnum)) }}</strong
              ><small>{{ entry.shop.npc_name }}</small>
            </div>
            <span class="opportunity-profit"
              ><CurrencyAmount :value="entry.profit" signed /><small>becsült profit / db</small></span
            ><ArrowUpRight :size="15" /></RouterLink
          ><RouterLink class="text-link panel-link" to="/osszehasonlitas"
            >Minden csere összehasonlítása <ArrowRight :size="14" /></RouterLink
        ></template>
        <div v-else class="opportunity-empty">
          <div class="empty-emblem"><ArrowRightLeft :size="28" /></div>
          <h3>A jó csere egy jó árral kezdődik.</h3>
          <p>
            Importáld a játékbeli árlistádat, vagy adj meg néhány árat. Itt jelennek meg a pozitív becsült
            eredményű cserék.
          </p>
          <GamePriceImport /><RouterLink class="text-link" to="/arlista">Inkább kézzel adom meg →</RouterLink>
        </div>
      </section>
      <section class="panel collection-panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">APRÓ TÁRSAK, NAGY KALANDOK</span>
            <h2>A gyűjteményed</h2>
          </div>
          <PawPrint :size="20" class="gold-icon" />
        </div>
        <div class="collection-progress">
          <strong>{{ progress }}<small>%</small></strong
          ><span
            >{{ owned }} megszerzett<br /><b>{{ data.pets.length - owned }} még felfedezésre vár</b></span
          >
        </div>
        <div class="progress-track"><span :style="{ width: `${progress}%` }" /></div>
        <div class="next-pets">
          <RouterLink
            v-for="pet in nextPets"
            :key="pet.vnum"
            :to="{ path: '/kisallatok', query: { pet: pet.vnum } }"
            ><ItemIcon :vnum="pet.vnum" :size="52" /><span>{{ itemName(pet) }}</span
            ><small>{{ user.isTarget(pet.vnum) ? 'KITŰZÖTT CÉL' : 'MÉG HIÁNYZIK' }}</small></RouterLink
          >
        </div>
        <p v-if="!nextPets.length">Teljes a gyűjtemény. Szép munka!</p>
        <RouterLink class="text-link panel-link" to="/kisallatok"
          >Gyűjtemény megnyitása <ArrowRight :size="14"
        /></RouterLink>
      </section>
      <section class="panel missing-panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">TÖBB ÁR, TÖBB VÁLASZ</span>
            <h2>Ezekkel érdemes kezdeni</h2>
          </div>
          <RouterLink class="text-link" :to="{ path: '/arlista', query: { filter: 'missing' } }"
            >Összes hiányzó ár →</RouterLink
          >
        </div>
        <p class="section-intro">
          Hiányzó árak az érintett csereútvonalak száma szerint. Egy ár kitöltése önmagában nem feltétlenül
          elég a teljes számításhoz.
        </p>
        <div class="missing-grid">
          <RouterLink
            v-for="entry in market.missingPriorities.slice(0, 4)"
            :key="entry.vnum"
            :to="{ path: '/arlista', query: { q: String(entry.vnum) } }"
            ><ItemIcon :vnum="entry.vnum" :size="36" />
            <div>
              <strong>{{ itemName(data.getItem(entry.vnum)) }}</strong
              ><small>{{ entry.count }} érintett ajánlat</small>
            </div>
            <ArrowUpRight :size="14"
          /></RouterLink>
        </div>
        <p v-if="!market.missingPriorities.length">Minden szükséges piaci árat megadtál.</p>
      </section>
    </div>
    <section v-if="user.pricedItemCount" class="import-strip">
      <div>
        <strong>Új árak a játékból?</strong><span>Frissíts egy fájllal. A gyűjteményed megmarad.</span>
      </div>
      <GamePriceImport />
    </section>
  </div>
</template>
<style scoped src="./DashboardView.css"></style>
