<template>
  <div class="filter-builder">
    <div v-for="(cond, i) in model" :key="i" class="cond-row">
      <el-select
        v-if="i > 0"
        v-model="cond.connector"
        size="small"
        style="width: 72px"
      >
        <el-option label="AND" value="AND" />
        <el-option label="OR" value="OR" />
      </el-select>
      <span v-else class="where-label">WHERE</span>

      <el-select
        v-model="cond.field"
        size="small"
        filterable
        placeholder="字段"
        style="width: 170px"
        @change="onFieldChange(cond)"
      >
        <el-option
          v-for="col in columns"
          :key="col.name"
          :label="col.name"
          :value="col.name"
        >
          <span>{{ col.name }}</span>
          <span class="type-hint">{{ col.type }}</span>
        </el-option>
      </el-select>

      <el-select
        v-model="cond.op"
        size="small"
        style="width: 120px"
        placeholder="操作"
      >
        <el-option
          v-for="op in operatorsFor(cond)"
          :key="op"
          :label="op"
          :value="op"
        />
      </el-select>

      <!-- 值输入区 -->
      <template v-if="needsNoValue(cond.op)">
        <span class="muted">（无需值）</span>
      </template>

      <template v-else-if="cond.op === 'IN' || cond.op === 'NOT IN'">
        <el-select
          v-model="cond.values"
          size="small"
          multiple
          filterable
          allow-create
          default-first-option
          placeholder="多个值，回车添加"
          style="flex: 1; min-width: 220px"
        />
      </template>

      <template v-else-if="cond.op === 'BETWEEN'">
        <el-input
          v-model="cond.value"
          size="small"
          placeholder="起"
          style="width: 140px"
        />
        <span class="muted">~</span>
        <el-input
          v-model="cond.valueEnd"
          size="small"
          placeholder="止"
          style="width: 140px"
        />
      </template>

      <template v-else-if="isTimestamp(cond.type)">
        <el-date-picker
          v-model="cond.value"
          type="datetime"
          size="small"
          value-format="YYYY-MM-DD HH:mm:ss.SSS"
          placeholder="选择时间"
          style="flex: 1; min-width: 200px"
        />
      </template>

      <template v-else-if="isBool(cond.type)">
        <el-select v-model="cond.value" size="small" style="width: 120px">
          <el-option label="true" :value="true" />
          <el-option label="false" :value="false" />
        </el-select>
      </template>

      <template v-else-if="isNumeric(cond.type)">
        <el-input
          v-model="cond.value"
          size="small"
          type="number"
          placeholder="数值"
          style="flex: 1; min-width: 140px"
        />
      </template>

      <template v-else>
        <el-input
          v-model="cond.value"
          size="small"
          placeholder="值（自动转义引号）"
          style="flex: 1; min-width: 140px"
          clearable
        />
      </template>

      <el-button size="small" link type="danger" :icon="Minus" @click="remove(i)" />
    </div>

    <div class="actions">
      <el-button size="small" :icon="Plus" @click="add">添加条件</el-button>
      <el-button size="small" type="primary" :icon="Search" @click="$emit('apply')">应用</el-button>
      <el-button v-if="model.length" size="small" link @click="clear">清空</el-button>
      <span class="preview muted" :title="preview">WHERE 预览: {{ preview || '(无)' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { Plus, Minus, Search } from '@element-plus/icons-vue'

export interface FilterColumn { name: string; type: string }
export interface FilterCond {
  connector: 'AND' | 'OR'
  field: string
  type: string
  op: string
  value?: any
  valueEnd?: any
  values?: any[]
}

const props = defineProps<{
  modelValue: FilterCond[]
  columns: FilterColumn[]
}>()
const emit = defineEmits(['update:modelValue', 'apply'])

const model = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

function upperType(t: string) {
  return String(t || '').toUpperCase()
}
function isTimestamp(t: string) { return upperType(t) === 'TIMESTAMP' }
function isBool(t: string) { return upperType(t) === 'BOOL' }
function isNumeric(t: string) {
  return /INT|FLOAT|DOUBLE|DECIMAL/.test(upperType(t))
}
function isString(t: string) {
  const u = upperType(t)
  return /CHAR|BINARY|VARCHAR|JSON|GEOMETRY/.test(u)
}

const NUMERIC_OPS = ['=', '!=', '>', '>=', '<', '<=', 'BETWEEN', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL']
const STRING_OPS = ['=', '!=', 'LIKE', 'NOT LIKE', 'MATCH', 'NMATCH', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL']
const BOOL_OPS = ['=', '!=', 'IS NULL', 'IS NOT NULL']
const TS_OPS = ['=', '!=', '>', '>=', '<', '<=', 'BETWEEN', 'IS NULL', 'IS NOT NULL']

function operatorsFor(c: FilterCond) {
  if (isTimestamp(c.type)) return TS_OPS
  if (isBool(c.type)) return BOOL_OPS
  if (isNumeric(c.type)) return NUMERIC_OPS
  if (isString(c.type)) return STRING_OPS
  return ['=', '!=', 'IS NULL', 'IS NOT NULL']
}

function needsNoValue(op: string) {
  return op === 'IS NULL' || op === 'IS NOT NULL'
}

function onFieldChange(c: FilterCond) {
  const col = props.columns.find((x) => x.name === c.field)
  c.type = col?.type || ''
  if (!operatorsFor(c).includes(c.op)) c.op = '='
  c.value = ''
  c.valueEnd = ''
  c.values = []
}

function add() {
  const first = props.columns[0]
  model.value.push({
    connector: 'AND',
    field: first?.name || '',
    type: first?.type || '',
    op: '=',
    value: '',
    valueEnd: '',
    values: []
  })
}

function remove(i: number) {
  model.value.splice(i, 1)
}

function clear() {
  model.value = []
}

function quote(v: any, type: string): string {
  if (v === null || v === undefined || v === '') return "''"
  const t = upperType(type)
  if (t === 'BOOL') return v === true || v === 'true' ? 'true' : 'false'
  if (/INT|FLOAT|DOUBLE|DECIMAL/.test(t)) return String(v).trim() === '' ? 'NULL' : String(v)
  const s = String(v).replace(/'/g, "\\'")
  return `'${s}'`
}

function buildOne(c: FilterCond): string {
  const col = `\`${c.field}\``
  const op = c.op
  if (!c.field) return ''
  if (needsNoValue(op)) return `${col} ${op}`
  if (op === 'IN' || op === 'NOT IN') {
    const vals = (c.values || []).filter((v) => v !== '' && v !== null).map((v) => quote(v, c.type))
    if (!vals.length) return ''
    return `${col} ${op} (${vals.join(', ')})`
  }
  if (op === 'BETWEEN') {
    if (c.value === '' || c.valueEnd === '') return ''
    return `${col} BETWEEN ${quote(c.value, c.type)} AND ${quote(c.valueEnd, c.type)}`
  }
  if (c.value === '' || c.value === undefined || c.value === null) return ''
  return `${col} ${op} ${quote(c.value, c.type)}`
}

const preview = computed(() =>
  model.value
    .map((c, i) => {
      const s = buildOne(c)
      if (!s) return ''
      return i === 0 ? s : ` ${c.connector || 'AND'} ${s}`
    })
    .join('')
)

defineExpose({
  buildWhere: () => preview.value
})
</script>

<style lang="scss" scoped>
.filter-builder {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cond-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.where-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-primary);
  width: 72px;
  text-align: center;
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
  .preview {
    margin-left: auto;
    max-width: 50%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: 'Fira Code', Consolas, Menlo, monospace;
    font-size: 11px;
  }
}
.muted { color: var(--td-text-sub); font-size: 12px; }
.type-hint {
  float: right;
  color: var(--el-color-primary);
  font-size: 11px;
  margin-left: 10px;
}
</style>
