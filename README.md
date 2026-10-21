# omp-purge

[English](#english) | [中文](#中文)

OMP（Oh My Pi）**指令权威性强化插件**——对标 [dsh-purge](https://github.com/ZiPengWei/dsh-purge)，走 **官方扩展 API**，**不改 `node_modules`**，`omp update` 后无需重清。

> **免责声明 / Disclaimer**  
> 本项目**仅供学习与研究**，用于了解 OMP 扩展机制与系统提示词注入方式。作者不对使用本软件造成的任何直接或间接损失负责；请遵守当地法律法规及所使用模型 / 平台的服务条款，勿用于违法或未授权用途。使用即表示你知悉并自行承担风险。

---

## 中文

### 它做什么

把会话里的本地规则（`AGENTS.md`、`.omp/` 规则、用户消息等）再强调一层为 **ACTIVE and MANDATORY**，并支持可编辑的全局注入文件。  
OMP 原生已把 context 标成 `MUST follow`；本插件用运行时注入补强，而不是去 patch 安装包源码。

### 和 dsh-purge 的差异

| | dsh-purge | omp-purge |
|---|---|---|
| 机制 | 字符串 patch `@deepseek-ai/*` 源文件 | `before_agent_start` 追加 systemPrompt section |
| 升级后 | 需 autoApply 重打 8 patch | 安装即持续生效 |
| 沙箱 / 审批 | 改默认 deny / ask | 可选 `/purge yolo` 写 `tools.approvalMode: yolo` |
| 注入文件 | `~/.dsh/prompt-inject.md` | `~/.omp/prompt-inject.md` |

### 四层能力

| 层 | 行为 |
|---|---|
| 提示词 | 每轮追加 `<omp-purge-authority>` |
| 文件 | 可选注入 `~/.omp/prompt-inject.md` 正文 |
| 规则 | 附带 `rules/authority.md`（`alwaysApply`） |
| 审批 | `/purge yolo` → `tools.approvalMode: yolo`（先备份 `config.yml`） |

### 安装

```sh
# 从 GitHub 安装（推荐）
omp install github:hahahasnoopy/omp-purge

# 本地开发链接
git clone https://github.com/hahahasnoopy/omp-purge.git
cd omp-purge
omp plugin link .

# 或一次性加载
omp --extension ./omp-purge
```

新开 / 重启 `omp` 会话后生效。可用 `/extensions` 查看是否已加载。

### 使用

聊天命令：

```text
/purge status   # 状态
/purge apply    # 开启（默认已开）
/purge revert   # 关闭（保留 prompt-inject.md）
/purge edit     # 编辑全局注入
/purge yolo     # 写入 tools.approvalMode: yolo
/purge help
```

会话外 CLI（需 bun）：

```sh
bun ./bin/omp-purge.js --status
bun ./bin/omp-purge.js --apply
bun ./bin/omp-purge.js --edit
bun ./bin/omp-purge.js --yolo
```

模型工具：`purge_status` / `purge_apply` / `purge_revert` / `purge_set`。

### 配置

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

| 字段 | 说明 |
|---|---|
| `enabled` | 总开关；`false` 时不注入 |
| `authority` | 是否追加权威指令块 |
| `inject` | 是否读取全局注入文件 |
| `yoloNudge` | 是否附带审批姿态说明 |
| `verbose` | 控制台调试日志 |

全局提示词：`~/.omp/prompt-inject.md`（默认只有注释；**有正文才注入**）。

### 工作原理

```
每轮 before_agent_start
  ├─ enabled? 否 → 跳过
  ├─ authority → 追加 <omp-purge-authority>…</omp-purge-authority>
  └─ inject 且文件有正文 → 追加 <omp-purge-inject>…
```

幂等：若 systemPrompt 里已有哨兵标签，本轮不再重复追加。  
卸载：`omp plugin uninstall omp-purge`。

### 目录结构

```
omp-purge/
├── src/index.ts        # 扩展入口：命令 / 工具 / 注入
├── src/core.ts         # 配置、路径、状态
├── src/directives.ts   # 强指令文案
├── rules/authority.md  # alwaysApply 规则兜底
├── bin/omp-purge.js    # CLI
└── package.json        # omp.extensions
```

### License

MIT

---

## English

Instruction-authority plugin for **OMP (Oh My Pi)** — same goal as [dsh-purge](https://github.com/ZiPengWei/dsh-purge), implemented the OMP-native way: **`before_agent_start` systemPrompt append**, not `node_modules` string patches.

> **Disclaimer**  
> This project is intended **for learning and research only** — to explore the OMP extension API and system-prompt injection. The authors are not liable for any damages arising from use. Comply with applicable laws and the terms of any models/platforms you use. Do not use for illegal or unauthorized purposes. Use at your own risk.

### Why not copy dsh-purge patches?

OMP already frames context files as `MUST follow` inside `<repo-rules>`. Patching `@oh-my-pi/pi-coding-agent` would break on every update. This package reinforces authority at runtime and keeps a user-editable inject file.

| Layer | Behavior |
|---|---|
| Prompt | Append `<omp-purge-authority>` every turn |
| File | Optional `~/.omp/prompt-inject.md` body |
| Rules | Bundled `rules/authority.md` (`alwaysApply`) |
| Approval | Optional `/purge yolo` → `tools.approvalMode: yolo` |

### Install

```sh
omp install github:hahahasnoopy/omp-purge
# or
omp plugin link .
# or
omp --extension ./omp-purge
```

### Usage

```text
/purge status | apply | revert | edit | yolo | help
```

CLI: `bun ./bin/omp-purge.js --status|--apply|--revert|--edit|--yolo`

Tools: `purge_status`, `purge_apply`, `purge_revert`, `purge_set`

Config: `~/.omp/omp-purge.json`  
Inject: `~/.omp/prompt-inject.md` (comments-only = no inject)

### License

MIT
