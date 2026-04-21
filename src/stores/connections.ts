import { defineStore } from 'pinia'
import { v4 as uuid } from 'uuid'
import type { ConnectionProfile } from '@/types'

export const useConnStore = defineStore('connections', {
  state: () => ({
    list: [] as ConnectionProfile[],
    active: new Set<string>(),
    databases: {} as Record<string, string[]>,
    currentConnId: '',
    currentDatabase: '',
    _treeRefresh: null as ((key: string) => void) | null
  }),
  actions: {
    setCurrentContext(connId: string, database = '') {
      this.currentConnId = connId
      this.currentDatabase = database
    },
    registerTreeRefresh(fn: (key: string) => void) {
      this._treeRefresh = fn
    },
    refreshTree(key: string) {
      this._treeRefresh?.(key)
    },
    async load() {
      this.list = await window.tdApi.listConnections()
    },
    async save(c: Partial<ConnectionProfile>) {
      const profile: ConnectionProfile = JSON.parse(JSON.stringify({
        id: c.id || uuid(),
        name: c.name || 'New Connection',
        host: c.host || 'localhost',
        port: c.port || 6041,
        user: c.user || 'root',
        password: c.password || 'taosdata',
        database: c.database || '',
        token: c.token || '',
        useHttps: c.useHttps || false,
        color: c.color || '#409eff'
      }))
      this.list = await window.tdApi.saveConnection(profile)
      return profile
    },
    async remove(id: string) {
      this.list = await window.tdApi.deleteConnection(id)
      this.active.delete(id)
      delete this.databases[id]
      if (this.currentConnId === id) {
        this.currentConnId = ''
        this.currentDatabase = ''
      }
    },
    async connect(id: string) {
      const conn = this.rawById(id)
      if (!conn) return false
      const res = await window.tdApi.query({ conn, sql: 'SHOW DATABASES' })
      if (!res.ok) throw new Error(res.error)
      this.active.add(id)
      const nameIdx = res.columns.findIndex((c) => c.name === 'name')
      this.databases[id] = res.rows.map((r) => r[nameIdx >= 0 ? nameIdx : 0])
      return true
    },
    disconnect(id: string) {
      this.active.delete(id)
      delete this.databases[id]
      if (this.currentConnId === id) {
        this.currentConnId = ''
        this.currentDatabase = ''
      }
    },
    byId(id: string) {
      return this.list.find((x) => x.id === id)
    },
    rawById(id: string) {
      const c = this.list.find((x) => x.id === id)
      return c ? (JSON.parse(JSON.stringify(c)) as ConnectionProfile) : null
    }
  }
})
