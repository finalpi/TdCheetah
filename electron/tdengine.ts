import type { IpcMain } from 'electron'
import { net } from 'electron'

interface ConnectionProfile {
  host: string
  port: number
  user: string
  password: string
  token?: string
  useHttps?: boolean
}

function authHeader(c: ConnectionProfile) {
  if (c.token) return `Taosd ${c.token}`
  const basic = Buffer.from(`${c.user}:${c.password}`).toString('base64')
  return `Basic ${basic}`
}

function request(c: ConnectionProfile, sql: string, db?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const proto = c.useHttps ? 'https' : 'http'
    const url = `${proto}://${c.host}:${c.port}/rest/sql${db ? '/' + db : ''}`
    const r = net.request({ method: 'POST', url })
    r.setHeader('Authorization', authHeader(c))
    r.setHeader('Content-Type', 'text/plain')

    let chunks: Buffer[] = []
    r.on('response', (res) => {
      res.on('data', (d) => chunks.push(d as Buffer))
      res.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf-8')
          resolve(JSON.parse(body))
        } catch (e) {
          reject(e)
        }
      })
      res.on('error', reject)
    })
    r.on('error', reject)
    r.write(sql)
    r.end()
  })
}

function parseColumns(resp: any) {
  if (Array.isArray(resp.column_meta)) {
    return resp.column_meta.map((m: any[]) => ({ name: m[0], type: m[1], bytes: m[2] }))
  }
  if (Array.isArray(resp.head)) {
    const types = Array.isArray(resp.column_meta)
      ? resp.column_meta
      : Array.isArray(resp.head_types) ? resp.head_types : []
    return resp.head.map((name: string, i: number) => ({
      name,
      type: types[i]?.[1] || types[i] || 'VARCHAR',
      bytes: types[i]?.[2] || 0
    }))
  }
  return []
}

const pad = (n: number, len = 2) => String(n).padStart(len, '0')

function utcToLocalTs(v: any): any {
  if (v == null) return v
  if (typeof v === 'number') {
    const d = new Date(v)
    if (isNaN(d.getTime())) return v
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
  }
  if (typeof v !== 'string') return v
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/)
  if (!m) return v
  const [, y, mo, d, h, mi, s, frac = '', tz] = m
  const msPart = frac.slice(0, 3).padEnd(3, '0')
  const extra = frac.slice(3)
  const isoUtc = tz && tz !== 'Z'
    ? `${y}-${mo}-${d}T${h}:${mi}:${s}.${msPart}${tz}`
    : `${y}-${mo}-${d}T${h}:${mi}:${s}.${msPart}Z`
  const dt = new Date(isoUtc)
  if (isNaN(dt.getTime())) return v
  const local = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}.${pad(dt.getMilliseconds(), 3)}`
  return extra ? local + extra : local
}

function localizeRows(columns: any[], rows: any[][]): any[][] {
  const tsIdx: number[] = []
  columns.forEach((c, i) => {
    if (String(c.type || '').toUpperCase() === 'TIMESTAMP') tsIdx.push(i)
  })
  if (!tsIdx.length) return rows
  return rows.map((row) => {
    const out = row.slice()
    for (const i of tsIdx) out[i] = utcToLocalTs(out[i])
    return out
  })
}

function isOk(resp: any) {
  if (typeof resp.code === 'number') return resp.code === 0
  if (typeof resp.status === 'string') return resp.status.toLowerCase() === 'succ'
  return false
}

export function registerTdHandlers(ipc: IpcMain) {
  ipc.handle('td:query', async (_e, payload) => {
    const start = Date.now()
    try {
      const resp = await request(payload.conn, payload.sql, payload.database)
      const elapsedMs = Date.now() - start
      if (process.env.TD_DEBUG) {
        console.log('[td:query] sql =', payload.sql)
        console.log('[td:query] resp =', JSON.stringify(resp).slice(0, 500))
      }
      if (!isOk(resp)) {
        return {
          ok: false,
          code: resp.code ?? -1,
          columns: [],
          rows: [],
          affected: 0,
          elapsedMs,
          error: resp.desc || resp.message || resp.error || 'Unknown error'
        }
      }
      const columns = parseColumns(resp)
      const rawRows = Array.isArray(resp.data) ? resp.data : []
      const rows = localizeRows(columns, rawRows)
      return {
        ok: true,
        code: 0,
        columns,
        rows,
        affected: rows.length || (typeof resp.rows === 'number' ? resp.rows : 0),
        elapsedMs
      }
    } catch (err: any) {
      return {
        ok: false,
        code: -1,
        columns: [],
        rows: [],
        affected: 0,
        elapsedMs: Date.now() - start,
        error: err?.message || String(err)
      }
    }
  })

  ipc.handle('td:test', async (_e, conn) => {
    const start = Date.now()
    try {
      const resp = await request(conn, 'SHOW DATABASES')
      return {
        ok: resp.code === 0,
        code: resp.code,
        columns: [],
        rows: [],
        affected: 0,
        elapsedMs: Date.now() - start,
        error: resp.code !== 0 ? resp.desc : undefined
      }
    } catch (err: any) {
      return {
        ok: false,
        code: -1,
        columns: [],
        rows: [],
        affected: 0,
        elapsedMs: Date.now() - start,
        error: err?.message || String(err)
      }
    }
  })
}
