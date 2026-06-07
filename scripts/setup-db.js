const path = require("node:path");
const { loadEnvFile } = require("../src/load-env");

loadEnvFile();

const { initializeDatabase, schemaPath, seedsPath } = require("../src/database-init");

async function main() {
  await initializeDatabase();
  console.log("Database initialized.");
  console.log(`Schema: ${path.relative(process.cwd(), schemaPath)}`);
  console.log(`Seeds: ${path.relative(process.cwd(), seedsPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
