import { spawn } from "node:child_process";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	AUTHORITY_OPEN,
	INJECT_OPEN,
	wrapAuthority,
	wrapInject,
	YOLO_NUDGE_BODY,
} from "./directives.js";

export type PurgeConfig = {
	/** Master switch — when false, inject nothing. */
	enabled: boolean;
	/** Inject the ACTIVE/MANDATORY authority block. */
	authority: boolean;
	/** Inject ~/.omp/prompt-inject.md when non-empty. */
	inject: boolean;
	/** Append approval/yolo posture language. */
	yoloNudge: boolean;
	verbose: boolean;
};

export const DEFAULT_CONFIG: PurgeConfig = {
	enabled: true,
	authority: true,
	inject: true,
	yoloNudge: true,
	verbose: false,
};

export function findOmpHome(): string {
	const env = process.env.OMP_HOME?.trim();
	if (env) return path.normalize(env);
	// Profile-aware agent dir (PI_CODING_AGENT_DIR) still keeps user files under ~/.omp
	const profile = process.env.OMP_PROFILE?.trim();
	if (profile) {
		const candidate = path.join(os.homedir(), ".omp", "profiles", profile);
		if (fs.existsSync(candidate)) return candidate;
	}
	return path.join(os.homedir(), ".omp");
}

export function findAgentDir(ompHome = findOmpHome()): string {
	const env = process.env.PI_CODING_AGENT_DIR?.trim();
	if (env) return path.normalize(env);
	return path.join(ompHome, "agent");
}

export function configPath(ompHome = findOmpHome()): string {
	return path.join(ompHome, "omp-purge.json");
}

export function injectPath(ompHome = findOmpHome()): string {
	return path.join(ompHome, "prompt-inject.md");
}

export async function ensureInjectFile(ompHome = findOmpHome()): Promise<string> {
	const fp = injectPath(ompHome);
	try {
		await fsp.access(fp);
	} catch {
		await fsp.mkdir(path.dirname(fp), { recursive: true });
		await fsp.writeFile(
			fp,
			"# omp-purge global inject (optional)\n# Fill this file to append content every turn. Leave empty to skip.\n",
			"utf8",
		);
	}
	return fp;
}

export async function readInjectContent(ompHome = findOmpHome()): Promise<string> {
	const fp = injectPath(ompHome);
	try {
		const raw = await fsp.readFile(fp, "utf8");
		// Strip leading comment-only header lines for emptiness check, but inject full file if any non-comment body
		const body = raw
			.split("\n")
			.filter((line) => {
				const t = line.trim();
				return t.length > 0 && !t.startsWith("#");
			})
			.join("\n")
			.trim();
		return body;
	} catch {
		return "";
	}
}

export async function loadConfig(ompHome = findOmpHome()): Promise<PurgeConfig> {
	const fp = configPath(ompHome);
	try {
		const raw = JSON.parse(await fsp.readFile(fp, "utf8")) as Partial<PurgeConfig>;
		return { ...DEFAULT_CONFIG, ...raw };
	} catch {
		return { ...DEFAULT_CONFIG };
	}
}

