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

## Public API

This is a public API consumed by external clients. When adding or modifying endpoints:

- Keep OpenAPI documentation accurate: update `summary`, `description`, `operationId`, and TypeBox schema descriptions/examples for every affected field and route.
- Keep the MCP server in sync: update tool names, descriptions, and parameters in `src/modules/paniers/mcp-tools.ts` to match any API changes.

## Notes

- To update database schema, edit `src/db/schema.ts` then run `db:migrate` to generate database migrations.
- NEVER use unsafe TypeScript syntaxes. Always properly type check data.
