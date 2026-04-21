<template>
  <div class="sql-editor">
    <div class="toolbar">
      <el-button type="primary" size="small" :icon="VideoPlay" :loading="loading" @click="run">
        运行 (Ctrl+Enter)
      </el-button>
      <el-button size="small" :icon="Select" @click="runSelection">运行选中</el-button>
      <el-divider direction="vertical" />

      <el-select
        v-model="selectedConnId"
        size="small"
        filterable
        placeholder="连接"
        style="width: 180px"
        @change="onConnChange"
      >
        <el-option
          v-for="c in availableConns"
          :key="c.id"
          :label="c.name"
          :value="c.id"
        >
          <span class="conn-dot" :style="{ background: c.color }"></span>
          <span style="margin-left: 8px">{{ c.name }}</span>
        </el-option>
      </el-select>

      <el-select
        v-model="currentDb"
        size="small"
        filterable
        placeholder="数据库"
        style="width: 170px"
        clearable
        @change="onDbChange"
      >
        <el-option
          v-for="db in databases"
          :key="db"
          :label="db"
          :value="db"
        />
      </el-select>

      <div class="spacer" />
      <el-button size="small" :icon="Download" @click="exportResult">导出 CSV</el-button>
    </div>

    <div class="split">
      <div ref="editorEl" class="editor"></div>
      <div class="drag-row" @mousedown="startResize"></div>
      <div class="result" :style="{ height: resultHeight + 'px' }">
        <ResultGrid :result="tab.result" :loading="loading" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { VideoPlay, Select, Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { v4 as uuid } from 'uuid'
import ResultGrid from './ResultGrid.vue'
import { monaco, registerTdSql, setEditorContext, clearEditorContext, invalidateMetaCache } from '@/utils/monaco'
import { useConnStore } from '@/stores/connections'
import { useTabsStore } from '@/stores/tabs'
import type { EditorTab } from '@/types'

const props = defineProps<{ tab: EditorTab }>()
const connStore = useConnStore()
const tabsStore = useTabsStore()

const editorEl = ref<HTMLElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let modelUri = ''

const loading = ref(false)
const selectedConnId = ref(props.tab.connId)
const currentDb = ref(props.tab.database || '')
const resultHeight = ref(320)

const availableConns = computed(() =>
  connStore.list.filter((c) => connStore.active.has(c.id))
)

const databases = computed(() => connStore.databases[selectedConnId.value] || [])

onMounted(() => {
  registerTdSql()
  editor = monaco.editor.create(editorEl.value!, {
    value: props.tab.sql || '-- 输入你的 SQL\nSHOW DATABASES;',
    language: 'tdsql',
    theme: document.documentElement.classList.contains('dark') ? 'td-dark' : 'vs',
    automaticLayout: true,
    fontSize: 14,
    fontFamily: "'Fira Code', Consolas, Menlo, monospace",
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    renderLineHighlight: 'all',
    tabSize: 2,
    quickSuggestions: { other: true, comments: false, strings: false },
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'smart'
  })
  modelUri = editor.getModel()!.uri.toString()
  syncCtx()

  editor.onDidChangeModelContent(() => {
    tabsStore.update(props.tab.id, { sql: editor!.getValue(), dirty: true })
  })
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => run())
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => runSelection())
})

onBeforeUnmount(() => {
  if (modelUri) clearEditorContext(modelUri)
  editor?.getModel()?.dispose()
  editor?.dispose()
})

watch(() => props.tab.sql, (v) => {
  if (editor && v !== editor.getValue()) editor.setValue(v || '')
})

watch([selectedConnId, currentDb], syncCtx)

function syncCtx() {
  if (!modelUri) return
  setEditorContext(modelUri, {
    connId: selectedConnId.value,
    database: currentDb.value
  })
}

function onConnChange(id: string) {
  currentDb.value = ''
  tabsStore.update(props.tab.id, { connId: id, database: '' })
  invalidateMetaCache(`tables:${id}:`)
}
function onDbChange(db: string) {
  tabsStore.update(props.tab.id, { database: db || '' })
}

async function run() {
  const sql = editor?.getValue() || ''
  if (!sql.trim()) return
  await doQuery(sql)
}

async function runSelection() {
  const sel = editor?.getModel()?.getValueInRange(editor.getSelection()!) || ''
  if (!sel.trim()) return run()
  await doQuery(sel)
}

async function doQuery(sql: string) {
  const conn = connStore.rawById(selectedConnId.value)
  if (!conn) {
    ElMessage.warning('请先选择已连接的数据源')
    return
  }
  loading.value = true
  try {
    const stmts = sql.split(/;\s*\n|;\s*$/).map((s) => s.trim()).filter(Boolean)
    let lastResult = null as any
    for (const s of stmts) {
      const res = await window.tdApi.query({ conn, sql: s, database: currentDb.value || undefined })
      lastResult = res
      window.tdApi.pushHistory({
        id: uuid(), connId: conn.id, connName: conn.name,
        database: currentDb.value, sql: s,
        ok: res.ok, elapsedMs: res.elapsedMs, error: res.error, at: Date.now()
      })
      if (!res.ok) { ElMessage.error(res.error || '执行失败'); break }
    }
    tabsStore.update(props.tab.id, { result: lastResult })
  } finally {
    loading.value = false
  }
}

function exportResult() {
  const r = props.tab.result
  if (!r?.rows?.length) return ElMessage.warning('暂无数据')
  const header = r.columns.map((c) => c.name).join(',')
  const body = r.rows.map((row) =>
    row.map((v) => {
      if (v === null) return ''
      const s = String(v).replace(/"/g, '""')
      return /[",\n]/.test(s) ? `"${s}"` : s
    }).join(',')
  ).join('\n')
  const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `query_${Date.now()}.csv`
  a.click()
}

function startResize(e: MouseEvent) {
  const startY = e.clientY
  const startH = resultHeight.value
  const onMove = (ev: MouseEvent) => {
    resultHeight.value = Math.max(120, Math.min(800, startH - (ev.clientY - startY)))
  }
  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
</script>

<style lang="scss" scoped>
.sql-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--td-header);
  border-bottom: 1px solid var(--td-border);
  .spacer { flex: 1; }
}
.conn-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  vertical-align: middle;
}
.split { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.editor { flex: 1; min-height: 0; }
.drag-row {
  height: 4px;
  cursor: row-resize;
  background: var(--td-border);
  &:hover { background: var(--el-color-primary); }
}
.result {
  border-top: 1px solid var(--td-border);
  background: var(--td-bg);
}
</style>
