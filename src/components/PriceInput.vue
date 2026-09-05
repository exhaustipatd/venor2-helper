<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatInteger, normalizePrice, parsePrice } from '@/utils/format'

const props = withDefaults(defineProps<{
  modelValue: string
  label?: string
  compact?: boolean
}>(), { label: 'Ár', compact: false })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const editing = ref(false)
const localValue = ref(props.modelValue)

watch(() => props.modelValue, (value) => {
  if (!editing.value) localValue.value = value
})

function focus() {
  editing.value = true
  localValue.value = props.modelValue
}

function commit() {
  editing.value = false
  const normalized = normalizePrice(localValue.value)
  localValue.value = normalized
  emit('update:modelValue', normalized)
}
</script>

<template>
  <label class="price-input" :class="{ 'price-input--compact': compact }">
    <span>{{ label }}</span>
    <div>
      <input
        v-model="localValue"
        type="text"
        inputmode="decimal"
        :placeholder="editing ? 'pl. 500kk' : 'Nincs megadva'"
        :aria-label="label"
        @focus="focus"
        @blur="commit"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
      <small v-if="parsePrice(localValue) !== null">{{ formatInteger(parsePrice(localValue)!) }}</small>
      <b>Yang</b>
    </div>
  </label>
</template>

<style scoped src="./PriceInput.css"></style>
