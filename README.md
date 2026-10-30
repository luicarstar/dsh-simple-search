# DSH Simple Search

DeepSeek Harness 的一个极小插件：**只做内容搜索**。会话头部一个 🔍 按钮，输入关键词，搜全部会话正文，点结果直接跳到命中位置。

没有归档浏览器，没有侧栏改造，没有设置页，没有第二种搜索模式。

## 行为

- 入口：会话头部操作区（复制按钮旁）的 🔍
- 输入即搜（280ms 防抖），调 `sessions.search`（宿主 FTS 索引）
- 结果列表：命中片段（关键词黄色高亮）+ 会话短 id
- ↑ / ↓ 选择，Enter 打开，Esc 关闭，点空白处关闭
- 打开后自动滚动到命中文本所在位置并闪烁 2.6 秒

## 安装

```
plugin_manager({ action: "install_bundle", target: "<本目录绝对路径>" })
```

安装后如该行 `fiberPhase` 非 `active`，再启用一次：

```
plugin_manager({ action: "set_plugin", target: "include:simple-search", enabled: true })
```

客户端半区由 `dsh-client-hmr` 热更新；主进程无需重启。

## 兼容性

针对 **0.2.1-rc.5** 实测（客户端 Slot 契约）：

| 依赖 | 说明 |
| --- | --- |
| `ctx.sessions.search(query, signal)` | 返回 `{ ok, value: { items, hasMore } }`，item 为 `{ sessionId, snippet }` |
| `ctx.uiWorkspace.openSession(id)` | 打开会话 |
| `ctx.slots.inject("conversation.session.header.actions", ...)` | 头部按钮位 |
| `ctx.locale.register(ns, { zh, en })` + `ctx.locale.bind(ns)` | rc.5 的 `locale:` 座位不保证把 `t` 交给第三方条目，这里自己 bind 后经 `inject` 传入 |

定位实现不依赖 CSS Module 类名，只用 rc.5 的稳定属性 `data-chat-flow` / `data-chat-turn`。

## 定位的边界

- 命中在**未加载的历史页**时，会先把会话视口顶到起点触发分页加载并重试（600 / 1300 / 2200 / 3400ms），彻底放弃会恢复原滚动位置。
- 命中在**折叠的 thinking / 工具输出**里时只跳过不可见节点，不自动展开。
- 极短且高频的词跳到第一个命中，而不是结果列表里选中的那一条。

## 结构

```
package.json      dsh.bundle.patch + dsh.client.inject 声明
cordis.patch.yml  唯一一行：include:simple-search
lib/index.js      Host 半区空实现（Loader 行要求）
lib/client.js     全部功能（ModuleLoader 格式，无反编译构建）
```

## 许可

MIT
