<template>
  <div class="struct" v-loading="loading">
    <div class="toolbar">
      <span class="muted">{{ tab.database }} · {{ tab.tableName }}</span>
      <div class="spacer" />
      <el-button size="small" :icon="Refresh" @click="reload">刷新</el-button>
    </div>

    <el-tabs v-model="active" class="sub-tabs">
      <el-tab-pane label="列 / 字段" name="cols">
        <el-table :data="columns" size="default" border stripe>
          <el-table-column label="字段" prop="field" />
          <el-table-column label="类型" prop="type">
            <template #default="{ row }">
              <el-tag size="small" :type="isTag(row) ? 'warning' : 'primary'">{{ row.type }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="长度" prop="length" width="100" />
          <el-table-column label="归属" prop="note" width="100">
            <template #default="{ row }">
              <span v-if="isTag(row)" class="tag-badge">TAG</span>
              <span v-else>COLUMN</span>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="建表语句" name="ddl">
        <el-input v-model="ddl" type="textarea" :rows="14" readonly class="ddl" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { useConnStore } from '@/stores/connections'
import type { EditorTab } from '@/types'

const props = defineProps<{ tab: EditorTab }>()
const connStore = useConnStore()

const loading = ref(false)
const active = ref('cols')
const columns = ref<any[]>([])
const ddl = ref('')

onMounted(reload)

function isTag(row: any) {
  return (row.note || '').toUpperCase() === 'TAG'
}

async function reload() {
  const conn = connStore.rawById(props.tab.connId)
  if (!conn) return
  loading.value = true
  try {
    const res = await window.tdApi.query({
      conn, sql: `DESCRIBE \`${props.tab.database}\`.\`${props.tab.tableName}\``
    })
    if (res.ok) {
      columns.value = res.rows.map((r) => ({
        field: r[0], type: r[1], length: r[2], note: r[3] || ''
      }))
    }
    const showRes = await window.tdApi.query({
      conn, sql: `SHOW CREATE TABLE \`${props.tab.database}\`.\`${props.tab.tableName}\``
    })
    if (showRes.ok && showRes.rows.length) {
      ddl.value = showRes.rows[0][1] || ''
    } else {
      const showS = await window.tdApi.query({
        conn, sql: `SHOW CREATE STABLE \`${props.tab.database}\`.\`${props.tab.tableName}\``
      })
      if (showS.ok && showS.rows.length) ddl.value = showS.rows[0][1] || ''
    }
  } finally { loading.value = false }
}
</script>

<style lang="scss" scoped>
.struct {
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
}
.sub-tabs {
  flex: 1;
  padding: 8px 12px;
  overflow: auto;
}
.muted { color: var(--td-text-sub); font-size: 12px; }
.tag-badge {
  background: #f59e0b;
  color: #fff;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
}
.ddl :deep(textarea) {
  font-family: 'Fira Code', Consolas, Menlo, monospace;
  font-size: 12px;
}
</style>
