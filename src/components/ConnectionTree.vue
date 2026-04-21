<template>
  <div class="conn-tree">
    <div class="tree-search">
      <el-input
        v-model="filter"
        placeholder="搜索连接 / 数据库 / 表..."
        size="small"
        clearable
        :prefix-icon="Search"
      />
    </div>

    <el-scrollbar class="tree-scroll">
      <el-tree
        ref="treeRef"
        :data="treeData"
        node-key="key"
        :props="{ label: 'label', children: 'children' }"
        :filter-node-method="filterNode"
        :expand-on-click-node="true"
        :load="loadNode"
        lazy
        highlight-current
        @node-contextmenu="onContextMenu"
        @node-click="onNodeClick"
      >
        <template #default="{ node, data }">
          <span class="node" :class="data.type">
            <component :is="iconFor(data)" class="ic" />
            <span class="label">{{ node.label }}</span>
            <span v-if="data.type === 'conn'" class="tail">
              <el-tag
                v-if="connStore.active.has(data.id)"
                size="small"
                type="success"
                effect="dark"
              >已连</el-tag>
            </span>
          </span>
        </template>
      </el-tree>
    </el-scrollbar>

    <ExportSqlDialog
      v-model="exportDialog"
      :database="exportDatabase"
      :sql="exportSql"
      :stats="exportStats"
    />

    <ul v-if="menu.show" class="ctx-menu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }">
      <template v-if="menu.data?.type === 'conn'">
        <li @click="doConnect">{{ connStore.active.has(menu.data.id) ? '断开' : '连接' }}</li>
        <li v-if="connStore.active.has(menu.data.id)" @click="refreshConn">刷新</li>
        <li v-if="connStore.active.has(menu.data.id)" @click="doNewDb">新建数据库</li>
        <li class="divider" />
        <li @click="emitEdit">编辑连接</li>
        <li @click="doRemove" class="danger">删除连接</li>
      </template>
      <template v-else-if="menu.data?.type === 'db'">
        <li @click="useDb">打开查询</li>
        <li @click="doNewTable">新建表 / 超级表</li>
        <li @click="refreshDb">刷新</li>
        <li class="divider" />
        <li @click="copyCreateDb">复制建库语句</li>
        <li @click="exportDbDdl">导出建库建表 SQL...</li>
        <li @click="dropDb" class="danger">删除数据库</li>
      </template>
      <template v-else-if="menu.data?.type === 'table' || menu.data?.type === 'stable' || menu.data?.type === 'view'">
        <li @click="viewData">浏览数据</li>
        <li @click="viewStructure">设计结构</li>
        <li class="divider" />
        <li @click="copyCreateTable">复制建表语句</li>
        <li @click="dropTable" class="danger">删除</li>
      </template>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import {
  Search, Connection, Coin, Grid, DataBoard, User, View
} from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage, ElLoading } from 'element-plus'
import ExportSqlDialog from './ExportSqlDialog.vue'
import { useConnStore } from '@/stores/connections'
import { useTabsStore } from '@/stores/tabs'

const emit = defineEmits<{
  'edit-conn': [c: any]
  'new-db': [connId: string]
  'new-table': [p: { connId: string; database: string }]
}>()

const connStore = useConnStore()
const tabsStore = useTabsStore()
const treeRef = ref()
const filter = ref('')

const treeData = computed(() =>
  connStore.list.map((c) => ({
    key: `c:${c.id}`,
    id: c.id,
    label: c.name,
    type: 'conn',
    color: c.color,
    isLeaf: false
  }))
)

watch(filter, (v) => treeRef.value?.filter(v))

function filterNode(value: string, data: any) {
  if (!value) return true
  return String(data.label).toLowerCase().includes(value.toLowerCase())
}

function iconFor(data: any) {
  const map: any = {
    conn: Connection,
    db: Coin,
    'folder-stable': DataBoard,
    'folder-table': Grid,
    'folder-view': View,
    'folder-user': User,
    stable: DataBoard,
    table: Grid,
    view: View,
    user: User
  }
  return map[data.type] || Grid
}

