<script setup lang="ts">
import { onMounted } from 'vue'
import { CircleAlert, RefreshCw } from '@lucide/vue'
import AppShell from '@/components/AppShell.vue'
import LoadingState from '@/components/LoadingState.vue'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'
const data = useDataStore(),
  user = useUserStore()
onMounted(() => data.load())
</script>
<template>
  <AppShell>
    <div v-if="user.storageError" class="notice notice--error" role="alert">
      <CircleAlert :size="20" />
      <div><strong>Az adataid nincsenek biztonságosan mentve</strong>{{ user.storageError }}</div>
      <button class="button" @click="user.exportData">Mentés letöltése</button
      ><button class="button" @click="user.exportOriginal">Eredeti adatok letöltése</button
      ><button class="button" @click="user.persist">Mentés újrapróbálása</button>
    </div>
    <div v-if="data.error" class="notice notice--error" role="alert">
      <CircleAlert :size="20" />
      <div>
        <strong>Az adatcsomag nem tölthető be</strong>{{ data.error }}
        <p v-if="data.loaded">Az előző, ellenőrzött csomagot használjuk.</p>
      </div>
      <button class="button" :disabled="data.loading" @click="data.load(true)">
        <RefreshCw :size="16" /> Újrapróbálás
      </button>
    </div>
    <div v-for="warning in data.warnings" :key="warning" class="notice notice--warning" role="status">
      <span>{{ warning }}</span
      ><button class="button" :disabled="data.loading" @click="data.load(true)">Adatok újratöltése</button>
    </div>
    <LoadingState v-if="!data.loaded && !data.error" />
    <RouterView v-if="data.loaded" />
  </AppShell>
</template>
