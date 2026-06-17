const path = require("node:path");
const { spawn } = require("node:child_process");
const { loadEnvFile } = require("../src/load-env");

loadEnvFile();

const {
  finishSyncRun,
  loadSyncCounters,
  markFullCatalogImported,
  refreshProgramProcessingStatuses,
  startSyncRun,
} = require("../src/pfdo-sync-state");

const projectRoot = path.resolve(__dirname, "..");

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const runId = await startSyncRun({
    runType: "full",
    triggerSource: options.triggerSource,
    counters: {
      skipDocuments: options.skipDocuments,
      skipTopics: options.skipTopics,
    },
  });

  try {
    await runNodeScript("scripts/import-pfdo-mirror.js", [], {
      PFDO_IMPORT_APPLY_SCHEMA: "false",
    });
    await markFullCatalogImported({ runId });

    if (!options.skipDocuments) {
      await runNodeScript("scripts/download-pfdo-program-documents.js", [], {
        PFDO_DOCUMENT_ENSURE_COLUMNS: "false",
      });
    }

    if (!options.skipTopics) {
      await runNodeScript("scripts/import-pfdo-calendar-topics.js", [
        "--concurrency",
        String(options.topicConcurrency),
      ], {
        PFDO_TOPIC_IMPORT_APPLY_SCHEMA: "false",
      });
    }

    await refreshProgramProcessingStatuses({ runId });
    const counters = await loadSyncCounters();
    await finishSyncRun(runId, {
      status: "succeeded",
      counters: {
        ...counters,
        skipDocuments: options.skipDocuments,
        skipTopics: options.skipTopics,
      },
    });
    console.log(JSON.stringify({ runId, status: "succeeded", ...counters }, null, 2));
  } catch (error) {
    const counters = await loadSyncCounters().catch(() => ({}));
    await finishSyncRun(runId, {
      status: "failed",
      counters,
      error: error?.message || String(error),
    });
    throw error;
  }
}

function parseArgs(args) {
  const options = {
    skipDocuments: false,
    skipTopics: false,
    topicConcurrency: Number(process.env.PFDO_CALENDAR_TOPIC_CONCURRENCY || 4),
    triggerSource: process.env.PFDO_SYNC_TRIGGER || "manual",
  };

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--skip-documents") {
      options.skipDocuments = true;
    } else if (value === "--skip-topics") {
      options.skipTopics = true;
    } else if (value === "--concurrency") {
      options.topicConcurrency = Number(args[index + 1] || options.topicConcurrency);
      index += 1;
    } else if (value === "--trigger") {
      options.triggerSource = args[index + 1] || options.triggerSource;
      index += 1;
    } else if (value === "--help" || value === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${value}`);
    }
  }

  if (!Number.isFinite(options.topicConcurrency) || options.topicConcurrency < 1) {
    options.topicConcurrency = 4;
  }

  return options;
}

function runNodeScript(scriptPath, args, envOverrides = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: projectRoot,
      env: {
        ...process.env,
        ...envOverrides,
      },
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${scriptPath} failed with ${signal || `exit code ${code}`}`));
    });
  });
}

function printHelp() {
  console.log(`
Usage:
  node scripts/sync-pfdo-programs.js

Options:
  --skip-documents    Import PFDO cards only.
  --skip-topics       Skip calendar-topic extraction and analytics.
  --concurrency 4     Topic extraction concurrency.
  --trigger timer     Trigger label stored in pfdo_sync_runs.
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
