<div align="center">

# TdCheetah

**高性能 TDengine 可视化管理工具**

Navicat 风格的 TDengine 客户端，基于 Electron + Vue 3 + TypeScript。

[![License](https://img.shields.io/github/license/finalpi/TdCheetah?color=blue)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/finalpi/TdCheetah?include_prereleases)](https://github.com/finalpi/TdCheetah/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)]()

</div>

---

## ✨ 核心特性

- 🔌 **连接管理**：多数据源 / 密码 / Token / HTTPS，配置本地加密持久化
- 🌲 **懒加载树**：连接 → 数据库 → 超级表 / 普通表 / 视图，百万级表不卡
- ⚡ **Monaco SQL 编辑器**：
  - `tdsql` 自定义语言：关键字 / 函数 / 数据类型语法高亮
  - 上下文感知补全：`FROM` 后补表名，`WHERE` 后补列名，`CREATE TABLE` 后补数据类型
  - `Ctrl+Enter` 执行，`Ctrl+Shift+Enter` 执行选中
- 📊 **虚拟滚动结果网格**：
  - 十万级行丝滑渲染（`el-table-v2`）
  - 列宽拖拽、行高亮、只读 input 单元格（鼠标选中可复制）
  - 双击单元格弹出大 textarea 便于复制长值
  - `Ctrl+F` Chrome 风格搜索，匹配单元格黄色高亮、当前项橙色、自动滚动
  - 一键导出 CSV
- 🧱 **可视化筛选器**：
  - 字段下拉、操作符动态推断、值自动转义
  - `IN / NOT IN`、`BETWEEN`、`IS NULL`、`LIKE`、`MATCH` 全支持
  - 与时间范围 AND 联动
- 🕒 **时间列优化**：
  - UTC → 本地自动转换，保留微秒/纳秒精度
  - 时间范围起止可单独为空，"直到现在"一键套用
  - 快捷：最近 5 分 / 15 分 / 1 小时 / 1 天 / 7 天 / 30 天
- 🧩 **建表向导**：覆盖 TDengine 全部数据类型，STable + TAGS 配置 + 实时 SQL 预览
- 🗂 **建库向导**：精度 ms/us/ns、副本、保留时长、缓存模式、VGroups
- 📥 **一键 DDL 导出**：右键数据库，导出 `CREATE DATABASE` + 所有 `CREATE STABLE` + 普通表 + 视图（自动过滤子表），输出 `.sql` 文件
- 📋 **上下文快捷复制**：右键表"复制建表语句"、右键库"复制建库语句"
- 🔁 **SQL 历史**：500 条，按连接/库/耗时/状态筛选
- 🎨 **亮/暗双主题**，可通过标题栏开关切换

## 📸 界面

> 界面效果截图请参考 [Releases](https://github.com/finalpi/TdCheetah/releases) 或 [Issues](https://github.com/finalpi/TdCheetah/issues)。

## 🚀 快速开始

### 安装

从 [Releases](https://github.com/finalpi/TdCheetah/releases) 下载对应平台的安装包：

- Windows：`TdCheetah-<ver>-win-x64.exe` / `.zip`
- macOS：`TdCheetah-<ver>-mac-arm64.dmg` / `x64.dmg`
- Linux：`TdCheetah-<ver>-linux-x64.AppImage` / `.deb`

### 前置条件

TdCheetah 走 TDengine 官方的 **REST API**（由 `taosadapter` 提供），连接前请确认：

1. `taosd` 已启动
2. `taosadapter` 已启动（Windows 上是 `taosadapter.exe`，Linux 是 `systemctl status taosadapter`）
3. REST 端口默认 **6041**（不是原生协议的 6030）

本地快速验证：

```bash
curl -u root:taosdata -d "SHOW DATABASES" http://localhost:6041/rest/sql
```

### 首次连接

点击左上角 **新建连接**，默认值是：

| 字段 | 值 |
|---|---|
| 主机 | `localhost` |
| 端口 | `6041` |
| 用户名 | `root` |
| 密码 | `taosdata` |

可点击"测试连接"确认。

## 🛠 本地开发

```bash
git clone https://github.com/finalpi/TdCheetah.git
cd TdCheetah
npm install
npm run dev
```

### 目录结构

```
TdCheetah/
├── electron/                   Electron 主进程
│   ├── main.ts                 窗口 + IPC 注册
│   ├── preload.ts              contextBridge → window.tdApi
│   ├── tdengine.ts             REST 请求（electron.net，无 CORS）
│   └── store.ts                electron-store 持久化
├── src/
│   ├── main.ts / App.vue / router/
│   ├── types/                  全局 TS 类型 + window.tdApi 声明
│   ├── stores/
│   │   ├── connections.ts      连接列表 + 当前上下文 + 树刷新桥
│   │   └── tabs.ts             多标签页 store
│   ├── utils/
│   │   ├── tdengine.ts         TDengine 数据类型/关键字/函数元数据
│   │   └── monaco.ts           tdsql 语言 + 智能补全 + 暗色主题
│   ├── views/Layout.vue        顶栏 + 左树 + 右标签页 + 状态栏
│   └── components/
│       ├── ConnectionTree.vue      懒加载树 + 右键菜单 + 导出 DDL
│       ├── ConnectionDialog.vue    连接配置对话框
│       ├── CreateDatabaseDialog.vue 建库向导 + SQL 预览
│       ├── CreateTableDialog.vue   建表/超表向导 + TAGS
│       ├── ColumnEditor.vue        列编辑器（覆盖全类型）
│       ├── TabsArea.vue            多标签页容器
│       ├── SqlEditor.vue           Monaco + 工具栏 + 结果网格
│       ├── ResultGrid.vue          虚拟滚动 + 列拖拽 + Ctrl+F
│       ├── FilterBuilder.vue       可视化 WHERE 构造器
│       ├── TableBrowser.vue        自动检测时间列，筛选+ 排序 + 分页
│       ├── TableStructure.vue      DESCRIBE + SHOW CREATE
│       ├── ExportSqlDialog.vue     DDL 导出对话框
│       └── HistoryDrawer.vue       SQL 历史抽屉
└── build/                       打包图标等资源
```

### 打包

```bash
npm run build          # 跑 vue-tsc 类型检查 + Vite 构建 + electron-builder 打包
npm run electron:build # 只打包当前平台
```

产物在 `release/` 目录。

## 🏗 架构亮点

| 关注点 | 做法 |
|---|---|
| **无 CORS 跨域** | REST 请求走 Electron 主进程的 `net` 模块，不受 Vite dev server 同源限制 |
| **IPC 性能** | 结果以二维数组（非对象数组）跨进程传递，省 60%+ JSON 开销 |
| **IPC 可序列化** | preload 里对参数统一 `JSON.parse(JSON.stringify(...))`，自动剥离 Vue Proxy |
| **懒加载 + 可刷新** | el-tree lazy mode，创建/删除后通过 `connStore.refreshTree(key)` 精确刷新单个节点 |
| **时区一致性** | 主进程把所有 `TIMESTAMP` 列 UTC → 本地时间，纳秒精度不丢 |
| **HMR 友好** | Monaco language provider 的 disposable 挂 `globalThis`，热重载时自动清理旧注册 |
| **元数据缓存** | `tables:connId:db` / `cols:connId:db:table` 60 秒 TTL，补全流畅不压数据库 |

## 📖 参考文档

- [TDengine 数据类型](https://docs.tdengine.com/reference/taos-sql/datatype/)
- [TDengine REST API](https://docs.tdengine.com/reference/connector/rest-api/)
- [Element Plus](https://element-plus.org/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)

## 🤝 贡献

欢迎提 Issue / PR。大功能请先开 Issue 讨论方案。

## 📜 License

[MIT](./LICENSE) © [finalpi](https://github.com/finalpi)
