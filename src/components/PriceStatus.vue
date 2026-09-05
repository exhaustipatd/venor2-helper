<script setup lang="ts">
import { computed } from 'vue'
import { Clock3, Check } from '@lucide/vue'
import { useUserStore } from '@/stores/user'
import { isStale } from '@/domain/userData'
import { formatDate } from '@/utils/format'
const props = defineProps<{ vnum: number }>()
const user = useUserStore()
const price = computed(() => user.priceFor(props.vnum))
const missing = computed(() => user.marketPrice(props.vnum) === null)
</script>
<template>
  <span class="price-status" :class="{ 'text-warning': missing || isStale(price) }"
    ><Clock3 v-if="missing || isStale(price)" :size="12" /><Check v-else :size="12" />{{
      missing
        ? 'Hiányzó ár'
        : `${isStale(price) ? 'Ellenőrizendő' : 'Friss'} · ${formatDate(price.updatedAt)}`
    }}</span
  >
</template>
<style scoped>
.price-status {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  font-size: 10px;
  color: var(--muted);
}
</style>
