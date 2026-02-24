<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '../stores/project'

const store = useProjectStore()

const hFlip = computed(() => store.current?.h_flip ?? false)
const vFlip = computed(() => store.current?.v_flip ?? false)

async function toggleHorizontal() {
  await store.flipImage(!hFlip.value, vFlip.value)
}

async function toggleVertical() {
  await store.flipImage(hFlip.value, !vFlip.value)
}
</script>

<template>
  <div class="flip-controls">
    <button :class="{ active: hFlip }" :disabled="store.loading" @click="toggleHorizontal">
      Flip Horizontal
    </button>
    <button :class="{ active: vFlip }" :disabled="store.loading" @click="toggleVertical">
      Flip Vertical
    </button>
  </div>
</template>

<style scoped>
.flip-controls {
  display: flex;
  gap: 0.75rem;
}
button {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.15s;
}
button:hover:not(:disabled) {
  border-color: #9ca3af;
}
button.active {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
