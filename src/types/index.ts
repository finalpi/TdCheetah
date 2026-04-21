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

export interface QueryResult {
  ok: boolean
  code: number
  columns: { name: string; type: string; bytes: number }[]
  rows: any[][]
  affected: number
  elapsedMs: number
  error?: string
}

export interface HistoryItem {
  id: string
  connId: string
  connName: string
  database?: string
  sql: string
  ok: boolean
  elapsedMs: number
  error?: string
  at: number
}

export interface EditorTab {
  id: string
  title: string
  type: 'sql' | 'table' | 'structure'
  connId: string
  database?: string
  tableName?: string
  sql?: string
  result?: QueryResult
  loading?: boolean
  dirty?: boolean
}

declare global {
  interface Window {
    tdApi: {
      query: (p: { conn: ConnectionProfile; sql: string; database?: string }) => Promise<QueryResult>
      testConnection: (c: ConnectionProfile) => Promise<QueryResult>
      listConnections: () => Promise<ConnectionProfile[]>
      saveConnection: (c: ConnectionProfile) => Promise<ConnectionProfile[]>
      deleteConnection: (id: string) => Promise<ConnectionProfile[]>
      getHistory: () => Promise<HistoryItem[]>
      pushHistory: (i: HistoryItem) => Promise<void>
      clearHistory: () => Promise<void>
    }
  }
}
