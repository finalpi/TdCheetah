import { contextBridge, ipcRenderer } from 'electron'

export interface ConnectionProfile {
  id: string
  name: string
  host: string
  port: number
  user: string
  password: string
  database?: string
  token?: string
  useHttps?: boolean
  color?: string
}

export interface QueryPayload {
  conn: ConnectionProfile
  sql: string
  database?: string
}

export interface QueryResult {
  ok: boolean
  code: number
  columns: { name: string; type: string; bytes: number }[]
  rows: any[][]
  affected: number
  elapsedMs: number
  error?: string
}

const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)))

async function loggedQuery(payload: QueryPayload): Promise<QueryResult> {
  const p = clone(payload)
  const sqlOneLine = String(p.sql).replace(/\s+/g, ' ').trim()
  const label = `SQL [${p.conn?.name || p.conn?.host}${p.database ? '/' + p.database : ''}] ${sqlOneLine.slice(0, 120)}`
  console.groupCollapsed(`%c▶ ${label}`, 'color:#3b82f6;font-weight:600')
  console.log('%cSQL:', 'color:#6b7280', p.sql)
  const start = performance.now()
  const res: QueryResult = await ipcRenderer.invoke('td:query', p)
  const cost = (performance.now() - start).toFixed(1)
  if (res.ok) {
    console.log(
      `%c✓ ${res.affected} 行 · ${res.elapsedMs}ms (ipc ${cost}ms)`,
      'color:#10b981;font-weight:600'
    )
    if (res.columns?.length) console.table(res.columns)
    if (res.rows?.length) {
      const sample = res.rows.slice(0, 50).map((row) => {
        const obj: any = {}
        res.columns.forEach((c, i) => (obj[c.name] = row[i]))
        return obj
      })
      console.log('Preview (first 50 rows):')
      console.table(sample)
    }
  } else {
    console.log(`%c✗ ${res.error}`, 'color:#ef4444;font-weight:600')
  }
  console.groupEnd()
  return res
}

const api = {
  query: loggedQuery,
  testConnection: (conn: ConnectionProfile): Promise<QueryResult> =>
    ipcRenderer.invoke('td:test', clone(conn)),
  listConnections: (): Promise<ConnectionProfile[]> =>
    ipcRenderer.invoke('store:connections:list'),
  saveConnection: (c: ConnectionProfile): Promise<ConnectionProfile[]> =>
    ipcRenderer.invoke('store:connections:save', clone(c)),
  deleteConnection: (id: string): Promise<ConnectionProfile[]> =>
    ipcRenderer.invoke('store:connections:delete', id),
  getHistory: (): Promise<any[]> => ipcRenderer.invoke('store:history:list'),
  pushHistory: (item: any): Promise<void> =>
    ipcRenderer.invoke('store:history:push', clone(item)),
  clearHistory: (): Promise<void> => ipcRenderer.invoke('store:history:clear')
}

contextBridge.exposeInMainWorld('tdApi', api)

export type TdApi = typeof api