async function loadNode(node: any, resolve: (d: any[]) => void) {
  if (node.level === 0) return resolve(treeData.value)
  const data = node.data
  try {
    if (data.type === 'conn') {
      if (!connStore.active.has(data.id)) {
        try {
          await connStore.connect(data.id)
        } catch (e: any) {
          ElMessage.error(e.message || '连接失败')
          return resolve([])
        }
      }
      const dbs = connStore.databases[data.id] || []
      return resolve(
        dbs.map((db) => ({
          key: `c:${data.id}:d:${db}`,
          label: db,
          type: 'db',
          connId: data.id,
          database: db,
          isLeaf: false
        }))
      )
    }
    if (data.type === 'db') {
      return resolve([
        { key: `${data.key}:stables`, label: '超级表', type: 'folder-stable', connId: data.connId, database: data.database },
        { key: `${data.key}:tables`, label: '普通表', type: 'folder-table', connId: data.connId, database: data.database },
        { key: `${data.key}:views`, label: '视图', type: 'folder-view', connId: data.connId, database: data.database }
      ])
    }
    if (data.type === 'folder-stable') {
      const rows = await runSql(data.connId, `SHOW ${data.database}.STABLES`)
      return resolve(
        rows.map((r) => ({
          key: `${data.key}:${r[0]}`,
          label: r[0],
          type: 'stable',
          connId: data.connId,
          database: data.database,
          tableName: r[0],
          isLeaf: true
        }))
      )
    }
    if (data.type === 'folder-table') {
      const rows = await runSql(data.connId, `SHOW ${data.database}.TABLES`)
      return resolve(
        rows.map((r) => ({
          key: `${data.key}:${r[0]}`,
          label: r[0],
          type: 'table',
          connId: data.connId,
          database: data.database,
          tableName: r[0],
          isLeaf: true
        }))
      )
    }
    if (data.type === 'folder-view') {
      try {
        const rows = await runSql(data.connId, `SHOW ${data.database}.VIEWS`)
        return resolve(
          rows.map((r) => ({
            key: `${data.key}:${r[0]}`,
            label: r[0],
            type: 'view',
            connId: data.connId,
            database: data.database,
            tableName: r[0],
            isLeaf: true
          }))
        )
      } catch { return resolve([]) }
    }
    resolve([])
  } catch (e: any) {
    ElMessage.error(e.message || '加载失败')
    resolve([])
  }
}

async function runSql(connId: string, sql: string) {
  const conn = connStore.rawById(connId)!
  const res = await window.tdApi.query({ conn, sql })
  if (!res.ok) throw new Error(res.error)
  return res.rows
}

/* ---- 右键菜单 ---- */
const menu = ref({ show: false, x: 0, y: 0, data: null as any })
function onContextMenu(e: MouseEvent, data: any) {
  e.preventDefault()
  menu.value = { show: true, x: e.clientX, y: e.clientY, data }
}
function closeMenu() { menu.value.show = false }

function refreshNode(key: string) {
  const node = treeRef.value?.getNode?.(key)
  if (!node) return
  node.loaded = false
  node.childNodes = []
  nextTick(() => node.expand())
}

onMounted(() => {
  document.addEventListener('click', closeMenu)
  connStore.registerTreeRefresh(refreshNode)
})
onBeforeUnmount(() => document.removeEventListener('click', closeMenu))

function onNodeClick(data: any) {
  if (data.type === 'conn') {
    connStore.setCurrentContext(data.id, '')
    return
  }
  if (data.type === 'db') {
    connStore.setCurrentContext(data.connId, data.database)
    return
  }
  if (['folder-stable', 'folder-table', 'folder-view'].includes(data.type)) {
    connStore.setCurrentContext(data.connId, data.database)
    return
  }
  if (['table', 'stable', 'view'].includes(data.type)) {
    connStore.setCurrentContext(data.connId, data.database)
    tabsStore.open({
      type: 'table',
      connId: data.connId,
      database: data.database,
      tableName: data.tableName,
      title: data.tableName
    })
  }
}

async function doConnect() {
  const d = menu.value.data
  if (connStore.active.has(d.id)) connStore.disconnect(d.id)
  else {
    try { await connStore.connect(d.id); ElMessage.success('已连接') }
    catch (e: any) { ElMessage.error(e.message) }
  }
}

function emitEdit() {
  emit('edit-conn', connStore.byId(menu.value.data.id))
}

async function doRemove() {
  const d = menu.value.data
  await ElMessageBox.confirm(`确定删除连接 "${d.label}"?`, '提示', { type: 'warning' })
  await connStore.remove(d.id)
}

function doNewDb() {
  emit('new-db', menu.value.data.id)
}

function doNewTable() {
  const d = menu.value.data
  emit('new-table', { connId: d.connId, database: d.database })
}

function useDb() {
  const d = menu.value.data
  tabsStore.open({
    type: 'sql', connId: d.connId, database: d.database,
    title: `${d.database}`, sql: `USE ${d.database};\n\nSELECT * FROM `
  })
}

