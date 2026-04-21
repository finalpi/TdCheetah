<template>
  <div ref="rootEl" class="result-grid" v-loading="loading" tabindex="-1">
    <div v-if="!result" class="empty">运行 SQL 以查看结果</div>
    <div v-else-if="result.error" class="err">
      <el-alert type="error" :title="result.error" show-icon :closable="false" />
    </div>
    <div v-else-if="!result.columns.length" class="empty">
      ✔ 执行成功 · 影响行: {{ result.affected }} · 耗时: {{ result.elapsedMs }} ms
    </div>
    <template v-else>
      <el-auto-resizer>
        <template #default="{ height, width }">
          <el-table-v2
            ref="tableRef"
            :columns="columns"
            :data="tableData"
            :width="width"
            :height="height - 30"
            :row-height="28"
            :header-height="44"
            :row-class="rowClass"
            fixed
          >
            <template #empty>
              <div class="grid-empty">无数据</div>
            </template>
          </el-table-v2>
        </template>
      </el-auto-resizer>

      <div class="result-footer">
        <span>{{ result.rows.length }} 行</span>
        <span>耗时 {{ result.elapsedMs }} ms</span>
        <span>{{ result.columns.length }} 列</span>
        <span class="tip">Ctrl+F 搜索 · 双击查看 · 拖拽列分隔线调宽</span>
      </div>

      <!-- 搜索浮条 -->
      <transition name="fade">
        <div v-show="searchOpen" class="search-bar" @click.stop>
          <el-input
            ref="searchInputRef"
            v-model="searchTerm"
            size="small"
            placeholder="搜索结果 (↑↓ 上下翻, Esc 关闭)"
            style="width: 260px"
            @keydown.enter.prevent="onEnter"
            @keydown.esc.prevent="closeSearch"
            @keydown.up.prevent="prev"
            @keydown.down.prevent="next"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button size="small" :icon="CaretTop" @click="prev" :disabled="!matches.length" />
          <el-button size="small" :icon="CaretBottom" @click="next" :disabled="!matches.length" />
          <el-tooltip content="区分大小写" placement="bottom">
            <el-button
              size="small"
              :type="caseSensitive ? 'primary' : ''"
              @click="caseSensitive = !caseSensitive"
            >Aa</el-button>
          </el-tooltip>
          <span class="match-count">
            <template v-if="matches.length">{{ matchIdx + 1 }} / {{ matches.length }}</template>
            <template v-else-if="searchTerm">无匹配</template>
          </span>
          <el-button size="small" :icon="Close" text circle @click="closeSearch" />
        </div>
      </transition>
    </template>

    <el-dialog
      v-model="cellDialog"
      :title="activeCell.col"
      width="680px"
      align-center
      append-to-body
    >
      <div class="cell-actions">
        <el-tag size="small">{{ activeCell.type }}</el-tag>
        <span class="muted">行 {{ activeCell.rowIdx + 1 }}</span>
        <div class="flex-1" />
        <el-button size="small" :icon="CopyDocument" @click="copyCell">复制</el-button>
      </div>
      <el-input
        v-model="activeCell.value"
        type="textarea"
        :rows="14"
        readonly
        resize="vertical"
        class="cell-input-modal"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, h, reactive, ref, watch, onBeforeUnmount, nextTick } from 'vue'
