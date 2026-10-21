# omp-purge

> 完整中英双语说明见 [README.md](./README.md)。本文为中文速览。

OMP（Oh My Pi）**指令权威性强化插件**——对标 [dsh-purge](https://github.com/ZiPengWei/dsh-purge)，走 **官方扩展 API**，**不改 `node_modules`**，`omp update` 后无需重清。

## 和 dsh-purge 的差异

| | dsh-purge | omp-purge |
|---|---|---|
| 机制 | 字符串 patch `@deepseek-ai/*` 源文件 | `before_agent_start` 追加 systemPrompt section |
| 升级后 | 需 autoApply 重打 8 patch | 安装即持续生效 |
| 沙箱 / 审批 | 改默认 deny / ask | 可选 `/purge yolo` 写 `tools.approvalMode: yolo` |
| 注入文件 | `~/.dsh/prompt-inject.md` | `~/.omp/prompt-inject.md` |

OMP 原生已把 AGENTS.md 标成 `MUST follow`；本插件再补一层 **ACTIVE and MANDATORY**，并提供可编辑全局注入。

## 安装

```sh
omp install github:hahahasnoopy/omp-purge

# 本地
git clone https://github.com/hahahasnoopy/omp-purge.git
cd omp-purge && omp plugin link .
```

新开 `omp` 会话后生效，可用 `/extensions` 确认。

## 使用

```text
/purge status | apply | revert | edit | yolo | help
```

```sh
bun ./bin/omp-purge.js --status
bun ./bin/omp-purge.js --edit
bun ./bin/omp-purge.js --yolo
```

模型工具：`purge_status` / `purge_apply` / `purge_revert` / `purge_set`。

## 配置

- 开关：`~/.omp/omp-purge.json`
- 全局注入：`~/.omp/prompt-inject.md`（有正文才注入）

```json
{
  "enabled": true,
  "authority": true,
  "inject": true,
  "yoloNudge": true,
  "verbose": false
}
```

## 工作原理

```
每轮 before_agent_start
  ├─ enabled? 否 → 跳过
  ├─ authority → 追加 <omp-purge-authority>
  └─ inject 且有正文 → 追加 <omp-purge-inject>
```

另附带 `rules/authority.md`（`alwaysApply`）兜底。

## License

MIT
