/**
 * omp-purge — instruction authority for Oh My Pi / omp
 *
 * Unlike dsh-purge (string-patches node_modules), this uses the official
 * extension API: append ACTIVE/MANDATORY sections on every before_agent_start.
 * Survives `omp update` without re-patching.
 */

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import {
	applyPurge,
	buildAppendSections,
	editInjectExternal,
	ensureInjectFile,
	ensureYoloApproval,
	gatherState,
	loadConfig,
	renderStatus,
	revertPurge,
	saveConfig,
	type PurgeConfig,
} from "./core.js";

export const name = "omp-purge";

function log(cfg: PurgeConfig, ...args: unknown[]) {
	if (cfg.verbose) console.log("[omp-purge]", ...args);
}

export default function ompPurge(pi: ExtensionAPI) {
	const z = pi.zod;

	pi.on("session_start", async (_event, ctx) => {
		const cfg = await loadConfig();
		await ensureInjectFile();
		if (cfg.enabled && ctx.hasUI) {
			ctx.ui.notify("omp-purge: authority inject active — /purge status", "info");
		}
		log(cfg, "session_start", { enabled: cfg.enabled });
	});

	pi.on("before_agent_start", async (event) => {
		const base = Array.isArray(event.systemPrompt)
			? event.systemPrompt
			: event.systemPrompt
				? [String(event.systemPrompt)]
				: [];
		const append = await buildAppendSections(base);
		if (append.length === 0) return;
		return { systemPrompt: [...base, ...append] };
	});

	pi.registerCommand("purge", {
		description: "omp-purge: status | apply | revert | edit | yolo | help",
		getArgumentCompletions: (prefix) =>
			["status", "apply", "revert", "edit", "yolo", "help"]
				.filter((v) => v.startsWith(prefix))
				.map((value) => ({ value, label: value })),
		handler: async (args, ctx) => {
			const sub = (args || "").trim().split(/\s+/)[0]?.toLowerCase() || "status";

			switch (sub) {
				case "status":
				case "s": {
					const state = await gatherState();
					ctx.ui.notify(renderStatus(state), "info");
					return;
				}
				case "apply":
				case "a": {
					const cfg = await applyPurge();
					ctx.ui.notify(
						`omp-purge applied (enabled=${cfg.enabled}). Next turn will inject authority. Restart not required.`,
						"info",
					);
					return;
				}
				case "revert":
				case "r": {
					const cfg = await revertPurge();
					ctx.ui.notify(
						`omp-purge reverted (enabled=${cfg.enabled}). prompt-inject.md kept. Next turn skips inject.`,
						"info",
					);
					return;
				}
				case "edit":
				case "e": {
					const fp = await ensureInjectFile();
					if (ctx.hasUI && typeof ctx.ui.editor === "function") {
						const state = await gatherState();
						const { readFileSync, writeFileSync } = await import("node:fs");
						const current = readFileSync(fp, "utf8");
						const next = await ctx.ui.editor("Edit ~/.omp/prompt-inject.md", current);
						if (typeof next === "string" && next !== current) {
							writeFileSync(fp, next.endsWith("\n") ? next : `${next}\n`, "utf8");
							ctx.ui.notify(`Saved ${state.injectPath}`, "info");
						} else {
							ctx.ui.notify("No changes", "info");
						}
						return;
					}
					const r = editInjectExternal();
					ctx.ui.notify(`Opened ${r.path} in ${r.cmd}`, "info");
					return;
				}
				case "yolo": {
					const r = await ensureYoloApproval(undefined, true);
					ctx.ui.notify(
						`tools.approvalMode → ${r.status} (${r.path}). Restart omp if a session was already open.`,
						"info",
					);
					return;
				}
				case "help":
				case "h":
				default: {
					ctx.ui.notify(
						[
							"/purge status  — show config + inject path",
							"/purge apply   — enable authority + inject",
							"/purge revert  — disable (keeps prompt-inject.md)",
							"/purge edit    — edit ~/.omp/prompt-inject.md",
							"/purge yolo    — set tools.approvalMode: yolo (backs up config.yml)",
							"",
							"Runtime: before_agent_start appends <omp-purge-authority> (+ optional inject).",
							"No node_modules patches — survives omp update.",
						].join("\n"),
						"info",
					);
				}
			}
		},
	});

	pi.registerTool({
		name: "purge_status",
		label: "Purge Status",
		description: "Show omp-purge enablement, inject file status, and approvalMode hint.",
		parameters: z.object({}),
		approval: "read",
		async execute() {
			const text = renderStatus(await gatherState());
			return { content: [{ type: "text", text }], details: {} };
		},
	});

	pi.registerTool({
		name: "purge_apply",
		label: "Purge Apply",
		description: "Enable omp-purge authority + inject for subsequent turns.",
		parameters: z.object({}),
		approval: "write",
		async execute() {
			const cfg = await applyPurge();
			return {
				content: [
					{
						type: "text",
						text: `applied: enabled=${cfg.enabled} authority=${cfg.authority} inject=${cfg.inject}`,
					},
				],
				details: cfg,
			};
		},
	});

	pi.registerTool({
		name: "purge_revert",
		label: "Purge Revert",
		description: "Disable omp-purge inject for subsequent turns (keeps prompt-inject.md).",
		parameters: z.object({}),
		approval: "write",
		async execute() {
			const cfg = await revertPurge();
			return {
				content: [{ type: "text", text: `reverted: enabled=${cfg.enabled}` }],
				details: cfg,
			};
		},
	});

	pi.registerTool({
		name: "purge_set",
		label: "Purge Set",
		description: "Update omp-purge toggles (enabled/authority/inject/yoloNudge/verbose).",
		parameters: z.object({
			enabled: z.boolean().optional(),
			authority: z.boolean().optional(),
			inject: z.boolean().optional(),
			yoloNudge: z.boolean().optional(),
			verbose: z.boolean().optional(),
		}),
		approval: "write",
		async execute(_id, params) {
			const cfg = await loadConfig();
			for (const key of ["enabled", "authority", "inject", "yoloNudge", "verbose"] as const) {
				if (typeof params[key] === "boolean") cfg[key] = params[key]!;
			}
			await saveConfig(cfg);
			return {
				content: [{ type: "text", text: `updated: ${JSON.stringify(cfg)}` }],
				details: cfg,
			};
		},
	});
}