import {
  CopyDocument, CaretTop, CaretBottom, Search, Close
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { QueryResult } from '@/types'

const props = defineProps<{ result?: QueryResult; loading?: boolean }>()

const rootEl = ref<HTMLElement>()
const tableRef = ref<any>()

const cellDialog = ref(false)
const activeCell = reactive({ col: '', type: '', value: '', rowIdx: 0 })
const colWidths = reactive<Record<string, number>>({})
const selectedRow = ref(-1)

/* ---------- 搜索 ---------- */
const searchOpen = ref(false)
const searchTerm = ref('')
const caseSensitive = ref(false)
const matchIdx = ref(-1)
const searchInputRef = ref<any>()

const matches = computed<{ row: number; col: number }[]>(() => {
  if (!searchTerm.value || !props.result?.rows?.length) return []
  const term = caseSensitive.value ? searchTerm.value : searchTerm.value.toLowerCase()
  const out: { row: number; col: number }[] = []
  props.result.rows.forEach((row, r) => {
    row.forEach((v, c) => {
      if (v === null || v === undefined) return
      const s = caseSensitive.value ? String(v) : String(v).toLowerCase()
      if (s.includes(term)) out.push({ row: r, col: c })
    })
  })
  return out
})

const matchSet = computed(() => new Set(matches.value.map((m) => `${m.row}:${m.col}`)))
const currentMatchKey = computed(() => {
  const m = matches.value[matchIdx.value]
  return m ? `${m.row}:${m.col}` : ''
})

watch(matches, (m) => {
  matchIdx.value = m.length ? 0 : -1
})

watch(matchIdx, (i) => {
  const m = matches.value[i]
  if (m && tableRef.value?.scrollToRow) {
    tableRef.value.scrollToRow(m.row, 'smart')
    selectedRow.value = m.row
  }
})

function openSearch() {
  searchOpen.value = true
  nextTick(() => searchInputRef.value?.focus?.())
}
function closeSearch() {
  searchOpen.value = false
  searchTerm.value = ''
  matchIdx.value = -1
}
function next() {
  if (!matches.value.length) return
  matchIdx.value = (matchIdx.value + 1) % matches.value.length
}
function prev() {
  if (!matches.value.length) return
  matchIdx.value = (matchIdx.value - 1 + matches.value.length) % matches.value.length
}
function onEnter(e: KeyboardEvent) {
  e.shiftKey ? prev() : next()
}

function onKeydown(e: KeyboardEvent) {
  if (!rootEl.value?.offsetParent) return // 不可见时不响应
  if (e.ctrlKey && (e.key === 'f' || e.key === 'F')) {
    e.preventDefault()
    openSearch()
  } else if (e.key === 'Escape' && searchOpen.value) {
    closeSearch()
  } else if (e.key === 'F3') {
    e.preventDefault()
    e.shiftKey ? prev() : next()
  }
}

window.addEventListener('keydown', onKeydown)
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

/* ---------- 工具 ---------- */
function defaultColWidth(name: string, type: string) {
  const base = Math.max(name.length, type.length) * 8 + 40
  return Math.max(120, Math.min(360, base))
}

function renderValue(v: any) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function openCell(col: { name: string; type: string }, value: any, rowIdx: number) {
  activeCell.col = col.name
  activeCell.type = col.type
  activeCell.value = value === null || value === undefined ? 'NULL' : renderValue(value)
  activeCell.rowIdx = rowIdx
  cellDialog.value = true
}

async function copyCell() {
  try {
    await navigator.clipboard.writeText(activeCell.value)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

/* ---------- 列宽拖拽 ---------- */
let resizing: { key: string; startX: number; startW: number } | null = null

function onResizeStart(e: MouseEvent, key: string) {
  e.preventDefault()
  e.stopPropagation()
  const idx = +key.slice(1)
  const startW = colWidths[key] ?? defaultColWidth(
    props.result!.columns[idx].name,
    props.result!.columns[idx].type
  )
  resizing = { key, startX: e.clientX, startW }
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeEnd)
}
function onResizeMove(e: MouseEvent) {
  if (!resizing) return
  colWidths[resizing.key] = Math.max(60, resizing.startW + (e.clientX - resizing.startX))
}
function onResizeEnd() {
  resizing = null
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
}
onBeforeUnmount(onResizeEnd)

function rowClass({ rowIndex }: any) {
  return rowIndex === selectedRow.value ? 'row-selected' : ''
}

/* ---------- 列 ---------- */
const columns = computed(() => {
  // 依赖搜索状态以保证搜索时 cellRenderer 重建
  const curKey = currentMatchKey.value
  const matched = matchSet.value
  if (!props.result?.columns) return []

  return props.result.columns.map((c, idx) => {
    const key = `c${idx}`
    return {
      key,
      dataKey: key,
      title: c.name,
      width: colWidths[key] ?? defaultColWidth(c.name, c.type),
      cellRenderer: ({ cellData, rowIndex }: any) => {
        const cellKey = `${rowIndex}:${idx}`
        const isMatch = matched.has(cellKey)
        const isCurrent = curKey === cellKey
        return h('div', {
          class: [
            'cell-wrap',
            isMatch && 'cell-match',
            isCurrent && 'cell-match-current'
          ],
          onClick: () => (selectedRow.value = rowIndex),
          onDblclick: () => openCell(c, cellData, rowIndex)
        }, [
          h('input', {
            class: cellData === null || cellData === undefined ? 'cell-input null' : 'cell-input',
            readonly: true,
            value: cellData === null || cellData === undefined ? 'NULL' : renderValue(cellData),
            title: cellData === null || cellData === undefined ? 'NULL' : renderValue(cellData)
          })
        ])
      },
      headerCellRenderer: () =>
        h('div', { class: 'col-head', title: `${c.name} : ${c.type}` }, [
          h('div', { class: 'col-meta' }, [
            h('span', { class: 'col-name' }, c.name),
            h('span', { class: 'col-type' }, c.type)
          ]),
          h('div', {
            class: 'col-resizer',
            onMousedown: (e: MouseEvent) => onResizeStart(e, key)
          })
        ])
    }
  })
})

const tableData = computed(() => {
  if (!props.result?.rows) return []
  return props.result.rows.map((row, i) => {
    const obj: any = { _idx: i }
    row.forEach((v, j) => (obj[`c${j}`] = v))
    return obj
  })
})
</script>

<style lang="scss" scoped>
.result-grid {
  height: 100%;
  display: flex;
  flex-direction: column;
  font-size: 12px;
  position: relative;
  outline: none;
}
.empty, .err { padding: 16px; color: var(--td-text-sub); }
.grid-empty { padding: 40px 0; text-align: center; color: var(--td-text-sub); font-size: 13px; }

.result-footer {
  height: 28px;
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 0 12px;
  background: var(--td-header);
  border-top: 1px solid var(--td-border);
  color: var(--td-text-sub);
  font-size: 12px;
  .tip { margin-left: auto; opacity: 0.7; }
}

.muted { color: var(--td-text-sub); font-size: 12px; }

/* 搜索浮条 */
.search-bar {
  position: absolute;
  top: 6px;
  right: 16px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: var(--td-header);
  border: 1px solid var(--td-border);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  .match-count {
    font-size: 12px;
    color: var(--td-text-sub);
    min-width: 50px;
    text-align: center;
  }
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s, transform 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-6px); }

/* 表头 */
:deep(.el-table-v2__header-cell) {
  padding: 0;
  user-select: none;
  position: relative;
}
:deep(.col-head) {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 0 8px;
  position: relative;
  .col-meta {
    flex: 1; min-width: 0;
    display: flex; flex-direction: column; justify-content: center; gap: 2px;
    line-height: 1.2;
  }
  .col-name, .col-type {
    display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .col-name { font-weight: 600; color: var(--td-text); font-size: 12px; }
  .col-type { font-size: 10px; color: var(--el-color-primary); text-transform: uppercase; letter-spacing: 0.3px; }
  .col-resizer {
    position: absolute; top: 0; right: 0; width: 6px; height: 100%;
    cursor: col-resize; z-index: 2;
    transition: background 0.15s;
    &:hover, &:active { background: var(--el-color-primary); }
  }
}

/* 行 */
:deep(.el-table-v2__row-cell) {
  padding: 0;
  border-right: 1px solid var(--td-border);
}
:deep(.el-table-v2__row) {
  cursor: default;
  &:hover { background: var(--el-color-primary-light-9); }
  html.dark &:hover { background: rgba(59, 130, 246, 0.1); }
}
:deep(.el-table-v2__row.row-selected),
:deep(.el-table-v2__row.row-selected:hover) {
  background: var(--el-color-primary-light-8) !important;
  html.dark & { background: rgba(59, 130, 246, 0.22) !important; }
}

/* 单元格 */
:deep(.cell-wrap) {
  width: 100%; height: 100%;
  padding: 0 4px;
  display: flex; align-items: center;
  position: relative;
  transition: background 0.15s, box-shadow 0.15s;
}
:deep(.cell-wrap.cell-match) {
  background: rgba(255, 220, 0, 0.35);
  html.dark & { background: rgba(255, 200, 0, 0.18); }
}
:deep(.cell-wrap.cell-match.cell-match-current) {
  background: #ff8c00;
  box-shadow: inset 0 0 0 2px #ff6a00;
  html.dark & {
    background: #d97706;
    box-shadow: inset 0 0 0 2px #f59e0b;
  }
}
:deep(.cell-wrap.cell-match-current input) {
  color: #fff !important;
  font-weight: 600;
}
:deep(.cell-input) {
  width: 100%; height: 24px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--td-text);
  padding: 0 6px;
  font-size: 12px;
  font-family: 'Fira Code', Consolas, Menlo, monospace;
  outline: none;
  border-radius: 3px;
  text-overflow: ellipsis;
  cursor: text;
  &:focus { border-color: var(--el-color-primary); background: var(--el-bg-color); }
  &.null { color: #909399; font-style: italic; }
}
:deep(.el-table-v2__row-cell) { padding: 0; }

/* 对话框 */
.cell-actions {
  display: flex; gap: 10px; align-items: center; margin-bottom: 10px;
  .flex-1 { flex: 1; }
}
.cell-input-modal :deep(textarea) {
  font-family: 'Fira Code', Consolas, Menlo, monospace;
  font-size: 12px;
}
</style>
