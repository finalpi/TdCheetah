import type { IpcMain } from 'electron'
import Store from 'electron-store'

type Conn = any

const store = new Store<{ connections: Conn[]; history: any[] }>({
  defaults: { connections: [], history: [] }
})

export function registerStoreHandlers(ipc: IpcMain) {
  ipc.handle('store:connections:list', () => store.get('connections'))

  ipc.handle('store:connections:save', (_e, c: Conn) => {
    const list = store.get('connections')
    const idx = list.findIndex((x) => x.id === c.id)
    if (idx >= 0) list[idx] = c
    else list.push(c)
    store.set('connections', list)
    return list
  })

  ipc.handle('store:connections:delete', (_e, id: string) => {
    const list = store.get('connections').filter((x) => x.id !== id)
    store.set('connections', list)
    return list
  })

  ipc.handle('store:history:list', () => store.get('history'))

  ipc.handle('store:history:push', (_e, item) => {
    const list = store.get('history')
    list.unshift({ ...item, at: Date.now() })
    if (list.length > 500) list.length = 500
    store.set('history', list)
  })

  ipc.handle('store:history:clear', () => store.set('history', []))
}
