<template>
  <div class="app-layout">
    <header class="titlebar">
      <div class="brand">
        <span class="logo">TC</span>
        <span class="name">TdCheetah</span>
      </div>
      <div class="tools">
        <el-button size="small" :icon="Plus" @click="openConnDialog()">新建连接</el-button>
        <el-button size="small" :icon="Refresh" @click="refreshAll">刷新</el-button>
        <el-button size="small" :icon="Document" @click="newSqlTab">新建查询</el-button>
        <el-button size="small" :icon="Clock" @click="showHistory = true">历史</el-button>
        <el-switch
          v-model="isDark"
          size="small"
          inline-prompt
          active-text="暗"
          inactive-text="亮"
          @change="toggleTheme"
        />
      </div>
    </header>

    <div class="body">
      <aside class="sidebar" :style="{ width: sidebarWidth + 'px' }">
        <ConnectionTree
          @edit-conn="openConnDialog"
          @new-db="openDbDialog"
          @new-table="openTableDialog"
        />
      </aside>
      <div class="splitter" @mousedown="startResize"></div>
      <main class="main">
        <TabsArea />
      </main>
    </div>

    <footer class="statusbar">
      <span>连接数: {{ connStore.active.size }} / {{ connStore.list.length }}</span>
      <span v-if="active?.result" class="right">
        {{ active.result.affected }} 行 · {{ active.result.elapsedMs }} ms
      </span>
    </footer>

    <ConnectionDialog v-model="connDialog" :profile="editingConn" />
    <CreateDatabaseDialog v-model="dbDialog" :conn-id="dialogConnId" />
    <CreateTableDialog
      v-model="tableDialog"
      :conn-id="dialogConnId"
      :database="dialogDb"
    />
    <HistoryDrawer v-model="showHistory" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, Refresh, Document, Clock } from '@element-plus/icons-vue'
import ConnectionTree from '@/components/ConnectionTree.vue'
import TabsArea from '@/components/TabsArea.vue'
import ConnectionDialog from '@/components/ConnectionDialog.vue'
import CreateDatabaseDialog from '@/components/CreateDatabaseDialog.vue'
import CreateTableDialog from '@/components/CreateTableDialog.vue'
import HistoryDrawer from '@/components/HistoryDrawer.vue'
import { useConnStore } from '@/stores/connections'
import { useTabsStore } from '@/stores/tabs'
import type { ConnectionProfile } from '@/types'

const connStore = useConnStore()
const tabsStore = useTabsStore()

const sidebarWidth = ref(280)
const isDark = ref(true)
const connDialog = ref(false)
const dbDialog = ref(false)
const tableDialog = ref(false)
const showHistory = ref(false)
const editingConn = ref<Partial<ConnectionProfile> | null>(null)
const dialogConnId = ref('')
const dialogDb = ref('')

const active = computed(() => tabsStore.active())

onMounted(async () => {
  document.documentElement.classList.add('dark')
  await connStore.load()
})

function toggleTheme(v: string | number | boolean) {
  document.documentElement.classList.toggle('dark', !!v)
}

function openConnDialog(c?: ConnectionProfile) {
  editingConn.value = c ? { ...c } : null
  connDialog.value = true
}

function openDbDialog(connId: string) {
  dialogConnId.value = connId
  dbDialog.value = true
}

function openTableDialog(payload: { connId: string; database: string }) {
  dialogConnId.value = payload.connId
  dialogDb.value = payload.database
  tableDialog.value = true
}

function newSqlTab() {
  const current = tabsStore.active()
  // 优先级: 树上选中的库 > 当前活动 tab > 第一个已连接
  let connId = ''
  let database = ''
  if (connStore.currentConnId && connStore.active.has(connStore.currentConnId)) {
    connId = connStore.currentConnId
    database = connStore.currentDatabase || ''
  } else if (current && connStore.active.has(current.connId)) {
    connId = current.connId
    database = current.database || ''
  } else {
    connId = [...connStore.active][0] || ''
  }
  if (!connId) return ElMessage.warning('请先连接一个数据源')
  tabsStore.open({
    type: 'sql',
    connId,
    database,
    title: '查询 ' + (tabsStore.tabs.length + 1)
  })
}

async function refreshAll() {
  for (const id of connStore.active) {
    try { await connStore.connect(id) } catch {}
  }
}

function startResize(e: MouseEvent) {
  const startX = e.clientX
  const startW = sidebarWidth.value
  const onMove = (ev: MouseEvent) => {
    sidebarWidth.value = Math.max(200, Math.min(520, startW + ev.clientX - startX))
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
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--td-bg);
  color: var(--td-text);
}

.titlebar {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--td-header);
  border-bottom: 1px solid var(--td-border);
  -webkit-app-region: drag;

  .tools { -webkit-app-region: no-drag; display: flex; gap: 6px; align-items: center; }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
    .logo {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #fff;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: grid;
      place-items: center;
      font-size: 13px;
      letter-spacing: 0.5px;
    }
  }
}

.body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.sidebar {
  background: var(--td-sidebar);
  border-right: 1px solid var(--td-border);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.splitter {
  width: 4px;
  background: transparent;
  cursor: col-resize;
  &:hover { background: var(--el-color-primary); }
}

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.statusbar {
  height: 26px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 14px;
  font-size: 12px;
  background: var(--td-header);
  border-top: 1px solid var(--td-border);
  color: var(--td-text-sub);
}
</style>
