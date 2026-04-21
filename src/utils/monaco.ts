import * as monaco from 'monaco-editor'
import { TD_KEYWORDS, TD_FUNCTIONS, TD_DATA_TYPES } from './tdengine'
import { useConnStore } from '@/stores/connections'

// @ts-ignore
self.MonacoEnvironment = {
  getWorker() {
    return new Worker(
      new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
      { type: 'module' }
    )
  }
}

/* ---------- 编辑器上下文（连接 / 数据库） ---------- */
interface EditorCtx {
  connId: string
  database: string
}
const editorContexts = new Map<string, EditorCtx>()

export function setEditorContext(uri: string, ctx: EditorCtx) {
  editorContexts.set(uri, ctx)
}
export function clearEditorContext(uri: string) {
  editorContexts.delete(uri)
}

/* ---------- 元数据缓存（60 秒 TTL） ---------- */
const metaCache = new Map<string, { data: any; at: number }>()
const TTL = 60_000

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const c = metaCache.get(key)
  if (c && Date.now() - c.at < TTL) return c.data
  try {
    const data = await fn()
    metaCache.set(key, { data, at: Date.now() })
    return data
  } catch {
    return (c?.data as T) ?? ([] as unknown as T)
  }
}

export function invalidateMetaCache(prefix?: string) {
  if (!prefix) return metaCache.clear()
  for (const k of metaCache.keys()) if (k.startsWith(prefix)) metaCache.delete(k)
}

/* ---------- 上下文检测 ---------- */
function stripCommentsAndStrings(s: string): string {
  return s
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
}

type Scope = 'table' | 'column' | 'expr' | 'statement' | 'ddl-type' | 'word' | 'none'

function detectScope(before: string): Scope {
  const trimmed = before.replace(/\s+$/, '')
  const tail = trimmed.slice(-80) // 只看最后 80 字符，足够判断
  const endsWithWord = /[a-zA-Z_][\w]*$/.test(before) && !/\s$/.test(before)

  // 用户正在敲标识符前缀
  if (endsWithWord) {
    // 但要看在什么位置——如果前面是 FROM 类，算 table word
    if (/\b(?:FROM|JOIN|INTO|UPDATE|DESC|DESCRIBE|USE)\s+[`\w.]*$/i.test(tail)) return 'table'
    if (/\b(?:WHERE|AND|OR|ON|HAVING|SET|BY)\s+[`\w.]*$/i.test(tail)) return 'column'
    if (/\bSELECT\s+[`\w,\s.*]*$/i.test(tail)) return 'expr'
    if (/,\s*[`\w.]*$/.test(tail)) return 'expr'
    // 起始位置（空库 or 刚 ;）
    if (/(^|;)\s*[`\w]*$/.test(trimmed)) return 'statement'
    // DDL 类型位置：CREATE TABLE x (col ?
    if (/\(\s*[`\w]+\s+[`\w]*$/i.test(tail) && /\bCREATE\s+(TABLE|STABLE)\b/i.test(trimmed)) {
      return 'ddl-type'
    }
    return 'word'
  }

  // 空白尾部 —— 只有在紧跟关键字之后才给具体建议，其余情况返回 none
  if (/\b(?:FROM|JOIN|INTO|UPDATE|DESC|DESCRIBE|USE)\s+$/i.test(tail)) return 'table'
  if (/\b(?:WHERE|AND|OR|ON|HAVING|SET)\s+$/i.test(tail)) return 'column'
  if (/\b(?:GROUP|ORDER|PARTITION|CLUSTER)\s+BY\s+$/i.test(tail)) return 'column'
  if (/\bSELECT\s+$/i.test(tail) || /,\s*$/.test(tail)) return 'expr'
  // 注意：不再把 "语句起始 + 空白" 视为自动弹条件；只有用户敲了标识符前缀才弹
  return 'none'
}

function extractDotPrefix(before: string): string | undefined {
  const m = /\b(?:FROM|JOIN|INTO|UPDATE|USE)\s+`?([a-zA-Z_][\w]*)`?\s*\.\s*[`\w]*$/i.exec(before)
  return m?.[1]
}

/* ---------- FROM / JOIN 表名提取 ---------- */
interface TableRef { db?: string; table: string; alias?: string }

function extractTables(sql: string): TableRef[] {
  // FROM/JOIN/INTO/UPDATE (`db`.`t` | db.t | t) [AS alias]
  const re =
    /\b(?:FROM|JOIN|INTO|UPDATE)\s+(?:`([^`]+)`|([a-zA-Z_][\w]*))(?:\s*\.\s*(?:`([^`]+)`|([a-zA-Z_][\w]*)))?(?:\s+(?:AS\s+)?([a-zA-Z_][\w]*))?/gi
  const out: TableRef[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(sql))) {
    const a = m[1] || m[2]
    const b = m[3] || m[4]
    const alias = m[5]
    if (b) out.push({ db: a, table: b, alias })
    else out.push({ table: a, alias })
  }
  return out
}

