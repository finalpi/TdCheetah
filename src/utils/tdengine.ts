export interface TdDataType {
  name: string
  label: string
  bytes: string
  hasLength?: boolean
  hasPrecision?: boolean
  allowTag?: boolean
  description: string
}

export const TD_DATA_TYPES: TdDataType[] = [
  { name: 'TIMESTAMP', label: 'TIMESTAMP', bytes: '8', allowTag: false, description: '时间戳，默认毫秒精度（支持 us/ns）' },
  { name: 'INT', label: 'INT', bytes: '4', allowTag: true, description: '整型 [-2^31, 2^31-1]' },
  { name: 'INT UNSIGNED', label: 'INT UNSIGNED', bytes: '4', allowTag: true, description: '无符号整型 [0, 2^32-1]' },
  { name: 'BIGINT', label: 'BIGINT', bytes: '8', allowTag: true, description: '长整型 [-2^63, 2^63-1]' },
  { name: 'BIGINT UNSIGNED', label: 'BIGINT UNSIGNED', bytes: '8', allowTag: true, description: '无符号长整型 [0, 2^64-1]' },
  { name: 'FLOAT', label: 'FLOAT', bytes: '4', allowTag: true, description: '单精度浮点，6-7 位精度' },
  { name: 'DOUBLE', label: 'DOUBLE', bytes: '8', allowTag: true, description: '双精度浮点，15-16 位精度' },
  { name: 'SMALLINT', label: 'SMALLINT', bytes: '2', allowTag: true, description: '短整型 [-32768, 32767]' },
  { name: 'SMALLINT UNSIGNED', label: 'SMALLINT UNSIGNED', bytes: '2', allowTag: true, description: '无符号短整型 [0, 65535]' },
  { name: 'TINYINT', label: 'TINYINT', bytes: '1', allowTag: true, description: '单字节整型 [-128, 127]' },
  { name: 'TINYINT UNSIGNED', label: 'TINYINT UNSIGNED', bytes: '1', allowTag: true, description: '无符号单字节整型 [0, 255]' },
  { name: 'BOOL', label: 'BOOL', bytes: '1', allowTag: true, description: '布尔类型' },
  { name: 'BINARY', label: 'BINARY(n)', bytes: '自定义', hasLength: true, allowTag: true, description: '单字节字符串（ASCII），需指定长度' },
  { name: 'VARCHAR', label: 'VARCHAR(n)', bytes: '自定义', hasLength: true, allowTag: true, description: 'BINARY 的别名' },
  { name: 'NCHAR', label: 'NCHAR(n)', bytes: '自定义', hasLength: true, allowTag: true, description: '多字节字符串（支持中文），每字符 4 字节' },
  { name: 'JSON', label: 'JSON', bytes: '自定义', allowTag: true, description: 'JSON 类型，仅 TAG 支持' },
  { name: 'GEOMETRY', label: 'GEOMETRY(n)', bytes: '自定义', hasLength: true, allowTag: true, description: '几何类型（POINT/LINESTRING/POLYGON）' },
  { name: 'VARBINARY', label: 'VARBINARY(n)', bytes: '自定义', hasLength: true, allowTag: true, description: '变长二进制数据' },
  { name: 'DECIMAL', label: 'DECIMAL(p,s)', bytes: '8/16', hasPrecision: true, allowTag: false, description: '高精度数值（3.3.6+）' },
  { name: 'BLOB', label: 'BLOB', bytes: '4M', allowTag: false, description: '变长二进制（3.3.7+），每表仅一列' }
]

export const TD_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL',
  'ORDER', 'BY', 'ASC', 'DESC', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'CREATE', 'DROP', 'ALTER', 'TABLE', 'STABLE', 'DATABASE', 'USER', 'VIEW', 'STREAM',
  'USING', 'TAGS', 'IF', 'EXISTS', 'NOT EXISTS',
  'SHOW', 'DESCRIBE', 'DESC', 'USE',
  'INTERVAL', 'SLIDING', 'FILL', 'SESSION', 'STATE_WINDOW', 'EVENT_WINDOW',
  'PARTITION', 'WINDOW_START', 'WINDOW_END',
  'AS', 'DISTINCT', 'WITH', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'PRECISION', 'KEEP', 'DURATION', 'REPLICA', 'VGROUPS', 'COMP', 'BUFFER', 'PAGES',
  'CACHEMODEL', 'WAL_LEVEL', 'WAL_FSYNC_PERIOD', 'MAXROWS', 'MINROWS'
]

export const TD_FUNCTIONS = [
  'NOW', 'TODAY', 'TIMEZONE',
  'COUNT', 'AVG', 'SUM', 'MIN', 'MAX', 'FIRST', 'LAST', 'LAST_ROW', 'TOP', 'BOTTOM',
  'STDDEV', 'VAR_POP', 'PERCENTILE', 'APERCENTILE', 'LEASTSQUARES', 'HYPERLOGLOG',
  'SPREAD', 'TWA', 'MAVG', 'SAMPLE', 'TAIL', 'UNIQUE', 'MODE',
  'DIFF', 'DERIVATIVE', 'IRATE', 'CSUM', 'STATECOUNT', 'STATEDURATION',
  'TIMEDIFF', 'TIMETRUNCATE', 'TO_ISO8601', 'TO_UNIXTIMESTAMP', 'CAST',
  'ABS', 'ACOS', 'ASIN', 'ATAN', 'CEIL', 'COS', 'FLOOR', 'LOG', 'POW', 'ROUND', 'SIN',
  'SQRT', 'TAN', 'CHAR_LENGTH', 'CONCAT', 'LENGTH', 'LOWER', 'LTRIM', 'RTRIM', 'SUBSTR',
  'UPPER', 'IFNULL', 'COALESCE'
]

export function formatCell(value: any, type: string): string {
  if (value === null || value === undefined) return 'NULL'
  if (type === 'TIMESTAMP') return String(value)
  if (type === 'BOOL') return value ? 'true' : 'false'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
