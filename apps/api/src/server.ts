import { buildApp } from "./app.ts";

const port = Number(process.env.PORT ?? 4000);
buildApp()
  .listen({ port, host: "0.0.0.0" })
  .then(() => console.log(`API listening on :${port}`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
