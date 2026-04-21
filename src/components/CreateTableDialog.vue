<template>
  <el-dialog v-model="visible" title="新建表 / 超级表" width="880px" align-center>
    <el-form :model="form" label-width="90px" inline>
      <el-form-item label="类型">
        <el-radio-group v-model="form.kind">
          <el-radio-button value="stable">超级表 (STABLE)</el-radio-button>
          <el-radio-button value="table">普通表</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="表名">
        <el-input v-model="form.name" style="width: 200px" />
      </el-form-item>
      <el-form-item label="注释">
        <el-input v-model="form.comment" placeholder="可选" style="width: 240px" />
      </el-form-item>
    </el-form>

    <el-divider>数据列</el-divider>
    <ColumnEditor v-model="form.columns" :tag="false" />

    <template v-if="form.kind === 'stable'">
      <el-divider>标签列 (TAGS)</el-divider>
      <ColumnEditor v-model="form.tags" :tag="true" />
    </template>

    <el-divider>SQL 预览</el-divider>
    <el-input v-model="sql" type="textarea" :rows="5" readonly class="sql-preview" />

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="submit">创建</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import ColumnEditor from './ColumnEditor.vue'
import { useConnStore } from '@/stores/connections'

interface Col { name: string; type: string; length?: number; precision?: number; scale?: number }

const props = defineProps<{ modelValue: boolean; connId: string; database: string }>()
const emit = defineEmits(['update:modelValue'])
const connStore = useConnStore()

const loading = ref(false)
const visible = ref(false)
watch(() => props.modelValue, (v) => (visible.value = v))
watch(visible, (v) => emit('update:modelValue', v))

const form = ref({
  kind: 'stable' as 'stable' | 'table',
  name: '',
  comment: '',
  columns: [
    { name: 'ts', type: 'TIMESTAMP' },
    { name: 'value', type: 'DOUBLE' }
  ] as Col[],
  tags: [{ name: 'location', type: 'NCHAR', length: 32 }] as Col[]
})

watch(visible, (v) => {
  if (v) {
    form.value = {
      kind: 'stable',
      name: '',
      comment: '',
      columns: [
        { name: 'ts', type: 'TIMESTAMP' },
        { name: 'value', type: 'DOUBLE' }
      ],
      tags: [{ name: 'location', type: 'NCHAR', length: 32 }]
    }
  }
})

function colDef(c: Col) {
  let t = c.type
  if (['BINARY', 'VARCHAR', 'NCHAR', 'GEOMETRY', 'VARBINARY'].includes(c.type)) {
    t = `${c.type}(${c.length || 16})`
  } else if (c.type === 'DECIMAL') {
    t = `DECIMAL(${c.precision || 18}${c.scale !== undefined ? ',' + c.scale : ''})`
  }
  return `\`${c.name}\` ${t}`
}

const sql = computed(() => {
  const db = props.database
  const name = form.value.name || 'new_table'
  const cols = form.value.columns.map(colDef).join(', ')
  if (form.value.kind === 'stable') {
    const tags = form.value.tags.map(colDef).join(', ')
    let s = `CREATE STABLE IF NOT EXISTS \`${db}\`.\`${name}\` (${cols}) TAGS (${tags})`
    if (form.value.comment) s += ` COMMENT '${form.value.comment}'`
    return s + ';'
  }
  let s = `CREATE TABLE IF NOT EXISTS \`${db}\`.\`${name}\` (${cols})`
  if (form.value.comment) s += ` COMMENT '${form.value.comment}'`
  return s + ';'
})

async function submit() {
  if (!form.value.name) return ElMessage.warning('请输入表名')
  if (!form.value.columns.length) return ElMessage.warning('至少一列')
  loading.value = true
  try {
    const conn = connStore.rawById(props.connId)!
    const res = await window.tdApi.query({ conn, sql: sql.value, database: props.database })
    if (!res.ok) throw new Error(res.error)
    ElMessage.success('创建成功')
    const folder = form.value.kind === 'stable' ? 'stables' : 'tables'
    connStore.refreshTree(`c:${props.connId}:d:${props.database}:${folder}`)
    visible.value = false
  } catch (e: any) {
    ElMessage.error(e.message)
  } finally { loading.value = false }
}
</script>

<style scoped>
.sql-preview :deep(textarea) {
  font-family: 'Fira Code', Consolas, Menlo, monospace;
  font-size: 12px;
}
</style>
