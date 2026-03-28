import { Elysia } from "elysia";

import { paniers } from "./modules/paniers";

const app = new Elysia().use(paniers).get("/", ({ redirect }) => redirect("https://thanaen.dev"));

export default app;
