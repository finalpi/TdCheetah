<template>
  <el-dialog
    v-model="visible"
    :title="`导出 DDL - ${database}`"
    width="880px"
    align-center
    destroy-on-close
  >
    <div class="head">
      <el-space>
        <el-tag type="info">{{ stats.db }} 库</el-tag>
        <el-tag type="success">{{ stats.stables }} 超级表</el-tag>
        <el-tag type="warning">{{ stats.tables }} 普通表</el-tag>
        <el-tag v-if="stats.views" type="primary">{{ stats.views }} 视图</el-tag>
        <el-tag v-if="stats.errors" type="danger">{{ stats.errors }} 失败</el-tag>
        <span class="muted">大小 {{ sizeKb }} KB · {{ statements }} 条语句</span>
      </el-space>
    </div>

    <el-input
      v-model="modelSql"
      type="textarea"
      :rows="22"
      readonly
      class="sql-area"
    />

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button :icon="CopyDocument" @click="copy">复制</el-button>
      <el-button type="primary" :icon="Download" @click="download">下载 .sql</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { CopyDocument, Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  modelValue: boolean
  database: string
  sql: string
  stats: { db: number; stables: number; tables: number; views: number; errors: number }
}>()
const emit = defineEmits(['update:modelValue'])

const visible = ref(false)
const modelSql = ref('')

watch(() => props.modelValue, (v) => (visible.value = v))
watch(visible, (v) => emit('update:modelValue', v))
watch(() => props.sql, (v) => (modelSql.value = v), { immediate: true })

const sizeKb = computed(() => (new Blob([modelSql.value]).size / 1024).toFixed(1))
const statements = computed(
  () => (modelSql.value.match(/;\s*(\n|$)/g) || []).length
)

async function copy() {
  try {
    await navigator.clipboard.writeText(modelSql.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}

function download() {
  const blob = new Blob([modelSql.value], { type: 'text/sql;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  const pad = (n: number) => String(n).padStart(2, '0')
  const d = new Date()
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  a.download = `${props.database}_${stamp}.sql`
  a.click()
  URL.revokeObjectURL(a.href)
  ElMessage.success('已下载')
}
</script>

<style lang="scss" scoped>
.head {
  margin-bottom: 10px;
}
.muted {
  color: var(--td-text-sub);
  font-size: 12px;
  margin-left: 8px;
}
.sql-area :deep(textarea) {
  font-family: 'Fira Code', Consolas, Menlo, monospace;
  font-size: 12px;
  line-height: 1.5;
}
</style>
