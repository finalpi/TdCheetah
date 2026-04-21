<template>
  <el-drawer v-model="visible" title="SQL 历史" size="560px" :before-close="close">
    <div class="toolbar">
      <el-button size="small" @click="reload">刷新</el-button>
      <el-button size="small" type="danger" @click="clear">清空</el-button>
    </div>
    <el-scrollbar class="scroll">
      <div v-for="h in list" :key="h.id" class="item" :class="{ fail: !h.ok }">
        <div class="meta">
          <el-tag size="small" :type="h.ok ? 'success' : 'danger'">{{ h.ok ? 'OK' : 'ERR' }}</el-tag>
          <span class="muted">{{ h.connName }}</span>
          <span v-if="h.database" class="muted">· {{ h.database }}</span>
          <span class="muted">· {{ h.elapsedMs }}ms</span>
          <span class="time">{{ new Date(h.at).toLocaleString() }}</span>
        </div>
        <pre class="sql" @click="copy(h.sql)">{{ h.sql }}</pre>
        <div v-if="h.error" class="error">{{ h.error }}</div>
      </div>
      <div v-if="!list.length" class="empty">暂无历史</div>
    </el-scrollbar>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { HistoryItem } from '@/types'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits(['update:modelValue'])
const visible = ref(false)
const list = ref<HistoryItem[]>([])

watch(() => props.modelValue, (v) => {
  visible.value = v
  if (v) reload()
})
watch(visible, (v) => emit('update:modelValue', v))

async function reload() { list.value = await window.tdApi.getHistory() }
async function clear() { await window.tdApi.clearHistory(); list.value = [] }
function close() { visible.value = false }
function copy(sql: string) {
  navigator.clipboard.writeText(sql)
  ElMessage.success('已复制到剪贴板')
}
</script>

<style lang="scss" scoped>
.toolbar {
  display: flex;
  gap: 8px;
  padding: 0 20px 12px;
  border-bottom: 1px solid var(--td-border);
  margin-bottom: 8px;
}
.scroll {
  height: calc(100% - 56px);
  padding: 0 20px 20px;
}
.item {
  padding: 10px 0;
  border-bottom: 1px dashed var(--td-border);
}
.meta {
  display: flex; gap: 8px; align-items: center; font-size: 12px;
  .time { margin-left: auto; color: var(--td-text-sub); }
}
.sql {
  margin: 6px 0 0;
  padding: 8px 10px;
  background: var(--td-header);
  border-radius: 4px;
  font-family: 'Fira Code', Consolas, Menlo, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  cursor: pointer;
  max-height: 160px;
  overflow: auto;
  &:hover { outline: 1px solid var(--el-color-primary); }
}
.error { color: #f56c6c; font-size: 12px; margin-top: 4px; }
.muted { color: var(--td-text-sub); font-size: 12px; }
.empty { text-align: center; color: var(--td-text-sub); padding: 40px 0; }
</style>
