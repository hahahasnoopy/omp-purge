#!/usr/bin/env bun
/**
 * CLI for omp-purge (works outside a live omp session).
 * Usage: omp-purge --status|--apply|--revert|--edit|--yolo|--help
 * Requires bun (same runtime omp uses for TypeScript extensions).
 */

import {
	applyPurge,
	editInjectExternal,
	ensureInjectFile,
	ensureYoloApproval,
	gatherState,
	renderStatus,
	revertPurge,
} from "../src/core.ts";

const args = process.argv.slice(2);
const flag = args.find((a) => a.startsWith("-")) || "--status";

async function main() {
	switch (flag) {
		case "--status":
		case "-s": {
			console.log(renderStatus(await gatherState()));
			break;
		}
		case "--apply":
		case "-a": {
			const cfg = await applyPurge();
			console.log(`applied: enabled=${cfg.enabled}`);
			console.log(renderStatus(await gatherState()));
			break;
		}
		case "--revert":
		case "-r": {
			const cfg = await revertPurge();
			console.log(`reverted: enabled=${cfg.enabled} (prompt-inject.md kept)`);
			break;
		}
		case "--edit":
		case "-e": {
			await ensureInjectFile();
			const r = editInjectExternal();
			console.log(`editing ${r.path} via ${r.cmd}`);
			break;
		}
		case "--yolo": {
			const r = await ensureYoloApproval(undefined, true);
			console.log(`${r.status}: ${r.path}`);
			break;
		}
		case "--help":
		case "-h":
		default: {
			console.log(`omp-purge — OMP instruction authority (extension companion CLI)

  --status   Show enablement + paths
  --apply    Enable authority + inject
  --revert   Disable (keeps prompt-inject.md)
  --edit     Open ~/.omp/prompt-inject.md in $EDITOR
  --yolo     Set tools.approvalMode: yolo in agent config.yml
  --help     This help

Install extension:
  omp plugin link /path/to/omp-purge
  # or: omp --extension /path/to/omp-purge
`);
			if (flag !== "--help" && flag !== "-h") process.exitCode = 1;
		}
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
