# omp-purge

Instruction-authority plugin for **OMP (Oh My Pi)** — same goal as [dsh-purge](https://github.com/ZiPengWei/dsh-purge), implemented the OMP-native way: **`before_agent_start` systemPrompt append**, not `node_modules` string patches.

## Why not copy dsh-purge patches?

OMP already frames context files as `MUST follow` inside `<repo-rules>`. Patching `@oh-my-pi/pi-coding-agent` would break on every update and fight the supported extension surface. This package reinforces authority at runtime and keeps a user-editable inject file.

| Layer | Behavior |
|---|---|
| Prompt | Append `<omp-purge-authority>` every turn |
| File | Optional `~/.omp/prompt-inject.md` body |
| Rules | Bundled `rules/authority.md` (`alwaysApply`) |
| Approval | Optional `/purge yolo` → `tools.approvalMode: yolo` |

## Install

```sh
omp plugin link .
# or
omp --extension ./omp-purge
# or
omp install ./omp-purge
```

## Usage

```text
/purge status | apply | revert | edit | yolo | help
```

CLI: `omp-purge --status|--apply|--revert|--edit|--yolo`

Tools: `purge_status`, `purge_apply`, `purge_revert`, `purge_set`

Config: `~/.omp/omp-purge.json`  
Inject: `~/.omp/prompt-inject.md` (comments-only = no inject)

## License

MIT
