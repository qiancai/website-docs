#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const websiteRoot = path.resolve(__dirname, "..");
const defaultDataRepo = path.resolve(websiteRoot, "..", "tidb-config-data");
const dataRepo = process.env.TIDB_CONFIG_DATA_REPO || defaultDataRepo;
const outputPath = path.join(
  websiteRoot,
  "static",
  "data",
  "config-comparison",
  "dataset.json"
);

const contentTypes = [
  {
    id: "system_variables",
    label: "TiDB System Variables",
    component: "tidb",
    path: "normalized/system_variables.json",
  },
  {
    id: "tidb_config",
    label: "TiDB Config",
    component: "tidb",
    path: "normalized/show_config_tidb.json",
  },
  {
    id: "tikv_config",
    label: "TiKV Config",
    component: "tikv",
    path: "normalized/show_config_tikv.json",
  },
  {
    id: "tiflash_config",
    label: "TiFlash Config",
    component: "tiflash",
    path: "normalized/show_config_tiflash.json",
  },
  {
    id: "pd_config",
    label: "PD Config",
    component: "pd",
    path: "normalized/show_config_pd.json",
  },
];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(
      `Failed to read JSON from ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  return value;
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function pickSystemVariable(row) {
  return {
    VARIABLE_NAME: row.VARIABLE_NAME,
    VARIABLE_SCOPE: row.VARIABLE_SCOPE,
    DEFAULT_VALUE: row.DEFAULT_VALUE,
    CURRENT_VALUE: row.CURRENT_VALUE,
    MIN_VALUE: row.MIN_VALUE,
    MAX_VALUE: row.MAX_VALUE,
    POSSIBLE_VALUES: row.POSSIBLE_VALUES,
    IS_NOOP: row.IS_NOOP,
  };
}

function pickConfig(row) {
  return {
    Type: row.Type,
    Instance: row.Instance,
    Name: row.Name,
    Value: row.Value,
  };
}

const scope = readJson(path.join(dataRepo, "mvp-versions.json"));
assertArray(scope.versions, "mvp-versions.json versions");
const releaseEventsPath = path.join(
  dataRepo,
  "metadata",
  "release-note-events.json"
);
const releaseEventsPayload = fs.existsSync(releaseEventsPath)
  ? readJson(releaseEventsPath)
  : { events: [] };
assertObject(releaseEventsPayload, "release-note-events.json");
assertArray(releaseEventsPayload.events, "release-note-events.json events");

const captures = {};
for (const version of scope.versions) {
  if (!version || typeof version.version !== "string") {
    throw new Error("Each scoped version must define a string version.");
  }
  const versionRows = {};
  for (const contentType of contentTypes) {
    const rows = readJson(
      path.join(dataRepo, version.version, contentType.path)
    );
    assertArray(rows, `${version.version}/${contentType.path}`);
    versionRows[contentType.id] =
      contentType.id === "system_variables"
        ? rows.map(pickSystemVariable)
        : rows.map(pickConfig);
  }
  captures[version.version] = versionRows;
}

const dataset = {
  generatedAt: new Date().toISOString(),
  source: {
    repo: "tidb-config-data",
    scope: scope.scope,
  },
  versions: scope.versions.map((version) => ({
    version: version.version,
    release_date: version.release_date,
    version_type: version.version_type,
  })),
  contentTypes,
  captures,
  releaseEvents: releaseEventsPayload.events || [],
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(dataset, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      output: outputPath,
      versions: dataset.versions.length,
      contentTypes: dataset.contentTypes.length,
      releaseEvents: dataset.releaseEvents.length,
      bytes: fs.statSync(outputPath).size,
    },
    null,
    2
  )
);