async function dropDb() {
  const d = menu.value.data
  await ElMessageBox.confirm(`删除数据库 "${d.database}"? 此操作不可恢复`, '危险操作', { type: 'error' })
  await runSql(d.connId, `DROP DATABASE IF EXISTS \`${d.database}\``)
  await connStore.connect(d.connId)
  connStore.refreshTree(`c:${d.connId}`)
  ElMessage.success('已删除')
}

function viewData() {
  const d = menu.value.data
  tabsStore.open({
    type: 'table', connId: d.connId, database: d.database,
    tableName: d.tableName, title: d.tableName
  })
}

function viewStructure() {
  const d = menu.value.data
  tabsStore.open({
    type: 'structure', connId: d.connId, database: d.database,
    tableName: d.tableName, title: `${d.tableName} 结构`
  })
}

async function dropTable() {
  const d = menu.value.data
  await ElMessageBox.confirm(`删除 "${d.tableName}"? 此操作不可恢复`, '危险操作', { type: 'error' })
  const sql = d.type === 'stable'
    ? `DROP STABLE \`${d.database}\`.\`${d.tableName}\``
    : `DROP TABLE \`${d.database}\`.\`${d.tableName}\``
  await runSql(d.connId, sql)
  ElMessage.success('已删除')
  const folder = d.type === 'stable' ? 'stables' : d.type === 'view' ? 'views' : 'tables'
  connStore.refreshTree(`c:${d.connId}:d:${d.database}:${folder}`)
}