export async function saveConfig(cfg: PurgeConfig, ompHome = findOmpHome()): Promise<void> {
	const fp = configPath(ompHome);
	await fsp.mkdir(path.dirname(fp), { recursive: true });
	await fsp.writeFile(fp, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
}

export type PurgeState = {
	ompHome: string;
	agentDir: string;
	configPath: string;
	injectPath: string;
	config: PurgeConfig;
	injectChars: number;
	injectStatus: string;
	approvalModeHint: string;
};

export async function gatherState(ompHome = findOmpHome()): Promise<PurgeState> {
	const config = await loadConfig(ompHome);
	const inject = await readInjectContent(ompHome);
	const agentDir = findAgentDir(ompHome);
	let approvalModeHint = "unknown";
	const cfgYml = path.join(agentDir, "config.yml");
	try {
		const yml = await fsp.readFile(cfgYml, "utf8");
		const m = yml.match(/approvalMode:\s*([^\s#]+)/);
		approvalModeHint = m?.[1] ?? "(not set — omp default often yolo)";
	} catch {
		approvalModeHint = "(no config.yml)";
	}
	return {
		ompHome,
		agentDir,
		configPath: configPath(ompHome),
		injectPath: injectPath(ompHome),
		config,
		injectChars: inject.length,
		injectStatus: inject ? `ready (${inject.length} chars)` : "empty (no inject)",
		approvalModeHint,
	};
}

export function renderStatus(state: PurgeState): string {
	const c = state.config;
	const on = (v: boolean) => (v ? "on" : "off");
	return [
		"omp-purge 状态 / Status",
		`· enabled:      ${on(c.enabled)}`,
		`· authority:    ${on(c.authority)}`,
		`· inject file:  ${on(c.inject)} — ${state.injectStatus}`,
		`· yolo nudge:   ${on(c.yoloNudge)}`,
		`· OMP_HOME:     ${state.ompHome}`,
		`· agent dir:    ${state.agentDir}`,
		`· config:       ${state.configPath}`,
		`· inject path:  ${state.injectPath}`,
		`· approvalMode: ${state.approvalModeHint}`,
		"",
		"原理: 每轮 before_agent_start 向 systemPrompt 追加权威指令块（不改 node_modules）。",
		"命令: /purge status|apply|revert|edit|help",
	].join("\n");
}

/**
 * Build sections to append. Returns [] when disabled / nothing to add.
 * Idempotent against an already-injected base prompt.
 */
export async function buildAppendSections(
	basePrompt: string[],
	ompHome = findOmpHome(),
): Promise<string[]> {
	const config = await loadConfig(ompHome);
	if (!config.enabled) return [];

	const joined = basePrompt.join("\n");
	const out: string[] = [];

	if (!joined.includes(AUTHORITY_OPEN)) {
		if (config.authority) {
			out.push(wrapAuthority(config.yoloNudge ? YOLO_NUDGE_BODY : ""));
		} else if (config.yoloNudge) {
			out.push(wrapAuthority(YOLO_NUDGE_BODY));
		}
	}

	if (config.inject && !joined.includes(INJECT_OPEN)) {
		const content = await readInjectContent(ompHome);
		if (content) out.push(wrapInject(content));
	}

	return out;
}

export async function applyPurge(ompHome = findOmpHome()): Promise<PurgeConfig> {
	await ensureInjectFile(ompHome);
	const cfg = await loadConfig(ompHome);
	cfg.enabled = true;
	cfg.authority = true;
	cfg.inject = true;
	await saveConfig(cfg, ompHome);
	return cfg;
}

export async function revertPurge(ompHome = findOmpHome()): Promise<PurgeConfig> {
	const cfg = await loadConfig(ompHome);
	cfg.enabled = false;
	await saveConfig(cfg, ompHome);
	return cfg;
}

/** Open prompt-inject.md in $EDITOR / $VISUAL (CLI / non-TUI). */
export function editInjectExternal(ompHome = findOmpHome()): { path: string; cmd: string } {
	const fp = injectPath(ompHome);
	if (!fs.existsSync(fp)) {
		fs.mkdirSync(path.dirname(fp), { recursive: true });
		fs.writeFileSync(
			fp,
			"# omp-purge global inject (optional)\n# Fill this file to append content every turn. Leave empty to skip.\n",
			"utf8",
		);
	}
	const editor = process.env.VISUAL || process.env.EDITOR || (process.platform === "win32" ? "notepad" : "vi");
	const child = spawn(editor, [fp], { stdio: "inherit", shell: process.platform === "win32" });
	child.on("error", (err) => {
		console.error(`[omp-purge] failed to launch editor: ${err}`);
	});
	return { path: fp, cmd: editor };
}

/** Suggest / optionally write tools.approvalMode: yolo into agent config.yml (with .bak). */
export async function ensureYoloApproval(
	agentDir = findAgentDir(),
	write = false,
): Promise<{ status: string; path: string }> {
	const fp = path.join(agentDir, "config.yml");
	let text = "";
	try {
		text = await fsp.readFile(fp, "utf8");
	} catch {
		if (!write) return { status: "missing", path: fp };
		text = "";
	}

	if (/approvalMode:\s*yolo\b/.test(text)) {
		return { status: "already_yolo", path: fp };
	}

	if (!write) {
		return { status: "not_yolo", path: fp };
	}

	const bak = `${fp}.omppurge.bak`;
	if (text && !fs.existsSync(bak)) {
		await fsp.writeFile(bak, text, "utf8");
	}

	let next: string;
	if (/approvalMode:\s*[^\s#]+/.test(text)) {
		next = text.replace(/approvalMode:\s*[^\s#]+/, "approvalMode: yolo");
	} else if (/^tools:\s*$/m.test(text) || /^tools:\s*\n/m.test(text)) {
		next = text.replace(/^(tools:\s*\n)/m, "$1  approvalMode: yolo\n");
	} else {
		next = `${text.trimEnd()}\n\ntools:\n  approvalMode: yolo\n`;
	}
	await fsp.mkdir(path.dirname(fp), { recursive: true });
	await fsp.writeFile(fp, next.endsWith("\n") ? next : `${next}\n`, "utf8");
	return { status: "wrote_yolo", path: fp };
}
