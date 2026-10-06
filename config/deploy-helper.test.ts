import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(import.meta.dirname, "../.github/workflows/deploy.yml"),
  "utf8",
);
const scripts: string[] = [];
let script: string[] | undefined;
for (const line of workflow.split("\n")) {
  if (line === "        run: |") {
    script = [];
    scripts.push("");
  } else if (script && (line.startsWith("          ") || !line.trim())) {
    script.push(line.slice(10));
    scripts[scripts.length - 1] = script.join("\n");
  } else {
    script = undefined;
  }
}

const roots: string[] = [];
const revision = "a".repeat(40);
const fingerprint = `SHA256:${"a".repeat(43)}`;

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function run(overrides: Record<string, string> = {}, automatic = false) {
  const root = mkdtempSync(join(tmpdir(), "sast-deploy-helper-test-"));
  roots.push(root);
  const bin = join(root, "bin");
  const temporary = join(root, "temporary");
  mkdirSync(bin);
  mkdirSync(temporary);
  const argsPath = join(root, "ssh-args.json");
  const stdinPath = join(root, "ssh-stdin");
  const outputPath = join(root, "github-output");
  const summaryPath = join(root, "github-summary");
  const mocks = {
    gh: "process.stdout.write(process.env.LATEST_REVISION+'\\n');process.exit(Number(process.env.GH_STATUS));",
    "ssh-keyscan":
      "process.stdout.write('fixture.invalid ssh-ed25519 fixture\\n');",
    "ssh-keygen":
      "process.stdout.write('256 '+process.env.SCANNED_FINGERPRINT+' fixture (ED25519)\\n');",
    timeout:
      "const {spawnSync}=require('node:child_process');const r=spawnSync(process.argv[3],process.argv.slice(4),{stdio:'inherit'});process.exit(r.status??1);",
    ssh: "const fs=require('node:fs');fs.writeFileSync(process.env.ARGS_PATH,JSON.stringify(process.argv.slice(2)));const chunks=[];process.stdin.on('data',v=>chunks.push(v));process.stdin.on('end',()=>{fs.writeFileSync(process.env.STDIN_PATH,Buffer.concat(chunks));process.exit(Number(process.env.SSH_STATUS));});",
  };
  for (const [name, body] of Object.entries(mocks)) {
    writeFileSync(join(bin, name), `#!${process.execPath}\n${body}\n`, {
      mode: 0o700,
    });
  }
  const result = spawnSync(
    "bash",
    [
      "-e",
      "-o",
      "pipefail",
      "-c",
      [
        scripts[0],
        ...(automatic
          ? [
              scripts[1],
              'if [ "$(cat "$GITHUB_OUTPUT")" = current=true ]; then',
            ]
          : []),
        scripts[2],
        ...(automatic ? ["fi"] : []),
      ].join("\n"),
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        TMPDIR: temporary,
        ARGS_PATH: argsPath,
        STDIN_PATH: stdinPath,
        GITHUB_OUTPUT: outputPath,
        GITHUB_STEP_SUMMARY: summaryPath,
        GITHUB_REPOSITORY: "NJUPT-SAST/sast-shop-v2-frontend",
        LATEST_REVISION: revision,
        GH_STATUS: "0",
        SSH_STATUS: "0",
        SCANNED_FINGERPRINT: fingerprint,
        DEPLOY_MODE: "deploy",
        APP_NAME: "mobile",
        IMAGE_TAG: `sha-${revision}`,
        DEPLOY_SSH_HOST: "fixture.invalid",
        DEPLOY_SSH_USER: "fixture-user",
        DEPLOY_SSH_KEY: "fixture-private-key",
        DEPLOY_SSH_FINGERPRINT: fingerprint,
        GHCR_USERNAME: "fixture-registry-user",
        GHCR_READ_TOKEN: "fixture-token-'\"$()`",
        GHCR_USING_CUSTOM_TOKEN: "false",
        GHCR_CUSTOM_USERNAME: "",
        ...overrides,
      },
    },
  );
  expect(readdirSync(temporary)).toEqual([]);
  return {
    result,
    args: existsSync(argsPath)
      ? (JSON.parse(readFileSync(argsPath, "utf8")) as string[])
      : undefined,
    input: existsSync(stdinPath) ? readFileSync(stdinPath, "utf8") : undefined,
    summary: existsSync(summaryPath)
      ? readFileSync(summaryPath, "utf8")
      : undefined,
  };
}

