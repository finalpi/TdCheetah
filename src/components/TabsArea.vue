<template>
  <div class="tabs-area">
    <div v-if="!tabsStore.tabs.length" class="empty">
      <div class="welcome">
        <div class="logo-big">TC</div>
        <h2>TdCheetah</h2>
        <p class="sub">高性能 TDengine 可视化管理工具</p>
        <div class="tips">
          <p>· 在左侧双击或右键连接以开始</p>
          <p>· 支持 REST / HTTPS / Token 鉴权</p>
          <p>· 参考文档: <a href="https://docs.tdengine.com/reference/taos-sql/datatype/" target="_blank">TDengine SQL</a></p>
        </div>
      </div>
    </div>

    <el-tabs
      v-else
      v-model="tabsStore.activeId"
      type="card"
      closable
      class="editor-tabs"
      @tab-remove="tabsStore.close"
    >
      <el-tab-pane
        v-for="tab in tabsStore.tabs"
        :key="tab.id"
        :label="tab.title"
        :name="tab.id"
      >
        <div class="pane">
          <SqlEditor v-if="tab.type === 'sql'" :tab="tab" />
          <TableBrowser v-else-if="tab.type === 'table'" :tab="tab" />
          <TableStructure v-else-if="tab.type === 'structure'" :tab="tab" />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import SqlEditor from './SqlEditor.vue'
import TableBrowser from './TableBrowser.vue'
import TableStructure from './TableStructure.vue'
import { useTabsStore } from '@/stores/tabs'

const tabsStore = useTabsStore()
</script>

<style lang="scss" scoped>
.tabs-area {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--td-bg);
}

.editor-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;

  :deep(.el-tabs__header) {
    margin: 0;
    background: var(--td-header);
    border-bottom: 1px solid var(--td-border);
  }
  :deep(.el-tabs__content) {
    flex: 1;
    min-height: 0;
    height: 100%;
  }
  :deep(.el-tab-pane) {
    height: 100%;
  }
}

.pane {
  height: 100%;
  min-height: 0;
}

.empty {
  flex: 1;
  display: grid;
  place-items: center;
}

.welcome {
  text-align: center;
  color: var(--td-text-sub);
  .logo-big {
    width: 72px; height: 72px; margin: 0 auto 16px;
    border-radius: 14px;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    color: #fff; font-weight: 700; font-size: 24px;
    display: grid; place-items: center;
    box-shadow: 0 12px 40px rgba(59, 130, 246, 0.3);
  }
  h2 { margin: 0 0 6px; color: var(--td-text); }
  .sub { margin: 0 0 18px; }
  .tips p { font-size: 13px; margin: 4px 0; }
  a { color: var(--el-color-primary); }
}
</style>
