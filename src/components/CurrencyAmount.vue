<script setup lang="ts">
import { formatInteger } from '@/utils/format'
defineProps<{ value: bigint | null | undefined; signed?: boolean }>()
</script>
<template>
  <span class="currency-amount" :class="signed && value != null ? (value < 0n ? 'negative' : 'positive') : ''"
    ><template v-if="value != null"
      >{{ signed && value > 0n ? '+' : '' }}{{ formatInteger(value) }} <small>Yang</small></template
    ><template v-else>—</template></span
  >
</template>
<style scoped>
.currency-amount {
  font-family: var(--numbers);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.currency-amount small {
  font:
    500 10px Manrope,
    sans-serif;
  color: var(--muted);
  white-space: nowrap;
}
</style>