async function refreshConn() {
  const d = menu.value.data
  try {
    await connStore.connect(d.id)
    connStore.refreshTree(`c:${d.id}`)
    ElMessage.success('已刷新')
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

function refreshDb() {
  const d = menu.value.data
  ;['stables', 'tables', 'views'].forEach((f) =>
    connStore.refreshTree(`c:${d.connId}:d:${d.database}:${f}`)
  )
  ElMessage.success('已刷新')
}

async function copyCreateDb() {
  const d = menu.value.data
  try {
    const rows = await runSql(d.connId, `SHOW CREATE DATABASE \`${d.database}\``)
    const ddl = rows[0]?.[1] || rows[0]?.[0] || ''
    if (!ddl) return ElMessage.warning('未获取到 DDL')
    await navigator.clipboard.writeText(String(ddl))
    ElMessage.success('建库语句已复制')
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

async function copyCreateTable() {
  const d = menu.value.data
  try {
    const stmt = d.type === 'stable' ? 'STABLE' : 'TABLE'
    const rows = await runSql(
      d.connId,
      `SHOW CREATE ${stmt} \`${d.database}\`.\`${d.tableName}\``
    )
    const ddl = rows[0]?.[1] || rows[0]?.[0] || ''
    if (!ddl) return ElMessage.warning('未获取到 DDL')
    await navigator.clipboard.writeText(String(ddl))
    ElMessage.success('建表语句已复制')
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

/* ---------- 导出整库 DDL ---------- */
const exportDialog = ref(false)
const exportSql = ref('')
const exportDatabase = ref('')
const exportStats = ref({ db: 0, stables: 0, tables: 0, views: 0, errors: 0 })

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

async function exportDbDdl() {
  const d = menu.value.data
  const conn = connStore.rawById(d.connId)
  if (!conn) return
  const db = d.database

  const loading = ElLoading.service({
    lock: true,
    text: `正在导出 ${db} 的 DDL...`,
    background: 'rgba(0,0,0,0.4)'
  })

  const run = (sql: string) => window.tdApi.query({ conn, sql })
  const lines: string[] = []
  const stats = { db: 0, stables: 0, tables: 0, views: 0, errors: 0 }

  const bump = (msg: string) => {
    loading.setText(msg)
  }

  try {
    lines.push(
      `-- TDengine DDL Export`,
      `-- Database: ${db}`,
      `-- Connection: ${conn.name} (${conn.host}:${conn.port})`,
      `-- Generated: ${new Date().toLocaleString()}`,
      ''
    )

    bump('导出建库语句...')
    const dbRes = await run(`SHOW CREATE DATABASE \`${db}\``)
    if (dbRes.ok && dbRes.rows[0]) {
      const ddl = String(dbRes.rows[0][1] || dbRes.rows[0][0] || '').trim()
      if (ddl) {
        lines.push('-- ========== DATABASE ==========')
        lines.push(ddl + ';', '')
        stats.db = 1
      }
    }

    bump('扫描超级表...')
    const stRes = await run(
      `SELECT stable_name FROM information_schema.ins_stables WHERE db_name='${db}' ORDER BY stable_name`
    )
    const stables = stRes.ok ? stRes.rows.map((r) => String(r[0])) : []

    if (stables.length) {
      lines.push(`-- ========== SUPER TABLES (${stables.length}) ==========`)
      let done = 0
      for (const group of chunk(stables, 16)) {
        const results = await Promise.all(
          group.map((name) =>
            run(`SHOW CREATE STABLE \`${db}\`.\`${name}\``).catch((e) => ({
              ok: false,
              error: String(e)
            }))
          )
        )
        group.forEach((name, i) => {
          const r: any = results[i]
          if (r.ok && r.rows?.[0]) {
            const ddl = String(r.rows[0][1] || r.rows[0][0] || '').trim()
            if (ddl) {
              lines.push(`-- STABLE: ${name}`, ddl + ';', '')
              stats.stables++
              return
            }
          }
          lines.push(`-- STABLE: ${name} (导出失败: ${r.error || 'unknown'})`, '')
          stats.errors++
        })
        done += group.length
        bump(`导出超级表 ${done}/${stables.length}...`)
      }
    }

    bump('扫描普通表...')
    const tbRes = await run(
      `SELECT table_name FROM information_schema.ins_tables WHERE db_name='${db}' AND (stable_name IS NULL OR stable_name='') ORDER BY table_name`
    )
    const tables = tbRes.ok ? tbRes.rows.map((r) => String(r[0])) : []

    if (tables.length) {
      lines.push(`-- ========== NORMAL TABLES (${tables.length}) ==========`)
      let done = 0
      for (const group of chunk(tables, 16)) {
        const results = await Promise.all(
          group.map((name) =>
            run(`SHOW CREATE TABLE \`${db}\`.\`${name}\``).catch((e) => ({
              ok: false,
              error: String(e)
            }))
          )
        )
        group.forEach((name, i) => {
          const r: any = results[i]
          if (r.ok && r.rows?.[0]) {
            const ddl = String(r.rows[0][1] || r.rows[0][0] || '').trim()
            if (ddl) {
              lines.push(`-- TABLE: ${name}`, ddl + ';', '')
              stats.tables++
              return
            }
          }
          lines.push(`-- TABLE: ${name} (导出失败: ${r.error || 'unknown'})`, '')
          stats.errors++
        })
        done += group.length
        bump(`导出普通表 ${done}/${tables.length}...`)
      }
    }

    bump('扫描视图...')
    try {
      const vRes = await run(`SHOW \`${db}\`.VIEWS`)
      if (vRes.ok && vRes.rows.length) {
        lines.push(`-- ========== VIEWS (${vRes.rows.length}) ==========`)
        for (const row of vRes.rows) {
          const name = String(row[0])
          const r = await run(`SHOW CREATE VIEW \`${db}\`.\`${name}\``).catch(() => null)
          if (r?.ok && r.rows?.[0]) {
            const ddl = String(r.rows[0][1] || r.rows[0][0] || '').trim()
            if (ddl) {
              lines.push(`-- VIEW: ${name}`, ddl + ';', '')
              stats.views++
              continue
            }
          }
          stats.errors++
        }
      }
    } catch {
      /* 视图可能不被版本支持 */
    }

    exportSql.value = lines.join('\n')
    exportDatabase.value = db
    exportStats.value = stats
    exportDialog.value = true
  } catch (e: any) {
    ElMessage.error(e.message || String(e))
  } finally {
    loading.close()
  }
}
</script>

<style lang="scss" scoped>
.conn-tree {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tree-search {
  padding: 10px 10px 6px;
  border-bottom: 1px solid var(--td-border);
}

.tree-scroll {
  flex: 1;
  padding: 4px 0;
}

.node {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  font-size: 13px;
  .ic { width: 14px; height: 14px; color: var(--td-text-sub); }
  .label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &.conn .ic { color: #3b82f6; }
  &.db .ic { color: #f59e0b; }
  &.stable .ic { color: #10b981; }
}

.ctx-menu {
  position: fixed;
  z-index: 9999;
  min-width: 160px;
  padding: 4px 0;
  background: var(--td-header);
  border: 1px solid var(--td-border);
  border-radius: 6px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
  font-size: 13px;
  li {
    list-style: none;
    padding: 6px 14px;
    cursor: pointer;
    &:hover { background: var(--el-color-primary); color: #fff; }
    &.danger { color: #f56c6c; }
    &.danger:hover { background: #f56c6c; color: #fff; }
    &.divider {
      height: 1px;
      margin: 4px 0;
      padding: 0;
      background: var(--td-border);
      cursor: default;
      pointer-events: none;
    }
  }
}
</style>
