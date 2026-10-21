import { spawnSync } from "node:child_process";
import { ROOT } from "./lib";

/** Parses --remote / --env <name> flags shared by seed.ts and tts.ts. */
export function parseTarget(argv: string[]) {
  const remote = argv.includes("--remote");
  const envIdx = argv.indexOf("--env");
  const env = envIdx > -1 ? argv[envIdx + 1] : undefined;
  const dbName = env === "staging" ? "lexi-db-staging" : "lexi-db";
  const bucket = env === "staging" ? "lexi-audio-staging" : "lexi-audio";
  return { remote, env, dbName, bucket };
}

export function wrangler(args: string[]) {
  const r = spawnSync("pnpm", ["exec", "wrangler", ...args], { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`wrangler ${args.join(" ")} failed`);
}
