<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { X } from '@lucide/vue'
const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>(),
  heading = ref<HTMLElement>()
const id = useId()
let previousOverflow = '',
  opener: HTMLElement | null = null
watch(
  () => props.open,
  async (open) => {
    await nextTick()
    if (open && dialog.value && !dialog.value.open) {
      opener = document.activeElement as HTMLElement
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      dialog.value.showModal()
      heading.value?.focus()
    } else if (!open && dialog.value?.open) {
      dialog.value.close()
      document.body.style.overflow = previousOverflow
      opener?.focus()
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  if (dialog.value?.open) {
    document.body.style.overflow = previousOverflow
    opener?.focus()
  }
})
function backdrop(event: MouseEvent) {
  if (event.target !== dialog.value) return
  const rect = dialog.value.getBoundingClientRect()
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    emit('close')
}
</script>
<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="detail-panel"
      :aria-labelledby="id"
      @cancel.prevent="emit('close')"
      @click="backdrop"
    >
      <header class="detail-panel__header">
        <h2 :id="id" ref="heading" tabindex="-1">{{ title }}</h2>
        <button class="icon-button" aria-label="Panel bezárása" @click="emit('close')">
          <X :size="19" />
        </button>
      </header>
      <div class="detail-panel__body"><slot v-if="open" /></div>
    </dialog>
  </Teleport>
</template>
<style scoped>
.detail-panel {
  position: fixed;
  inset: 0 0 0 auto;
  margin: 0;
  padding: 0;
  width: min(640px, 100%);
  height: 100dvh;
  max-height: 100dvh;
  max-width: 100%;
  border: 0;
  border-left: 1px solid var(--gold-line);
  color: var(--text);
  background: var(--bg);
  box-shadow: -20px 0 80px var(--shadow);
}
.detail-panel::backdrop {
  background: var(--backdrop);
  backdrop-filter: blur(4px);
}
.detail-panel[open] {
  display: flex;
  flex-direction: column;
  animation: reveal 0.2s ease-out;
}
.detail-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 23px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}
.detail-panel__header h2 {
  margin: 0;
  font: 500 21px var(--display);
}
.detail-panel__body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}
@keyframes reveal {
  from {
    transform: translateX(30px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
@media (max-width: 560px) {
  .detail-panel__body {
    padding: 18px;
  }
}
</style>
