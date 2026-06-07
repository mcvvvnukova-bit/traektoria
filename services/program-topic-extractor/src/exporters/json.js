const fs = require("node:fs/promises");

async function writeJson(outputPath, payload) {
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

module.exports = {
  writeJson,
};
