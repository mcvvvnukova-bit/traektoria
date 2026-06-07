function parseCliArgs(argv) {
  const options = {
    csvName: "topics.csv",
    jsonName: "topics.json",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];

    if (value === "--manifest") {
      options.manifestPath = next;
      index += 1;
      continue;
    }

    if (value === "--out-dir") {
      options.outDir = next;
      index += 1;
      continue;
    }

    if (value === "--csv-name") {
      options.csvName = next;
      index += 1;
      continue;
    }

    if (value === "--json-name") {
      options.jsonName = next;
      index += 1;
      continue;
    }

    if (value === "--help" || value === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (!options.manifestPath || !options.outDir) {
    printHelp();
    throw new Error("Both --manifest and --out-dir are required.");
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node index.js --manifest /absolute/path/to/manifest.csv --out-dir /absolute/path/to/output

Optional:
  --csv-name topics.csv
  --json-name topics.json
`);
}

module.exports = {
  parseCliArgs,
};
