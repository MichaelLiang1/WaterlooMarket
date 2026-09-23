// Runs a real local Postgres (no Docker/Homebrew needed) for development.
// Usage: npm run db:dev  (leave it running in its own terminal)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const databaseDir = "./.pgdata";
const port = Number(process.env.DEV_DB_PORT ?? 5433);
const firstRun = !existsSync(databaseDir);

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
});

if (firstRun) await pg.initialise();
await pg.start();
if (firstRun) await pg.createDatabase("waterloo_market");

console.log(
  `Postgres ready: postgresql://postgres:postgres@localhost:${port}/waterloo_market`,
);

const shutdown = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
