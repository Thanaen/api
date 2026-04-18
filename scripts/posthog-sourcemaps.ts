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

const bunx = process.platform === "win32" ? "bunx.cmd" : "bunx";

function run(args: string[]): void {
  const result = Bun.spawnSync(args, {
    stdio: ["inherit", "inherit", "inherit"],
  });

  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}

console.log("Uploading PostHog source maps");

run([bunx, "@posthog/cli@latest", "sourcemap", "inject", "--directory", "dist"]);
run([bunx, "@posthog/cli@latest", "sourcemap", "upload", "--directory", "dist"]);
