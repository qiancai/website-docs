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
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

function pickMetadata(row) {
  const metadata = row.metadata || {};
  return {
    content_type: row.content_type,
    component: row.component,
    item_key: row.item_key,
    display_name: row.display_name,
    description: row.description,
    value_type: row.value_type,
    variable_scope: row.variable_scope,
    docs_url: row.docs_url,
    new_since: row.new_since,
    deprecated_since: row.deprecated_since,
    deprecated_since_versions: metadata.deprecated_since_versions || [],
    removed_since: row.removed_since,
    replacement: row.replacement,
    persists_to_cluster: row.persists_to_cluster,
    applies_to_set_var: row.applies_to_set_var,
    source: row.source,
  };
}

const scope = readJson(path.join(dataRepo, "mvp-versions.json"));
const metadataPath = path.join(
  dataRepo,
  "metadata",
  "config-item-metadata.json"
);
const metadataPayload = fs.existsSync(metadataPath)
  ? readJson(metadataPath)
  : { items: [] };

const captures = {};
for (const version of scope.versions) {
  const versionRows = {};
  for (const contentType of contentTypes) {
    const rows = readJson(
      path.join(dataRepo, version.version, contentType.path)
    );
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
  metadata: metadataPayload.items.map(pickMetadata),
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(dataset)}\n`);
console.log(
  JSON.stringify(
    {
      output: outputPath,
      versions: dataset.versions.length,
      contentTypes: dataset.contentTypes.length,
      metadata: dataset.metadata.length,
      bytes: fs.statSync(outputPath).size,
    },
    null,
    2
  )
);
