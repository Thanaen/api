import { Elysia } from "elysia";

import { paniers } from "./modules/paniers";

const app = new Elysia()
  .use(paniers)
  .get("/", ({ redirect }) => redirect("https://thanaen.dev"))
  .listen(3000);

console.log(`Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
