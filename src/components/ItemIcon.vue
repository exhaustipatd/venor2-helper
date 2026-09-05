<script setup lang="ts">
import { ref, watch } from 'vue'
import { Package } from '@lucide/vue'
import { useDataStore } from '@/stores/data'

const props = withDefaults(defineProps<{ vnum: number; size?: number; alt?: string }>(), {
  size: 44,
  alt: '',
})
const dataStore = useDataStore()
const failed = ref(false)
watch(
  () => dataStore.iconFor(props.vnum),
  () => {
    failed.value = false
  },
)
</script>

<template>
  <span class="item-icon" :style="{ width: `${size}px`, height: `${size}px` }">
    <img
      v-if="dataStore.iconFor(vnum) && !failed"
      :src="dataStore.iconFor(vnum)"
      :alt="alt"
      loading="lazy"
      @error="failed = true"
    />
    <Package v-else :size="Math.max(18, size * 0.46)" :stroke-width="1.35" aria-hidden="true" />
  </span>
</template>

<style scoped src="./ItemIcon.css"></style>
