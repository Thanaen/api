import app from "./index";
app.listen(3000, () => {
  console.log(`Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
});
