<template>
  <div class="table-browser">
    <div class="toolbar">
      <el-button-group>
        <el-button size="small" :icon="Refresh" @click="reload">刷新</el-button>
        <el-button size="small" :icon="Filter" @click="showFilter = !showFilter">
          筛选 <el-badge v-if="conditions.length" :value="conditions.length" class="badge-inline" />
        </el-button>
      </el-button-group>
      <el-divider direction="vertical" />
      <span class="muted ellipsis">{{ tab.database }} · {{ tab.tableName }}</span>
      <div class="spacer" />

      <el-tooltip content="按时间列排序切换" placement="top">
        <el-button
          size="small"
          :type="orderBy === 'DESC' ? 'primary' : ''"
          @click="toggleOrder"
        >
          <el-icon><component :is="orderBy === 'DESC' ? Bottom : Top" /></el-icon>
          <span style="margin-left: 4px">{{ orderBy || '默认' }}</span>
        </el-button>
      </el-tooltip>

      <el-input-number
        v-model="limit"
        size="small"
        :min="1"
        :max="100000"
        :step="100"
        controls-position="right"
        style="width: 130px"
      />

      <el-button type="primary" size="small" @click="reload">查询</el-button>
    </div>

    <div v-if="showFilter" class="filter-panel">
      <div class="filter-row">
        <span class="label">时间范围</span>
        <el-date-picker
          v-model="timeStart"
          type="datetime"
          size="small"
          value-format="YYYY-MM-DD HH:mm:ss.SSS"
          placeholder="开始时间 (留空 = 最早)"
          :disabled="!tsColumn"
          clearable
          style="width: 230px"
        />
        <span class="muted">~</span>
        <el-date-picker
          v-model="timeEnd"
          type="datetime"
          size="small"
          value-format="YYYY-MM-DD HH:mm:ss.SSS"
          placeholder="结束时间 (留空 = 至今)"
          :disabled="!tsColumn"
          clearable
          style="width: 230px"
        />
        <el-dropdown size="small" trigger="click" @command="applyShortcut">
          <el-button size="small" :disabled="!tsColumn">
            快捷 <el-icon><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="s in timeShortcuts"
                :key="s.text"
                :command="s.text"
              >{{ s.text }}</el-dropdown-item>
              <el-dropdown-item divided command="__clear">清空时间</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-select
          v-if="tsColumn"
          v-model="tsColumn"
          size="small"
          style="width: 150px"
          placeholder="时间列"
        >
          <el-option v-for="c in tsColumns" :key="c" :label="c" :value="c" />
        </el-select>
        <div class="flex-1" />
        <el-switch
          v-model="useRawSql"
          size="small"
          active-text="原生 SQL"
          inactive-text="可视化"
          inline-prompt
        />
      </div>

      <div class="filter-row" style="margin-top: 10px">
        <FilterBuilder
          v-if="!useRawSql"
          v-model="conditions"
          :columns="allColumns"
          @apply="reload"
        />
        <el-input
          v-else
          v-model="whereClause"
          size="small"
          placeholder="自定义 WHERE 子句，例: value > 0 AND location='beijing'"
          style="flex: 1"
          @keyup.enter="reload"
          clearable
        />
      </div>
    </div>

    <div class="grid">
      <ResultGrid :result="result" :loading="loading" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Refresh, Filter, Top, Bottom, ArrowDown } from '@element-plus/icons-vue'
import ResultGrid from './ResultGrid.vue'
import FilterBuilder, { type FilterCond, type FilterColumn } from './FilterBuilder.vue'
import { useConnStore } from '@/stores/connections'
import type { EditorTab, QueryResult } from '@/types'

const props = defineProps<{ tab: EditorTab }>()
const connStore = useConnStore()

const result = ref<QueryResult>()
const loading = ref(false)
const limit = ref(500)
const orderBy = ref<'ASC' | 'DESC' | ''>('DESC')
const whereClause = ref('')
const showFilter = ref(true)
const useRawSql = ref(false)
const tsColumn = ref('')
const tsColumns = ref<string[]>([])
const timeStart = ref<string>('')
const timeEnd = ref<string>('')
const allColumns = ref<FilterColumn[]>([])
const conditions = ref<FilterCond[]>([])

const timeShortcuts: { text: string; ms: number }[] = [
  { text: '最近 5 分钟', ms: 5 * 60_000 },
  { text: '最近 15 分钟', ms: 15 * 60_000 },
  { text: '最近 1 小时', ms: 3600_000 },
  { text: '最近 6 小时', ms: 6 * 3600_000 },
  { text: '最近 1 天', ms: 86400_000 },
  { text: '最近 7 天', ms: 7 * 86400_000 },
  { text: '最近 30 天', ms: 30 * 86400_000 }
]

