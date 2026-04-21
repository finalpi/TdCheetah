<template>
  <div class="col-editor">
    <div class="toolbar">
      <el-button size="small" :icon="Plus" @click="add">添加列</el-button>
    </div>
    <el-table :data="model" size="small" border>
      <el-table-column label="#" width="50" type="index" />
      <el-table-column label="列名" min-width="160">
        <template #default="{ row }"><el-input v-model="row.name" size="small" /></template>
      </el-table-column>
      <el-table-column label="类型" width="200">
        <template #default="{ row }">
          <el-select v-model="row.type" size="small" filterable>
            <el-option
              v-for="t in types"
              :key="t.name"
              :label="t.label"
              :value="t.name"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="长度 / 精度" width="200">
        <template #default="{ row }">
          <template v-if="needLen(row.type)">
            <el-input-number v-model="row.length" size="small" :min="1" :max="65517" />
          </template>
          <template v-else-if="row.type === 'DECIMAL'">
            <el-input-number v-model="row.precision" :min="1" :max="38" size="small" style="width: 80px" />
            <el-input-number v-model="row.scale" :min="0" :max="38" size="small" style="width: 80px; margin-left: 4px" />
          </template>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="说明" min-width="200">
        <template #default="{ row }">
          <span class="muted">{{ desc(row.type) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80">
        <template #default="{ $index }">
          <el-button size="small" type="danger" link :icon="Delete" @click="remove($index)" />
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import { TD_DATA_TYPES } from '@/utils/tdengine'

interface Col { name: string; type: string; length?: number; precision?: number; scale?: number }
const props = defineProps<{ modelValue: Col[]; tag: boolean }>()
const emit = defineEmits(['update:modelValue'])

const model = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const types = computed(() =>
  TD_DATA_TYPES.filter((t) => (props.tag ? t.allowTag !== false : t.name !== 'JSON'))
)

function needLen(t: string) {
  return ['BINARY', 'VARCHAR', 'NCHAR', 'GEOMETRY', 'VARBINARY'].includes(t)
}

function desc(t: string) {
  return TD_DATA_TYPES.find((x) => x.name === t)?.description || ''
}

function add() {
  model.value.push({ name: `col${model.value.length + 1}`, type: 'INT' })
}
function remove(i: number) {
  model.value.splice(i, 1)
}
</script>

<style scoped>
.toolbar { margin-bottom: 8px; }
.muted { color: var(--td-text-sub); font-size: 12px; }
</style>
