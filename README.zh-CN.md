# omp-purge

OMP（Oh My Pi）**指令权威性强化插件**——对标 [dsh-purge](https://github.com/ZiPengWei/dsh-purge)，但走 **官方扩展 API**，**不改 `node_modules`**，`omp update` 后无需重清。

## 和 dsh-purge 的差异

| | dsh-purge | omp-purge |
|---|---|---|
| 机制 | 字符串 patch `@deepseek-ai/*` 源文件 | `before_agent_start` 追加 systemPrompt section |
| 升级后 | 需 autoApply 重打 8 patch | 安装即持续生效 |
| 沙箱/审批 | 改默认 deny / ask | 可选 `/purge yolo` 写 `tools.approvalMode: yolo` |
| 注入文件 | `~/.dsh/prompt-inject.md` | `~/.omp/prompt-inject.md` |

OMP 原生已把 AGENTS.md 标成 `MUST follow`；本插件再补一层 **ACTIVE and MANDATORY** 会话指令，并提供可编辑全局注入。

## 安装

```sh
# 开发链接（推荐）
cd omp-purge
omp plugin link .

# 或一次性加载
omp --extension ./omp-purge

# 或装到用户插件集
omp install ./omp-purge
```

重启 / 新开 `omp` 会话后生效。设置页可用 `/extensions` 查看。

## 使用

```text
/purge status   # 状态
/purge apply    # 开启（默认已开）
/purge revert   # 关闭（保留 prompt-inject.md）
/purge edit     # 编辑全局注入
/purge yolo     # 写入 tools.approvalMode: yolo（备份 config.yml）
/purge help
```

CLI（会话外）：

```sh
./bin/omp-purge.js --status
./bin/omp-purge.js --apply
./bin/omp-purge.js --edit
./bin/omp-purge.js --yolo
```

模型工具：`purge_status` / `purge_apply` / `purge_revert` / `purge_set`。

## 配置

`~/.omp/omp-purge.json`（缺失则用默认）：

```json
{
  "enabled": true,
  "authority": true,
  "inject": true,
  "yoloNudge": true,
  "verbose": false
}
```

全局提示词：`~/.omp/prompt-inject.md`（默认只有注释；有正文才注入）。

## 工作原理

```
每轮 before_agent_start
  ├─ enabled? 否 → 跳过
  ├─ authority → 追加 <omp-purge-authority>…</omp-purge-authority>
  └─ inject 且文件有正文 → 追加 <omp-purge-inject>…
```

另附带 `rules/authority.md`（`alwaysApply`）作为规则层兜底。

## 目录

```
omp-purge/
├── src/index.ts      # 扩展入口
├── src/core.ts       # 配置 / 注入 / 状态
├── src/directives.ts # 强指令文案
├── rules/authority.md
├── bin/omp-purge.js
└── package.json      # omp.extensions
```
