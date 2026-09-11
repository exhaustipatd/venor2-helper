<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import { formatInteger, normalizePrice, parsePrice } from '@/utils/format'
const props = withDefaults(
  defineProps<{ modelValue: string; label?: string; compact?: boolean; hideLabel?: boolean }>(),
  {
    label: 'Piaci ár',
    compact: false,
    hideLabel: false,
  },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const editing = ref(false),
  localValue = ref(props.modelValue),
  error = ref(''),
  id = useId()
watch(
  () => props.modelValue,
  (value) => {
    if (!editing.value) localValue.value = value
  },
)
function commit() {
  editing.value = false
  if (localValue.value.trim() && parsePrice(localValue.value) === null) {
    error.value = 'Érvénytelen ár. Példa: 500kk vagy 1,5b.'
    return
  }
  error.value = ''
  const normalized = normalizePrice(localValue.value)
  localValue.value = normalized
  if (normalized !== props.modelValue) emit('update:modelValue', normalized)
}
function cancel(event: KeyboardEvent) {
  localValue.value = props.modelValue
  error.value = ''
  ;(event.target as HTMLInputElement).blur()
}
</script>
<template>
  <div class="price-input" :class="{ 'price-input--compact': compact }">
    <label :for="id" :class="{ 'sr-only': hideLabel }">{{ label }}</label>
    <div class="price-input__control">
      <input
        :id="id"
        v-model="localValue"
        type="text"
        inputmode="decimal"
        maxlength="100"
        placeholder="pl. 500kk"
        :aria-invalid="!!error"
        :aria-describedby="`${id}-hint`"
        @focus="editing = true"
        @blur="commit"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
        @keydown.esc.stop="cancel"
      /><b>Yang</b>
    </div>
    <small :id="`${id}-hint`" :class="{ negative: error }">{{
      error ||
      (editing && parsePrice(localValue) !== null
        ? `${formatInteger(parsePrice(localValue)!)} Yang · Enter a mentéshez`
        : '')
    }}</small>
  </div>
</template>
<style scoped src="./PriceInput.css"></style>
