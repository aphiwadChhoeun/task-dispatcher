import { rm } from "node:fs/promises";
import path from "node:path";

async function main() {
  const state = path.join(process.cwd(), ".wrangler", "state");
  await rm(state, { recursive: true, force: true });
  console.log(`Removed local Wrangler state at ${state}`);
  console.log("Run `npm run db:migrate:local && npm run db:seed:local` next.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
