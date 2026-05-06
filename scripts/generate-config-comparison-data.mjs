#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import GithubSlugger from "github-slugger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const websiteRoot = path.resolve(__dirname, "..");
const defaultDataRepo = path.resolve(websiteRoot, "..", "tidb-config-data");
const dataRepo = process.env.TIDB_CONFIG_DATA_REPO || defaultDataRepo;
const docsConfig = readJson(path.join(websiteRoot, "docs", "docs.json"));
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
    label: "System variables",
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

const docPages = {
  system_variables: "system-variables.md",
  tidb_config: "tidb-configuration-file.md",
  tikv_config: "tikv-configuration-file.md",
  tiflash_config: "tiflash/tiflash-configuration.md",
  pd_config: "pd-configuration-file.md",
};

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

function releaseSeries(version) {
  const match = version.match(/^v?(\d+\.\d+)/);
  return match?.[1] || null;
}

function versionTuple(version) {
  const match = version.match(/^v?(\d+)\.(\d+)(?:\.(\d+))?/);
  return match
    ? [Number(match[1]), Number(match[2]), Number(match[3] || 0)]
    : null;
}

function versionCompare(leftVersion, rightVersion) {
  const left = versionTuple(leftVersion);
  const right = versionTuple(rightVersion);
  if (!left || !right) {
    return 0;
  }
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return 0;
}

function normalizeMarkdownInline(value) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function headingText(value) {
  return value
    .replace(/<span\b[^>]*>(.*?)<\/span>/gi, " $1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function headingItemName(value) {
  return headingText(value)
    .replace(/\s+New in v[\d.]+.*$/i, "")
    .replace(/\s+New in TiDB [\d.]+.*$/i, "")
    .replace(/\s+\((?:Deprecated|Experimental|deprecated)\)\s*$/i, "")
    .trim();
}

function headingVariableName(value) {
  return headingItemName(value);
}

function parseSystemVariableDocs(version) {
  const series = releaseSeries(version);
  if (!series) {
    return new Map();
  }

  const filePath = path.join(
    websiteRoot,
    "docs",
    "markdown-pages",
    "en",
    "tidb",
    `release-${series}`,
    "system-variables.md"
  );
  if (!fs.existsSync(filePath)) {
    return new Map();
  }

  const metadata = new Map();
  let currentName = null;
  let current = null;
  const saveCurrent = () => {
    if (currentName && current) {
      metadata.set(currentName, current);
    }
  };

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const heading = line.match(/^###\s+(.+?)(?:\s+<span\b.*)?$/);
    if (heading) {
      saveCurrent();
      currentName = headingVariableName(heading[1]);
      current = {};
      continue;
    }

    if (!current) {
      continue;
    }

    const bullet = line.match(/^- (.+)$/);
    if (!bullet) {
      continue;
    }

    const text = normalizeMarkdownInline(bullet[1]);
    const field = text.match(/^([^:]+):\s*(.*)$/);
    if (field) {
      const label = field[1].trim();
      const value = field[2].trim();
      if (label === "Persists to cluster") {
        current.PERSISTS_TO_CLUSTER = value || null;
      } else if (label === "Applies to hint SET_VAR") {
        current.APPLIES_TO_SET_VAR = value || null;
      } else if (label === "Type") {
        current.DOC_TYPE = value || null;
      } else if (label === "Range") {
        current.DOC_RANGE = value || null;
      }
      continue;
    }

    if (!current.PURPOSE) {
      current.PURPOSE = text || null;
    }
  }

  saveCurrent();
  return metadata;
}

function tidbDocBranch(version) {
  const series = releaseSeries(version);
  return series ? `release-${series}` : null;
}

function tidbDocVersionPath(branch) {
  return branch === docsConfig.docs?.tidb?.stable
    ? "stable"
    : branch.replace("release-", "v");
}

function tidbDocFilePath(version, docPath) {
  const branch = tidbDocBranch(version);
  if (!branch) {
    return null;
  }
  return path.join(
    websiteRoot,
    "docs",
    "markdown-pages",
    "en",
    "tidb",
    branch,
    docPath
  );
}

function tidbDocUrl(version, docPath, anchor) {
  const branch = tidbDocBranch(version);
  if (!branch) {
    return null;
  }
  const pagePath = docPath.replace(/\.md$/, "");
  return `/tidb/${tidbDocVersionPath(branch)}/${pagePath}#${anchor}`;
}

function headingSlug(heading, slugger) {
  return slugger.slug(headingText(heading));
}

function isConfigName(value) {
  return /^[A-Za-z0-9_.-]+$/.test(value);
}

function isIgnoredConfigSection(value) {
  const normalized = value.toLowerCase();
  return (
    normalized === "global configuration" ||
    normalized === "tiflash configuration parameters" ||
    normalized === "multi-disk deployment" ||
    normalized.startsWith("configure the ")
  );
}

function setIfAbsent(map, key, value) {
  if (key && !map.has(key)) {
    map.set(key, value);
  }
}

function configParentPath(sectionStack, depth) {
  const parts = [];
  for (let currentDepth = 2; currentDepth < depth; currentDepth += 1) {
    const section = sectionStack.get(currentDepth);
    if (section && !isIgnoredConfigSection(section)) {
      parts.push(section);
    }
  }
  return parts.join(".");
}

function combineConfigKey(parentPath, itemName) {
  if (!parentPath || itemName.startsWith(`${parentPath}.`)) {
    return itemName;
  }
  return `${parentPath}.${itemName}`;
}

function docLinkCandidates(contentTypeId, itemKey) {
  const candidates = [itemKey];
  const withoutPrefixes = [];

  if (contentTypeId === "tiflash_config") {
    for (const prefix of ["engine-store.", "raftstore-proxy."]) {
      if (itemKey.startsWith(prefix)) {
        withoutPrefixes.push(itemKey.slice(prefix.length));
      }
    }
  }

  for (const value of withoutPrefixes) {
    candidates.push(value);
  }

  const lastSegment = itemKey.split(".").pop();
  if (lastSegment) {
    candidates.push(lastSegment);
  }

  return Array.from(new Set(candidates));
}

function parseDocHeadingLinks(version, contentTypeId) {
  const docPath = docPages[contentTypeId];
  const filePath = tidbDocFilePath(version, docPath);
  if (!filePath || !fs.existsSync(filePath)) {
    return new Map();
  }

  const slugger = new GithubSlugger();
  const primaryLinks = new Map();
  const leafLinks = new Map();
  const sectionStack = new Map();

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const heading = line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (!heading) {
      continue;
    }

    const depth = heading[1].length;
    const rawHeading = heading[2];
    const itemName = headingItemName(rawHeading);
    const anchor = headingSlug(rawHeading, slugger);
    const url = tidbDocUrl(version, docPath, anchor);

    for (const existingDepth of Array.from(sectionStack.keys())) {
      if (existingDepth >= depth) {
        sectionStack.delete(existingDepth);
      }
    }

    if (!url || !itemName) {
      continue;
    }

    const configName = isConfigName(itemName);
    if (contentTypeId === "system_variables") {
      if (depth === 3 && configName) {
        setIfAbsent(primaryLinks, itemName, url);
      }
      continue;
    }

    const parentPath = configParentPath(sectionStack, depth);
    if (configName && !isIgnoredConfigSection(itemName)) {
      const fullKey = combineConfigKey(parentPath, itemName);
      setIfAbsent(primaryLinks, fullKey, url);
      if (!leafLinks.has(itemName)) {
        leafLinks.set(itemName, []);
      }
      leafLinks.get(itemName).push(url);
    }

    if (configName || !isIgnoredConfigSection(itemName)) {
      sectionStack.set(depth, itemName);
    }
  }

  for (const [itemName, urls] of leafLinks) {
    const uniqueUrls = Array.from(new Set(urls));
    if (uniqueUrls.length === 1) {
      setIfAbsent(primaryLinks, itemName, uniqueUrls[0]);
    }
  }

  return primaryLinks;
}

