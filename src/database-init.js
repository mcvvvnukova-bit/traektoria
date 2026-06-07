const path = require("node:path");
const { executeSqlFile } = require("./db");

const schemaPath = path.resolve(__dirname, "..", "db", "schema.sql");
const seedsPath = path.resolve(__dirname, "..", "db", "seeds.sql");

async function initializeDatabase() {
  await executeSqlFile(schemaPath);
  await executeSqlFile(seedsPath);
}

module.exports = {
  initializeDatabase,
  schemaPath,
  seedsPath,
};
