const vercelEnv = process.env.VERCEL_ENV;

if (vercelEnv !== "production") {
  console.log(`Skipping PostHog source map upload (VERCEL_ENV=${vercelEnv ?? "unset"})`);
  process.exit(0);
}

const uploadEnabled =
  process.env.POSTHOG_UPLOAD_SOURCEMAPS === "1" || process.env.POSTHOG_UPLOAD_SOURCEMAPS === "true";

if (!uploadEnabled) {
  console.log(
    "Skipping PostHog source map upload (set POSTHOG_UPLOAD_SOURCEMAPS=true after configuring the PostHog CLI credentials)",
  );
  process.exit(0);
}

const posthogCli =
  process.platform === "win32"
    ? "node_modules\\.bin\\posthog-cli.cmd"
    : "node_modules/.bin/posthog-cli";

const MAX_ATTEMPTS = 5;

async function run(args: string[], label: string): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = Bun.spawnSync([posthogCli, ...args], {
      stdio: ["inherit", "inherit", "inherit"],
    });

    if (result.exitCode === 0) {
      return;
    }

    console.warn(
      `PostHog sourcemap ${label} attempt ${attempt}/${MAX_ATTEMPTS} failed (exit code ${result.exitCode})`,
    );

    if (attempt < MAX_ATTEMPTS) {
      const delayMs = 2000 * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.error(`PostHog sourcemap ${label} failed after ${MAX_ATTEMPTS} attempts`);
  process.exit(1);
}

console.log("Uploading PostHog source maps");

await run(["sourcemap", "inject", "--directory", "dist"], "inject");
await run(["sourcemap", "upload", "--directory", "dist"], "upload");

export {};