/* ---------- 语言 / 高亮 / 主题 ---------- */
// 用 globalThis 存 disposables，HMR 重载 monaco.ts 模块时也能清掉旧 provider
const G = globalThis as any
const KEY = '__tdsql_disposables__'
const disposables: monaco.IDisposable[] = G[KEY] || (G[KEY] = [])

export function registerTdSql() {
  disposables.forEach((d) => d.dispose())
  disposables.length = 0

  if (!monaco.languages.getLanguages().some((l) => l.id === 'tdsql')) {
    monaco.languages.register({ id: 'tdsql' })
  }

  disposables.push(monaco.languages.setMonarchTokensProvider('tdsql', {
    defaultToken: '',
    ignoreCase: true,
    keywords: TD_KEYWORDS.flatMap((k) => k.split(' ')),
    typeKeywords: TD_DATA_TYPES.map((t) => t.name.split(' ')[0]),
    builtinFunctions: TD_FUNCTIONS,
    operators: ['=', '>', '<', '!=', '<=', '>=', '<>', '+', '-', '*', '/', '%'],
    symbols: /[=><!~?:&|+\-*/^%]+/,
    tokenizer: {
      root: [
        [/--.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/'([^'\\]|\\.)*$/, 'string.invalid'],
        [/'/, 'string', '@string_single'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string_double'],
        [/\d*\.\d+([eE][-+]?\d+)?/, 'number.float'],
        [/\d+/, 'number'],
        [
          /[a-zA-Z_][\w]*/,
          {
            cases: {
              '@typeKeywords': 'type',
              '@keywords': 'keyword',
              '@builtinFunctions': 'predefined',
              '@default': 'identifier'
            }
          }
        ],
        [/[;,.]/, 'delimiter'],
        [/[(){}\[\]]/, '@brackets']
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment']
      ],
      string_single: [
        [/[^\\']+/, 'string'],
        [/\\./, 'string.escape'],
        [/'/, 'string', '@pop']
      ],
      string_double: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop']
      ]
    }
  }))

  disposables.push(monaco.languages.registerCompletionItemProvider('tdsql', {
    triggerCharacters: [' ', '.', '`', ','],
    async provideCompletionItems(model, position) {
      const uri = model.uri.toString()
      const ctx = editorContexts.get(uri)
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      }

      const textBefore = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      })
      const cleanBefore = stripCommentsAndStrings(textBefore)
      const scope = detectScope(cleanBefore)

      // 新行/空白处（用户没在敲字）且没识别到 SQL 上下文 → 不打扰
      if (!word.word && scope === 'none') return { suggestions: [] }

      const fullText = model.getValue()
      const suggestions: monaco.languages.CompletionItem[] = []

      const addKeywords = () => {
        for (const k of TD_KEYWORDS) {
          suggestions.push({
            label: k,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: k,
            range,
            sortText: '5_' + k
          })
        }
      }
      const addFunctions = () => {
        for (const f of TD_FUNCTIONS) {
          suggestions.push({
            label: f,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: `${f}($0)`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
            sortText: '6_' + f
          })
        }
      }
      const addTypes = () => {
        for (const t of TD_DATA_TYPES) {
          suggestions.push({
            label: t.name,
            kind: monaco.languages.CompletionItemKind.TypeParameter,
            insertText: t.name,
            detail: t.description,
            range,
            sortText: '7_' + t.name
          })
        }
      }

      const needConn = () => {
        if (!ctx?.connId) return null
        const connStore = useConnStore()
        const conn = connStore.rawById(ctx.connId)
        return conn ? { connStore, conn } : null
      }

      const addTables = async (targetDb: string | undefined, includeDbs = false) => {
        const bound = needConn()
        if (!bound) return
        const db = targetDb || ctx!.database
        if (db) {
          const tables = await cached(`tables:${ctx!.connId}:${db}`, async () => {
            const [st, tb] = await Promise.all([
              window.tdApi.query({
                conn: bound.conn,
                sql: `SELECT stable_name FROM information_schema.ins_stables WHERE db_name='${db}'`
              }),
              window.tdApi.query({
                conn: bound.conn,
                sql: `SELECT table_name FROM information_schema.ins_tables WHERE db_name='${db}' AND (stable_name IS NULL OR stable_name='')`
              })
            ])
            const map = new Map<string, 'STABLE' | 'TABLE'>()
            if (st.ok) st.rows.forEach((r: any) => map.set(String(r[0]), 'STABLE'))
            if (tb.ok) tb.rows.forEach((r: any) => {
              const n = String(r[0])
              if (!map.has(n)) map.set(n, 'TABLE')
            })
            return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
          })
          for (const [name, kind] of tables as [string, string][]) {
            suggestions.push({
              label: { label: name, description: kind },
              kind: kind === 'STABLE'
                ? monaco.languages.CompletionItemKind.Class
                : monaco.languages.CompletionItemKind.Struct,
              insertText: name,
              detail: `${kind} · ${db}`,
              range,
              sortText: '0_' + name
            })
          }
        }
        if (includeDbs) {
          for (const db of bound.connStore.databases[ctx!.connId] || []) {
            suggestions.push({
              label: db,
              kind: monaco.languages.CompletionItemKind.Folder,
              insertText: db,
              detail: 'Database',
              range,
              sortText: '1_' + db
            })
          }
        }
      }

      const addColumns = async () => {
        const bound = needConn()
        if (!bound) return
        const tables = extractTables(fullText)
        if (!tables.length) return
        const seen = new Map<string, string>()
        await Promise.all(
          tables.map(async (t) => {
            const dbName = t.db || ctx!.database
            if (!dbName) return
            const cols = await cached(`cols:${ctx!.connId}:${dbName}:${t.table}`, async () => {
              const r = await window.tdApi.query({
                conn: bound.conn,
                sql: `DESCRIBE \`${dbName}\`.\`${t.table}\``
              })
              return r.ok ? r.rows.map((row: any) => ({
                name: String(row[0]),
                type: String(row[1]),
                note: String(row[3] || '')
              })) : []
            })
            for (const c of cols as any[]) {
              if (!seen.has(c.name)) seen.set(c.name, `${c.type} · ${t.table}${c.note ? ' · ' + c.note : ''}`)
            }
          })
        )
        for (const [name, detail] of seen) {
          suggestions.push({
            label: name,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: name,
            detail,
            range,
            sortText: '0_' + name
          })
        }
      }

      /* === 分发 === */
      switch (scope) {
        case 'table':
          await addTables(extractDotPrefix(cleanBefore), true)
          break
        case 'column':
          await addColumns()
          addFunctions()
          break
        case 'expr':
          await addColumns()
          addFunctions()
          addKeywords()
          break
        case 'statement':
          addKeywords()
          break
        case 'ddl-type':
          addTypes()
          break
        case 'word':
          // 用户正在敲字，什么都能匹配
          addKeywords()
          addFunctions()
          addTypes()
          break
        default:
          return { suggestions: [] }
      }

      return { suggestions }
    }
  }))

  monaco.editor.defineTheme('td-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'predefined', foreground: 'DCDCAA' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' }
    ],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.lineHighlightBackground': '#2a2d2e'
    }
  })
}

export { monaco }