const pad = (n: number, l = 2) => String(n).padStart(l, '0')
function toLocalStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

function applyShortcut(cmd: string) {
  if (cmd === '__clear') {
    timeStart.value = ''
    timeEnd.value = ''
    return
  }
  const s = timeShortcuts.find((x) => x.text === cmd)
  if (!s) return
  timeStart.value = toLocalStr(new Date(Date.now() - s.ms))
  timeEnd.value = ''
  reload()
}

onMounted(reload)

function toggleOrder() {
  orderBy.value = orderBy.value === 'DESC' ? 'ASC' : orderBy.value === 'ASC' ? '' : 'DESC'
  reload()
}

async function detectColumns(conn: any) {
  const d = await window.tdApi.query({
    conn,
    sql: `DESCRIBE \`${props.tab.database}\`.\`${props.tab.tableName}\``
  })
  if (d.ok && d.rows.length) {
    allColumns.value = d.rows.map((r) => ({ name: r[0], type: String(r[1] || '').toUpperCase() }))
    tsColumns.value = allColumns.value
      .filter((c) => c.type === 'TIMESTAMP')
      .map((c) => c.name)
    if (!tsColumn.value && tsColumns.value.length) tsColumn.value = tsColumns.value[0]
  }
}

function buildWhere(): string {
  const conds: string[] = []
  if (tsColumn.value) {
    if (timeStart.value) conds.push(`\`${tsColumn.value}\` >= '${timeStart.value}'`)
    if (timeEnd.value) conds.push(`\`${tsColumn.value}\` <= '${timeEnd.value}'`)
  }
  if (useRawSql.value) {
    if (whereClause.value.trim()) conds.push(`(${whereClause.value.trim()})`)
  } else {
    const visual = buildFromConditions()
    if (visual) conds.push(`(${visual})`)
  }
  return conds.join(' AND ')
}

function buildFromConditions(): string {
  return conditions.value
    .map((c, i) => {
      const s = buildOne(c)
      if (!s) return ''
      return i === 0 ? s : ` ${c.connector || 'AND'} ${s}`
    })
    .join('')
}

function buildOne(c: FilterCond): string {
  const col = `\`${c.field}\``
  const op = c.op
  if (!c.field) return ''
  if (op === 'IS NULL' || op === 'IS NOT NULL') return `${col} ${op}`
  if (op === 'IN' || op === 'NOT IN') {
    const vals = (c.values || []).filter((v) => v !== '' && v !== null).map((v) => quote(v, c.type))
    return vals.length ? `${col} ${op} (${vals.join(', ')})` : ''
  }
  if (op === 'BETWEEN') {
    if (c.value === '' || c.valueEnd === '') return ''
    return `${col} BETWEEN ${quote(c.value, c.type)} AND ${quote(c.valueEnd, c.type)}`
  }
  if (c.value === '' || c.value === undefined || c.value === null) return ''
  return `${col} ${op} ${quote(c.value, c.type)}`
}

function quote(v: any, type: string): string {
  const t = String(type || '').toUpperCase()
  if (t === 'BOOL') return v === true || v === 'true' ? 'true' : 'false'
  if (/INT|FLOAT|DOUBLE|DECIMAL/.test(t)) return String(v)
  const s = String(v).replace(/'/g, "\\'")
  return `'${s}'`
}

async function reload() {
  const conn = connStore.rawById(props.tab.connId)
  if (!conn) return
  loading.value = true
  try {
    if (!allColumns.value.length) await detectColumns(conn)

    let sql = `SELECT * FROM \`${props.tab.database}\`.\`${props.tab.tableName}\``
    const where = buildWhere()
    if (where) sql += ` WHERE ${where}`
    if (orderBy.value && tsColumn.value) sql += ` ORDER BY \`${tsColumn.value}\` ${orderBy.value}`
    if (limit.value) sql += ` LIMIT ${limit.value}`

    const res = await window.tdApi.query({ conn, sql })
    result.value = res
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.table-browser {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--td-header);
  border-bottom: 1px solid var(--td-border);
  .spacer { flex: 1; }
  .ellipsis {
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.badge-inline :deep(.el-badge__content) { top: -2px; right: -6px; }

.filter-panel {
  padding: 12px;
  border-bottom: 1px solid var(--td-border);
  background: var(--td-bg);
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  .label {
    font-size: 12px;
    color: var(--td-text-sub);
    width: 72px;
  }
  .flex-1 { flex: 1; }
}
.grid { flex: 1; min-height: 0; }
.muted { color: var(--td-text-sub); font-size: 12px; }
</style>
