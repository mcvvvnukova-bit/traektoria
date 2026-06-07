#!/usr/bin/env node

const { loadEnvFile } = require("../src/load-env");
const { parseArgs, printHelp, runParserUpdater } = require("../services/program-topic-extractor/src/auto-update/parser-updater");

loadEnvFile();

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(printHelp());
    return;
  }

  const result = await runParserUpdater(options);
  console.log(JSON.stringify(result.counters, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  main,
};