describe("restricted deployment helper integration", () => {
  it("automatically deploys the current main revision", () => {
    const { result, args } = run({}, true);
    expect(result.status).toBe(0);
    expect(args?.at(-1)).toContain(`mobile ${revision}`);
  });

  it("skips superseded automatic deployments before connecting to the server", () => {
    const { result, args, summary } = run(
      { LATEST_REVISION: "b".repeat(40) },
      true,
    );
    expect(result.status).toBe(0);
    expect(args).toBeUndefined();
    expect(summary).toContain("Skip superseded automatic deployment");
  });

  it("does not deploy when checking the current main revision fails", () => {
    const { result, args } = run({ GH_STATUS: "1" }, true);
    expect(result.status).not.toBe(0);
    expect(args).toBeUndefined();
  });

  it.each(["mobile", "desktop"])(
    "deploys %s with exact arguments and stdin JSON",
    (app) => {
      const { result, args, input } = run({ APP_NAME: app });
      expect(result.status).toBe(0);
      expect(args?.at(-1)).toBe(
        `sudo -n /usr/local/lib/sast-shop/deploy-image ${app} ${revision} ghcr.io/njupt-sast/sast-shop-v2-frontend-${app}:sha-${revision} --registry-stdin`,
      );
      expect(JSON.parse(input!)).toEqual({
        registry: "ghcr.io",
        username: "fixture-registry-user",
        password: "fixture-token-'\"$()`",
      });
      expect(args).toContain("HostKeyAlgorithms=ssh-ed25519");
      expect(args).toContain("StrictHostKeyChecking=yes");
      expect(args?.join(" ")).not.toContain("fixture-token");
      expect(result.stdout + result.stderr).not.toContain("fixture-token");
    },
  );

  it("keeps diagnostics separate from helper execution and credentials", () => {
    const { result, args, input } = run({
      DEPLOY_MODE: "diagnostic",
      IMAGE_TAG: "",
      GHCR_READ_TOKEN: "",
    });
    expect(result.status).toBe(0);
    expect(args?.at(-1)).toBe("sh -se");
    expect(input).not.toContain("GHCR_READ_TOKEN");
    expect(input).not.toContain("registry_payload");
    expect(input).not.toContain(
      "sudo -n /usr/local/lib/sast-shop/deploy-image ",
    );
    expect(input).not.toContain("docker compose");
  });

  it.each([
    "",
    "main",
    "sha-short",
    `sha-${"g".repeat(40)}`,
    `sha-${revision};true`,
  ])("rejects an invalid immutable tag %s before SSH", (imageTag) => {
    const { result, args } = run({ IMAGE_TAG: imageTag });
    expect(result.status).not.toBe(0);
    expect(args).toBeUndefined();
  });

  it.each([
    { APP_NAME: "mobile;true" },
    { DEPLOY_MODE: "unknown" },
    { SCANNED_FINGERPRINT: `SHA256:${"b".repeat(43)}` },
    { GHCR_USERNAME: "" },
    { GHCR_READ_TOKEN: "token\nsecond-line" },
    { GHCR_READ_TOKEN: "x".repeat(17 * 1024) },
    { GHCR_USING_CUSTOM_TOKEN: "true", GHCR_CUSTOM_USERNAME: "" },
  ])("rejects invalid request or credentials before SSH", (overrides) => {
    const { result, args } = run(overrides);
    expect(result.status).not.toBe(0);
    expect(args).toBeUndefined();
  });

  it("propagates helper or SSH failure and cleans temporary keys", () => {
    const { result } = run({ SSH_STATUS: "23" });
    expect(result.status).toBe(23);
  });
});
