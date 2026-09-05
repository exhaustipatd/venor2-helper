<script setup lang="ts">
import { onMounted } from 'vue'
import AppShell from '@/components/AppShell.vue'
import { useDataStore } from '@/stores/data'

const dataStore = useDataStore()
onMounted(() => dataStore.load())
</script>

<template>
  <AppShell>
    <div v-if="dataStore.error" class="notice notice--error" role="alert">
      <strong>Betöltési hiba</strong>
      <span>{{ dataStore.error }}</span>
    </div>
    <RouterView v-else />
  </AppShell>
</template>
