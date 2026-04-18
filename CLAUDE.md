Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

For more information, read the Bun API docs at https://bun.com/docs.

## Code Intelligence

Prefer LSP over Grep/Read for code navigation — it's faster, precise, and avoids reading entire files:

- `workspaceSymbol` to find where something is defined
- `findReferences` to see all usages across the codebase
- `goToDefinition` / `goToImplementation` to jump to source
- `hover` for type info without reading the file

Use Grep only when LSP isn't available or for text/pattern searches (comments, strings, config).

After writing or editing code, check LSP diagnostics and fix errors before proceeding.

## Public API

This is a public API consumed by external clients. When adding or modifying endpoints:

- Keep OpenAPI documentation accurate: update `summary`, `description`, `operationId`, and TypeBox schema descriptions/examples for every affected field and route.
- Keep the MCP server in sync: update tool names, descriptions, and parameters in `src/modules/paniers/mcp-tools.ts` to match any API changes.
- Keep the `@thanaen/api-client` client in sync (see _Client package_ section).

## Client package

`packages/api-client/` publishes `@thanaen/api-client` on npm. Any change to the public API surface MUST be mirrored in the client in the same PR:

- Add / remove / rename an endpoint → update `packages/api-client/src/client.ts`
- Change a request or response schema → update the corresponding interface in `packages/api-client/src/types.ts` (these are hand-written plain TS interfaces, kept in shape-parity with `src/modules/*/model.ts`)
- Change an error shape or status code → update `packages/api-client/src/errors.ts` and the error-handling branch in `client.ts`
- Add / update a test in `packages/api-client/test/` covering the change

Versioning rules for `packages/api-client/package.json`:

- patch: bug fix in client only
- minor: new endpoint or non-breaking additive field
- major: breaking change in a request or response shape

The client is versioned independently from the API, but it carries a `BUILT_FOR_API_VERSION` constant generated at build time from the root `package.json`. When you bump the root API version for a change that affects the client, bump the client version too so `BUILT_FOR_API_VERSION` reflects the API it was tested against.

### Release commands

After bumping `packages/api-client/package.json` and merging to `master`:

```sh
# from master, at the merge commit
VERSION=$(jq -r .version packages/api-client/package.json)
git tag "client-v$VERSION"
git push origin "client-v$VERSION"
```

The `publish-client` workflow picks up the tag, verifies it matches `package.json`, publishes to npm (Trusted Publishing / OIDC, with provenance), and creates a GitHub Release with auto-generated notes.

## Notes

- To update database schema, edit `src/db/schema.ts` then run `db:migrate` to generate database migrations.
- NEVER use unsafe TypeScript syntaxes. Always properly type check data.
