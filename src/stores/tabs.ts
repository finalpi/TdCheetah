import { defineStore } from 'pinia'
import { v4 as uuid } from 'uuid'
import type { EditorTab } from '@/types'

export const useTabsStore = defineStore('tabs', {
  state: () => ({
    tabs: [] as EditorTab[],
    activeId: ''
  }),
  actions: {
    open(tab: Partial<EditorTab>) {
      const existing = this.tabs.find(
        (t) =>
          t.type === tab.type &&
          t.connId === tab.connId &&
          t.database === tab.database &&
          t.tableName === tab.tableName &&
          t.type !== 'sql'
      )
      if (existing) {
        this.activeId = existing.id
        return existing
      }
      const t: EditorTab = {
        id: uuid(),
        title: tab.title || '新建查询',
        type: tab.type || 'sql',
        connId: tab.connId!,
        database: tab.database,
        tableName: tab.tableName,
        sql: tab.sql || ''
      }
      this.tabs.push(t)
      this.activeId = t.id
      return t
    },
    close(id: string) {
      const i = this.tabs.findIndex((x) => x.id === id)
      if (i < 0) return
      this.tabs.splice(i, 1)
      if (this.activeId === id) {
        this.activeId = this.tabs[i]?.id || this.tabs[i - 1]?.id || ''
      }
    },
    active() {
      return this.tabs.find((t) => t.id === this.activeId)
    },
    update(id: string, patch: Partial<EditorTab>) {
      const t = this.tabs.find((x) => x.id === id)
      if (t) Object.assign(t, patch)
    }
  }
})