function itemKeyForRow(contentTypeId, row) {
  return contentTypeId === "system_variables" ? row.VARIABLE_NAME : row.Name;
}

function buildDocLinks(version, versionRows) {
  const linksByType = {};

  for (const contentType of contentTypes) {
    const headingLinks = parseDocHeadingLinks(version, contentType.id);
    if (headingLinks.size === 0) {
      continue;
    }

    const itemLinks = {};
    for (const row of versionRows[contentType.id] || []) {
      const itemKey = itemKeyForRow(contentType.id, row);
      const link = docLinkCandidates(contentType.id, itemKey)
        .map((candidate) => headingLinks.get(candidate))
        .find(Boolean);
      if (link) {
        itemLinks[itemKey] = link;
      }
    }

    if (Object.keys(itemLinks).length > 0) {
      linksByType[contentType.id] = itemLinks;
    }
  }

  return linksByType;
}

function pickSystemVariable(row, version, docsMetadata = {}) {
  const appliesToSetVar =
    docsMetadata.APPLIES_TO_SET_VAR ??
    (versionCompare(version, "v7.4.0") < 0 ? "No" : undefined);

  return {
    VARIABLE_NAME: row.VARIABLE_NAME,
    VARIABLE_SCOPE: row.VARIABLE_SCOPE,
    DEFAULT_VALUE: row.DEFAULT_VALUE,
    CURRENT_VALUE: row.CURRENT_VALUE,
    MIN_VALUE: row.MIN_VALUE,
    MAX_VALUE: row.MAX_VALUE,
    POSSIBLE_VALUES: row.POSSIBLE_VALUES,
    IS_NOOP: row.IS_NOOP,
    PERSISTS_TO_CLUSTER: docsMetadata.PERSISTS_TO_CLUSTER,
    APPLIES_TO_SET_VAR: appliesToSetVar,
    DOC_TYPE: docsMetadata.DOC_TYPE,
    DOC_RANGE: docsMetadata.DOC_RANGE,
    PURPOSE: docsMetadata.PURPOSE,
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
const docLinks = {};
for (const version of scope.versions) {
  if (!version || typeof version.version !== "string") {
    throw new Error("Each scoped version must define a string version.");
  }
  const versionRows = {};
  const systemVariableDocs = parseSystemVariableDocs(version.version);
  for (const contentType of contentTypes) {
    const rows = readJson(
      path.join(dataRepo, version.version, contentType.path)
    );
    assertArray(rows, `${version.version}/${contentType.path}`);
    versionRows[contentType.id] =
      contentType.id === "system_variables"
        ? rows.map((row) =>
            pickSystemVariable(
              row,
              version.version,
              systemVariableDocs.get(row.VARIABLE_NAME) || {}
            )
          )
        : rows.map(pickConfig);
  }
  captures[version.version] = versionRows;
  docLinks[version.version] = buildDocLinks(version.version, versionRows);
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
  docLinks,
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
      docLinks: Object.values(dataset.docLinks).reduce(
        (total, linksByType) =>
          total +
          Object.values(linksByType).reduce(
            (subtotal, itemLinks) => subtotal + Object.keys(itemLinks).length,
            0
          ),
        0
      ),
      bytes: fs.statSync(outputPath).size,
    },
    null,
    2
  )
);
