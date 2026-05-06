import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { useI18next } from "gatsby-plugin-react-i18next";

const CONTENT_TYPE_IDS = [
  "system_variables",
  "tidb_config",
  "tikv_config",
  "tiflash_config",
  "pd_config",
] as const;

type ContentTypeId = typeof CONTENT_TYPE_IDS[number];

type Status = "new" | "removed" | "modified" | "unchanged";
type FilterStatus = "changed" | "new" | "removed" | "modified" | "deprecated";
type SummaryStatus = Exclude<FilterStatus, "changed">;
type BadgeStatus = Status | FilterStatus;

interface VersionInfo {
  version: string;
  release_date?: string;
  version_type?: string;
}

interface ContentTypeInfo {
  id: ContentTypeId;
  label: string;
  component: string;
}

interface SystemVariableRow {
  VARIABLE_NAME: string;
  VARIABLE_SCOPE?: string | null;
  DEFAULT_VALUE?: unknown;
  CURRENT_VALUE?: unknown;
  MIN_VALUE?: unknown;
  MAX_VALUE?: unknown;
  POSSIBLE_VALUES?: unknown;
  IS_NOOP?: unknown;
  PERSISTS_TO_CLUSTER?: string | null;
  APPLIES_TO_SET_VAR?: string | null;
  DOC_TYPE?: string | null;
  DOC_RANGE?: string | null;
  PURPOSE?: string | null;
}

interface ComponentConfigRow {
  Type: string;
  Instance: string;
  Name: string;
  Value?: unknown;
}

interface ReleaseEvent {
  version: string;
  content_type: ContentTypeId;
  component: string;
  item_key: string;
  event_type: "modified" | "removed" | "deprecated";
  change_type?: string | null;
  change_note?: string | null;
  replacement?: string | null;
  release_note_url?: string | null;
}

type DocLinks = Record<
  string,
  Partial<Record<ContentTypeId, Record<string, string>>>
>;

interface Dataset {
  generatedAt: string;
  versions: VersionInfo[];
  contentTypes: ContentTypeInfo[];
  captures: Record<
    string,
    Record<ContentTypeId, SystemVariableRow[] | ComponentConfigRow[]>
  >;
  releaseEvents: ReleaseEvent[];
  docLinks?: DocLinks;
}

interface CollapsedConfigRow {
  Type?: string;
  Name: string;
  Value?: unknown;
  _instances?: Record<string, unknown>;
}

interface ComparisonRow {
  status: Status;
  content_type: ContentTypeId;
  component: string;
  item_key: string;
  display_name: string;
  value_type?: string | null;
  from_value_type?: string | null;
  to_value_type?: string | null;
  from_value?: unknown;
  to_value?: unknown;
  field_changes: Record<string, { from: unknown; to: unknown }>;
  is_deprecated: boolean;
  deprecated_since?: string | null;
  deprecated_since_versions: string[];
  removed_since?: string | null;
  doc_link?: string | null;
  replacement?: string | null;
  change_note?: string | null;
  change_note_type?: string | null;
  change_note_version?: string | null;
  change_note_url?: string | null;
  change_note_events?: ReleaseEvent[];
  source: string;
  scope?: string | null;
  instances?: Record<string, unknown>;
}

interface ComparisonSummary {
  total: number;
  new: number;
  removed: number;
  modified: number;
  unchanged: number;
  deprecated: number;
}

interface ComparisonResult {
  rows: ComparisonRow[];
  summary: ComparisonSummary;
  label: string;
}

interface PopularComparison {
  from: string;
  to: string;
}

const DATASET_URL = "/data/config-comparison/dataset.json";
const DATASET_REQUEST_TIMEOUT_MS = 15_000;

const STATUS_FILTER_ORDER: FilterStatus[] = [
  "new",
  "removed",
  "modified",
  "deprecated",
];

const STATUS_TONE: Record<BadgeStatus, { fg: string; bg: string }> = {
  changed: {
    fg: "var(--tiui-palette-secondary)",
    bg: "var(--tiui-palette-peacock-100)",
  },
  new: { fg: "#0f8f4d", bg: "#e8f6ee" },
  removed: { fg: "#ff2d2d", bg: "#fff0f0" },
  modified: { fg: "#ff5a1f", bg: "#fff1e8" },
  deprecated: { fg: "#8a35d8", bg: "#f5ecff" },
  unchanged: { fg: "#596174", bg: "#f2f4f8" },
};

const SUMMARY_STATUS_TONE: Record<SummaryStatus, string> = {
  new: "#0f8f4d",
  removed: "var(--tiui-palette-carbon-900)",
  modified: "var(--tiui-palette-primary)",
  deprecated: "var(--tiui-palette-carbon-600)",
};

const CHANGE_FIELD_LABEL_KEYS: Record<string, string> = {
  VARIABLE_SCOPE: "configComparison.changeFields.scope",
  DEFAULT_VALUE: "configComparison.changeFields.defaultValue",
  MIN_VALUE: "configComparison.changeFields.minValue",
  MAX_VALUE: "configComparison.changeFields.maxValue",
  POSSIBLE_VALUES: "configComparison.changeFields.possibleValues",
  IS_NOOP: "configComparison.changeFields.isNoop",
  PERSISTS_TO_CLUSTER: "configComparison.changeFields.persistsToCluster",
  DOC_TYPE: "configComparison.changeFields.docType",
  DOC_RANGE: "configComparison.changeFields.docRange",
  PURPOSE: "configComparison.changeFields.purpose",
  Value: "configComparison.changeFields.value",
};

const CHANGE_DETAIL_TITLE_KEYS: Record<string, string> = {
  defaultValue: "configComparison.changeItems.defaultValue",
  scope: "configComparison.changeItems.scope",
  type: "configComparison.changeItems.type",
  range: "configComparison.changeItems.range",
  possibleValues: "configComparison.changeItems.possibleValues",
  persistsToCluster: "configComparison.changeItems.persistsToCluster",
  isNoop: "configComparison.changeItems.isNoop",
  purpose: "configComparison.changeItems.purpose",
  value: "configComparison.changeItems.value",
};

const SYSTEM_COMPARE_FIELDS = [
  "VARIABLE_SCOPE",
  "DEFAULT_VALUE",
  "MIN_VALUE",
  "MAX_VALUE",
  "POSSIBLE_VALUES",
  "PERSISTS_TO_CLUSTER",
  "DOC_TYPE",
  "DOC_RANGE",
  "PURPOSE",
] as const;

function createEmptySummary(): ComparisonSummary {
  return {
    total: 0,
    new: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
    deprecated: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isContentTypeId(value: unknown): value is ContentTypeId {
  return (
    typeof value === "string" &&
    CONTENT_TYPE_IDS.includes(value as ContentTypeId)
  );
}

function validateDataset(payload: unknown): Dataset {
  if (!isRecord(payload)) {
    throw new Error("The config comparison dataset must be an object.");
  }

  if (!Array.isArray(payload.versions) || payload.versions.length === 0) {
    throw new Error("The config comparison dataset has no versions.");
  }
  if (
    !Array.isArray(payload.contentTypes) ||
    payload.contentTypes.length === 0
  ) {
    throw new Error("The config comparison dataset has no content types.");
  }
  if (!isRecord(payload.captures)) {
    throw new Error("The config comparison dataset has no capture rows.");
  }

  const versions = payload.versions as VersionInfo[];
  for (const version of versions) {
    if (!isRecord(version) || typeof version.version !== "string") {
      throw new Error("Each config comparison version must define a version.");
    }
  }

  const contentTypes = payload.contentTypes as ContentTypeInfo[];
  for (const contentType of contentTypes) {
    if (
      !isRecord(contentType) ||
      !isContentTypeId(contentType.id) ||
      typeof contentType.label !== "string" ||
      typeof contentType.component !== "string"
    ) {
      throw new Error(
        "The config comparison dataset has an invalid content type."
      );
    }
  }

  for (const version of versions) {
    const capture = payload.captures[version.version];
    if (!isRecord(capture)) {
      throw new Error(`Missing capture rows for ${version.version}.`);
    }
    for (const contentType of contentTypes) {
      if (!Array.isArray(capture[contentType.id])) {
        throw new Error(
          `Missing ${contentType.id} rows for ${version.version}.`
        );
      }
    }
  }

  const releaseEvents = payload.releaseEvents;
  if (releaseEvents !== undefined && !Array.isArray(releaseEvents)) {
    throw new Error(
      "The config comparison releaseEvents field must be an array."
    );
  }
  for (const event of (releaseEvents || []) as unknown[]) {
    if (
      !isRecord(event) ||
      !isContentTypeId(event.content_type) ||
      typeof event.version !== "string" ||
      typeof event.component !== "string" ||
      typeof event.item_key !== "string" ||
      !["modified", "removed", "deprecated"].includes(
        event.event_type as string
      )
    ) {
      throw new Error(
        "The config comparison dataset has an invalid release event."
      );
    }
  }

  const dataset = payload as unknown as Dataset;
  return {
    ...dataset,
    releaseEvents: (releaseEvents || []) as ReleaseEvent[],
  };
}

async function fetchDataset() {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    DATASET_REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(DATASET_URL, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to load ${DATASET_URL}`);
    }
    return validateDataset(await response.json());
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Timed out loading ${DATASET_URL}`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function normalizeValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function displayValue(value: unknown, seen = new WeakSet<object>()): string {
  if (typeof value === "object" && value !== null) {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 0) {
      const text = entries
        .map(
          ([instance, instanceValue]) =>
            `${instance}=${displayValue(instanceValue, seen)}`
        )
        .join("\n");
      seen.delete(value);
      return text;
    }
    seen.delete(value);
  }
  const normalized = normalizeValue(value);
  if (normalized === null || normalized === "") {
    return "-";
  }
  return normalized;
}

function formatTemplate(
  template: string,
  values: Record<string, string | number>
) {
  return Object.entries(values).reduce(
    (text, [key, value]) =>
      text.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), String(value)),
    template
  );
}

function versionTuple(
  version?: string | null
): [number, number, number] | null {
  if (!version) {
    return null;
  }
  const match = version.match(/^v?(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3] || 0)];
}

function versionCompare(
  leftVersion?: string | null,
  rightVersion?: string | null
) {
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

function releaseDateTimestamp(version: VersionInfo) {
  if (!version.release_date) {
    return null;
  }
  const timestamp = Date.parse(`${version.release_date}T00:00:00Z`);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function compareVersionInfoByReleaseDate(
  left: VersionInfo,
  right: VersionInfo
) {
  const leftDate = releaseDateTimestamp(left);
  const rightDate = releaseDateTimestamp(right);
  if (leftDate !== null && rightDate !== null && leftDate !== rightDate) {
    return leftDate - rightDate;
  }
  if (leftDate !== null && rightDate === null) {
    return -1;
  }
  if (leftDate === null && rightDate !== null) {
    return 1;
  }
  return (
    versionCompare(left.version, right.version) ||
    left.version.localeCompare(right.version)
  );
}

function sortedVersionsByReleaseDate(versions: VersionInfo[]) {
  return [...versions].sort(compareVersionInfoByReleaseDate);
}

function buildVersionOrder(versions: VersionInfo[]) {
  return new Map(versions.map((version, index) => [version.version, index]));
}

function buildPopularComparisons(
  versions: VersionInfo[],
  limit = 3
): PopularComparison[] {
  const versionIndex = new Map(
    versions.map((version, index) => [version.version, index])
  );
  const latestVersion = versions[versions.length - 1]?.version;
  const candidates: PopularComparison[] = [
    { from: "v7.5.0", to: "v8.5.0" },
    { from: "v8.1.0", to: "v8.5.0" },
  ];

  if (latestVersion && latestVersion !== "v8.5.0") {
    candidates.push({ from: "v8.5.0", to: latestVersion });
  }
  if (versions.length >= 2) {
    candidates.push({
      from: versions[versions.length - 2].version,
      to: versions[versions.length - 1].version,
    });
  }

  const seen = new Set<string>();
  return candidates
    .filter(({ from, to }) => {
      const fromIndex = versionIndex.get(from);
      const toIndex = versionIndex.get(to);
      const key = `${from}->${to}`;
      if (
        fromIndex === undefined ||
        toIndex === undefined ||
        fromIndex >= toIndex ||
        seen.has(key)
      ) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function compareVersionByOrder(
  leftVersion: string,
  rightVersion: string,
  versionOrder: Map<string, number>
) {
  const left = versionOrder.get(leftVersion);
  const right = versionOrder.get(rightVersion);
  if (left !== undefined && right !== undefined) {
    return left - right;
  }
  return versionCompare(leftVersion, rightVersion);
}

function inferValueType(
  fromValue: unknown,
  toValue: unknown,
  possibleValues?: unknown
) {
  const values = [fromValue, toValue]
    .map((value) => normalizeValue(value))
    .filter((value): value is string => !!value && value !== "-");
  const upperValues = new Set(values.map((value) => value.toUpperCase()));
  const possible = normalizeValue(possibleValues);
  if (possible) {
    const possibleSet = new Set(
      possible
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean)
    );
    if (
      possibleSet.size > 0 &&
      Array.from(possibleSet).every((value) =>
        ["ON", "OFF", "TRUE", "FALSE", "YES", "NO", "0", "1"].includes(value)
      )
    ) {
      return "bool";
    }
    if (possibleSet.size > 0) {
      return "enum";
    }
  }
  if (
    upperValues.size > 0 &&
    Array.from(upperValues).every((value) =>
      ["ON", "OFF", "TRUE", "FALSE", "YES", "NO", "0", "1"].includes(value)
    )
  ) {
    return "bool";
  }
  if (values.length > 0 && values.every((value) => /^[-+]?\d+$/.test(value))) {
    return "int";
  }
  if (
    values.length > 0 &&
    values.every((value) => /^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(value))
  ) {
    return "float";
  }
  return values.length > 0 ? "string" : null;
}

function itemMapKey(contentType: ContentTypeId, itemKey: string) {
  return `${contentType}\u0000${itemKey}`;
}

function buildReleaseEventMap(dataset: Dataset) {
  const map = new Map<string, ReleaseEvent[]>();
  for (const event of dataset.releaseEvents || []) {
    const key = itemMapKey(event.content_type, event.item_key);
    map.set(key, [...(map.get(key) || []), event]);
  }
  for (const events of map.values()) {
    events.sort((left, right) => versionCompare(left.version, right.version));
  }
  return map;
}

function eventAppliesToTarget(
  eventVersion: string | null | undefined,
  targetVersion: string
) {
  const event = versionTuple(eventVersion);
  const target = versionTuple(targetVersion);
  if (!event || !target || versionCompare(eventVersion, targetVersion) > 0) {
    return false;
  }
  if (event[0] === target[0] && event[1] === target[1]) {
    return true;
  }
  return event[2] === 0;
}

function eventInCompareRange(
  eventVersion: string | null | undefined,
  fromVersion: string,
  toVersion: string
) {
  const event = versionTuple(eventVersion);
  const from = versionTuple(fromVersion);
  const to = versionTuple(toVersion);
  if (!event || !from || !to || versionCompare(fromVersion, toVersion) === 0) {
    return false;
  }
  const low =
    versionCompare(fromVersion, toVersion) < 0 ? fromVersion : toVersion;
  const high = low === fromVersion ? toVersion : fromVersion;
  return (
    versionCompare(eventVersion, low) > 0 &&
    versionCompare(eventVersion, high) <= 0
  );
}

function activeReleaseEventSince(
  events: ReleaseEvent[],
  toVersion: string,
  eventType: ReleaseEvent["event_type"]
) {
  return (
    events.find(
      (event) =>
        event.event_type === eventType &&
        eventAppliesToTarget(event.version, toVersion)
    )?.version || null
  );
}

function releaseEventsInRange(
  events: ReleaseEvent[],
  fromVersion: string,
  toVersion: string
) {
  return events.filter((event) =>
    eventInCompareRange(event.version, fromVersion, toVersion)
  );
}

function changeNoteFromEvents(events: ReleaseEvent[]) {
  if (events.length === 0) {
    return null;
  }
  if (events.length === 1) {
    return events[0].change_note || null;
  }
  return events
    .filter((event) => event.change_note)
    .map((event) => `${event.version}: ${event.change_note}`)
    .join("\n");
}

function collapseConfigRows(rows: ComponentConfigRow[]) {
  const grouped = new Map<string, ComponentConfigRow[]>();
  for (const row of rows) {
    grouped.set(row.Name, [...(grouped.get(row.Name) || []), row]);
  }
  const collapsed = new Map<string, CollapsedConfigRow>();
  for (const [name, items] of grouped) {
    const sorted = [...items].sort((a, b) =>
      a.Instance.localeCompare(b.Instance)
    );
    const values = Object.fromEntries(
      sorted.map((row) => [row.Instance, row.Value])
    );
    const distinct = new Set(
      Object.values(values).map((value) => normalizeValue(value))
    );
    collapsed.set(name, {
      Type: sorted[0]?.Type,
      Name: name,
      Value: distinct.size === 1 ? sorted[0]?.Value : values,
      _instances: values,
    });
  }
  return collapsed;
}

function loadRows(
  dataset: Dataset,
  version: string,
  contentType: ContentTypeId
): Map<string, SystemVariableRow | CollapsedConfigRow> {
  const rows = dataset.captures[version]?.[contentType] || [];
  if (contentType === "system_variables") {
    return new Map(
      (rows as SystemVariableRow[]).map((row) => [row.VARIABLE_NAME, row])
    );
  }
  return collapseConfigRows(rows as ComponentConfigRow[]);
}

function fieldChanges(
  fromRow: SystemVariableRow | CollapsedConfigRow | undefined,
  toRow: SystemVariableRow | CollapsedConfigRow | undefined,
  fields: readonly string[]
) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (!fromRow || !toRow) {
    return changes;
  }
  const fromRecord = fromRow as unknown as Record<string, unknown>;
  const toRecord = toRow as unknown as Record<string, unknown>;
  for (const field of fields) {
    const fromValue = normalizeValue(fromRecord[field]);
    const toValue = normalizeValue(toRecord[field]);
    if (fromValue !== toValue) {
      changes[field] = {
        from: fromRecord[field],
        to: toRecord[field],
      };
    }
  }
  return changes;
}

function statusFor(
  fromRow: SystemVariableRow | CollapsedConfigRow | undefined,
  toRow: SystemVariableRow | CollapsedConfigRow | undefined,
  changes: Record<string, { from: unknown; to: unknown }>
): Status {
  if (!fromRow && toRow) {
    return "new";
  }
  if (fromRow && !toRow) {
    return "removed";
  }
  return Object.keys(changes).length > 0 ? "modified" : "unchanged";
}

function docLinkForRow(
  dataset: Dataset,
  status: Status,
  contentType: ContentTypeId,
  itemKey: string,
  fromVersion: string,
  toVersion: string
) {
  const docVersion = status === "removed" ? fromVersion : toVersion;
  return dataset.docLinks?.[docVersion]?.[contentType]?.[itemKey] || null;
}

function compare(
  dataset: Dataset,
  releaseEventsByItem: Map<string, ReleaseEvent[]>,
  fromVersion: string,
  toVersion: string,
  contentType: ContentTypeId
): ComparisonResult {
  const spec = dataset.contentTypes.find((item) => item.id === contentType);
  if (!spec) {
    return { rows: [], summary: createEmptySummary(), label: "" };
  }
  const fromRows = loadRows(dataset, fromVersion, contentType);
  const toRows = loadRows(dataset, toVersion, contentType);
  const keys = Array.from(
    new Set([...fromRows.keys(), ...toRows.keys()])
  ).sort();
  const rows: ComparisonRow[] = [];
  const summary: ComparisonSummary = {
    total: keys.length,
    new: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
    deprecated: 0,
  };

  for (const itemKey of keys) {
    const fromRow = fromRows.get(itemKey);
    const toRow = toRows.get(itemKey);
    const effectiveRow = toRow || fromRow;
    const itemReleaseEvents =
      releaseEventsByItem.get(itemMapKey(contentType, itemKey)) || [];
    const intervalReleaseEvents = releaseEventsInRange(
      itemReleaseEvents,
      fromVersion,
      toVersion
    );
    const compareFields =
      contentType === "system_variables"
        ? SYSTEM_COMPARE_FIELDS
        : (["Value"] as const);
    const changes = fieldChanges(fromRow, toRow, compareFields);
    const status = statusFor(fromRow, toRow, changes);
    const docLink = docLinkForRow(
      dataset,
      status,
      contentType,
      itemKey,
      fromVersion,
      toVersion
    );
    const deprecatedSinceVersions = Array.from(
      new Set(
        itemReleaseEvents
          .filter((event) => event.event_type === "deprecated")
          .map((event) => event.version)
      )
    ).sort(versionCompare);
    const activeDeprecatedSince = activeReleaseEventSince(
      itemReleaseEvents,
      toVersion,
      "deprecated"
    );
    const activeRemovedSince = activeReleaseEventSince(
      itemReleaseEvents,
      toVersion,
      "removed"
    );
    const firstIntervalEvent = intervalReleaseEvents[0];
    const changeNote = changeNoteFromEvents(intervalReleaseEvents);
    const isDeprecated = !!activeDeprecatedSince && !!toRow;

    summary[status] += 1;
    if (isDeprecated) {
      summary.deprecated += 1;
    }

    if (contentType === "system_variables") {
      const fromVariable = fromRow as SystemVariableRow | undefined;
      const toVariable = toRow as SystemVariableRow | undefined;
      const effectiveVariable = effectiveRow as SystemVariableRow | undefined;
      const fromValue = fromVariable?.DEFAULT_VALUE;
      const toValue = toVariable?.DEFAULT_VALUE;
      const fromValueType =
        fromVariable?.DOC_TYPE ||
        inferValueType(fromValue, undefined, fromVariable?.POSSIBLE_VALUES);
      const toValueType =
        toVariable?.DOC_TYPE ||
        inferValueType(undefined, toValue, toVariable?.POSSIBLE_VALUES);
      rows.push({
        status,
        content_type: contentType,
        component: spec.component,
        item_key: itemKey,
        display_name: itemKey,
        value_type:
          effectiveVariable?.DOC_TYPE ||
          inferValueType(
            fromValue,
            toValue,
            effectiveVariable?.POSSIBLE_VALUES
          ),
        from_value_type: fromValueType,
        to_value_type: toValueType,
        from_value: fromValue,
        to_value: toValue,
        field_changes: changes,
        is_deprecated: isDeprecated,
        deprecated_since: isDeprecated ? activeDeprecatedSince : null,
        deprecated_since_versions: deprecatedSinceVersions,
        removed_since: activeRemovedSince,
        doc_link: docLink,
        replacement: firstIntervalEvent?.replacement || null,
        change_note: changeNote,
        change_note_type: firstIntervalEvent?.event_type,
        change_note_version: firstIntervalEvent?.version,
        change_note_url: firstIntervalEvent?.release_note_url,
        change_note_events: intervalReleaseEvents,
        source: "variables_info",
        scope: effectiveVariable?.VARIABLE_SCOPE || null,
      });
    } else {
      const fromConfig = fromRow as CollapsedConfigRow | undefined;
      const toConfig = toRow as CollapsedConfigRow | undefined;
      const effectiveConfig = effectiveRow as CollapsedConfigRow | undefined;
      const fromValueType = inferValueType(fromConfig?.Value, undefined);
      const toValueType = inferValueType(undefined, toConfig?.Value);
      rows.push({
        status,
        content_type: contentType,
        component: spec.component,
        item_key: itemKey,
        display_name: itemKey,
        value_type: inferValueType(fromConfig?.Value, toConfig?.Value),
        from_value_type: fromValueType,
        to_value_type: toValueType,
        from_value: fromConfig?.Value,
        to_value: toConfig?.Value,
        field_changes: changes,
        is_deprecated: isDeprecated,
        deprecated_since: isDeprecated ? activeDeprecatedSince : null,
        deprecated_since_versions: deprecatedSinceVersions,
        removed_since: activeRemovedSince,
        doc_link: docLink,
        replacement: firstIntervalEvent?.replacement || null,
        change_note: changeNote,
        change_note_type: firstIntervalEvent?.event_type,
        change_note_version: firstIntervalEvent?.version,
        change_note_url: firstIntervalEvent?.release_note_url,
        change_note_events: intervalReleaseEvents,
        source: "show_config",
        scope: null,
        instances: effectiveConfig?._instances,
      });
    }
  }

  return { rows, summary, label: spec.label };
}

function matchesSearch(row: ComparisonRow, search: string) {
  if (!search.trim()) {
    return true;
  }
  const needle = search.toLowerCase();
  return [row.item_key, row.display_name]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function matchesFilter(row: ComparisonRow, status: FilterStatus) {
  if (status === "changed") {
    return row.status !== "unchanged" || row.is_deprecated;
  }
  if (status === "deprecated") {
    return row.is_deprecated;
  }
  return row.status === status;
}

function changeFieldLabel(field: string, t: (key: string) => string) {
  const key = CHANGE_FIELD_LABEL_KEYS[field];
  return key ? t(key) : field;
}

function changeDetailTitle(
  key: keyof typeof CHANGE_DETAIL_TITLE_KEYS,
  t: (key: string) => string
) {
  return t(CHANGE_DETAIL_TITLE_KEYS[key]);
}

function formatChangeValue(from: unknown, to: unknown) {
  return `${displayValue(from)} -> ${displayValue(to)}`;
}

function formatLabeledChange(label: string, from: unknown, to: unknown) {
  return `${label}: ${formatChangeValue(from, to)}`;
}

interface ChangeDetailItem {
  title: string;
  lines: string[];
}

function buildChangeDetailItems(
  row: ComparisonRow,
  t: (key: string) => string
) {
  const items: ChangeDetailItem[] = [];
  const handledFields = new Set<string>();

  const addFieldChange = (
    field: string,
    titleKey: keyof typeof CHANGE_DETAIL_TITLE_KEYS,
    label?: string
  ) => {
    const change = row.field_changes[field];
    if (!change) {
      return;
    }
    handledFields.add(field);
    items.push({
      title: changeDetailTitle(titleKey, t),
      lines: [
        label
          ? formatLabeledChange(label, change.from, change.to)
          : formatChangeValue(change.from, change.to),
      ],
    });
  };

  addFieldChange("VARIABLE_SCOPE", "scope");
  addFieldChange("PERSISTS_TO_CLUSTER", "persistsToCluster");

  const docTypeChange = row.field_changes.DOC_TYPE;
  if (docTypeChange) {
    handledFields.add("DOC_TYPE");
    items.push({
      title: changeDetailTitle("type", t),
      lines: [formatChangeValue(docTypeChange.from, docTypeChange.to)],
    });
  } else if (
    row.from_value_type &&
    row.to_value_type &&
    row.from_value_type !== row.to_value_type
  ) {
    items.push({
      title: changeDetailTitle("type", t),
      lines: [formatChangeValue(row.from_value_type, row.to_value_type)],
    });
  }

  addFieldChange("DEFAULT_VALUE", "defaultValue");
  addFieldChange("Value", "value");
  addFieldChange("POSSIBLE_VALUES", "possibleValues");

  const rangeLines: string[] = [];
  for (const field of ["MIN_VALUE", "MAX_VALUE", "DOC_RANGE"]) {
    const change = row.field_changes[field];
    if (!change) {
      continue;
    }
    handledFields.add(field);
    rangeLines.push(
      formatLabeledChange(changeFieldLabel(field, t), change.from, change.to)
    );
  }
  if (rangeLines.length > 0) {
    items.push({
      title: changeDetailTitle("range", t),
      lines: rangeLines,
    });
  }

  addFieldChange("PURPOSE", "purpose");

  for (const [field, change] of Object.entries(row.field_changes)) {
    if (handledFields.has(field)) {
      continue;
    }
    items.push({
      title: changeFieldLabel(field, t),
      lines: [formatChangeValue(change.from, change.to)],
    });
  }

  return items;
}

function changeDetailsDisplayText(
  row: ComparisonRow,
  t: (key: string) => string
) {
  return buildChangeDetailItems(row, t)
    .map((item) =>
      item.lines.length > 0
        ? `${item.title}: ${item.lines.join("; ")}`
        : item.title
    )
    .join("\n");
}

function hasDisplayedValueChange(
  row: ComparisonRow,
  contentType: ContentTypeId
) {
  const valueField =
    contentType === "system_variables" ? "DEFAULT_VALUE" : "Value";
  return Object.prototype.hasOwnProperty.call(row.field_changes, valueField);
}

function csvEscape(value: unknown) {
  const text = displayValue(value).replace(/\n/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(
  rows: ComparisonRow[],
  filename: string,
  t: (key: string) => string,
  includeChangeNote: boolean
) {
  const headers = [
    "status",
    "item_key",
    "scope",
    "value_type",
    "from_value",
    "to_value",
    "changed_fields",
    "is_deprecated",
    "deprecated_since",
    "doc_link",
    "replacement",
    ...(includeChangeNote
      ? ["change_note", "change_note_version", "change_note_url"]
      : []),
    "source",
  ];
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          if (header === "changed_fields") {
            return csvEscape(changeDetailsDisplayText(row, t));
          }
          return csvEscape((row as unknown as Record<string, unknown>)[header]);
        })
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function StatusChip(props: { status: BadgeStatus; count?: number }) {
  const { t } = useI18next();
  const tone = STATUS_TONE[props.status];
  return (
    <Chip
      label={`${t(`configComparison.status.${props.status}`)}${
        props.count === undefined ? "" : ` ${props.count}`
      }`}
      size="small"
      sx={{
        color: tone.fg,
        backgroundColor: tone.bg,
        borderRadius: "4px",
        fontWeight: 600,
      }}
    />
  );
}

function changeTypeChipStatuses(row: ComparisonRow): BadgeStatus[] {
  if (!row.is_deprecated) {
    return [row.status];
  }
  if (row.status === "unchanged") {
    return ["deprecated"];
  }
  if (row.status === "modified" || row.status === "new") {
    return [row.status, "deprecated"];
  }
  return [row.status];
}

function ChangeTypeChips(props: { row: ComparisonRow }) {
  const statuses = changeTypeChipStatuses(props.row);
  return (
    <Stack
      direction="row"
      alignItems="center"
      sx={{ flexWrap: "wrap", rowGap: 0.5 }}
    >
      {statuses.map((status, index) => (
        <React.Fragment key={status}>
          {index > 0 && (
            <Typography
              component="span"
              sx={{
                color: "#687083",
                fontSize: "13px",
                fontWeight: 700,
                marginX: 0.5,
              }}
            >
              +
            </Typography>
          )}
          <StatusChip status={status} />
        </React.Fragment>
      ))}
    </Stack>
  );
}

function SummaryMetric(props: {
  status: SummaryStatus;
  value: number;
  suffix: string;
  active: boolean;
  onClick: (status: SummaryStatus) => void;
}) {
  const { t } = useI18next();
  const tone = SUMMARY_STATUS_TONE[props.status];
  return (
    <ButtonBase
      onClick={() => props.onClick(props.status)}
      sx={{
        alignItems: "center",
        backgroundColor: props.active
          ? "var(--tiui-palette-peacock-50)"
          : "#fff",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        minHeight: { xs: "92px", md: "84px" },
        padding: { xs: "12px", md: "10px 14px" },
        textAlign: "center",
        transition: "background-color 120ms ease, box-shadow 120ms ease",
        width: "100%",
        "&:hover": {
          backgroundColor: "var(--tiui-palette-peacock-50)",
        },
        "&:focus-visible": {
          boxShadow: "inset 0 0 0 2px var(--tiui-palette-secondary)",
          outline: "none",
        },
      }}
    >
      <Typography
        sx={{
          color: tone,
          fontSize: "14px",
          fontWeight: 600,
        }}
      >
        {t(`configComparison.status.${props.status}`)}
      </Typography>
      <Stack
        direction="row"
        alignItems="baseline"
        spacing={1}
        justifyContent="center"
      >
        <Typography
          sx={{
            color: tone,
            fontSize: { xs: "22px", md: "26px" },
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          {props.value.toLocaleString()}
        </Typography>
        <Typography sx={{ fontSize: "13px", color: "#687083" }}>
          {props.suffix}
        </Typography>
      </Stack>
    </ButtonBase>
  );
}

function SummaryPanel(props: {
  summary: ComparisonSummary;
  suffix: string;
  activeStatus: FilterStatus;
  onStatusChange: (status: FilterStatus) => void;
}) {
  const items: { status: SummaryStatus; value: number }[] = [
    { status: "new", value: props.summary.new },
    { status: "removed", value: props.summary.removed },
    { status: "modified", value: props.summary.modified },
    { status: "deprecated", value: props.summary.deprecated },
  ];

  return (
    <Paper
      variant="outlined"
      sx={{
        borderColor: "#dfe5ef",
        borderRadius: "8px",
        marginBottom: 2,
        maxWidth: { md: 960 },
        overflow: "hidden",
        width: "100%",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            md: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        {items.map((item, index) => (
          <Box
            key={item.status}
            sx={{
              borderLeft: {
                xs: index % 2 === 0 ? "none" : "1px solid #e4e8f0",
                md: index === 0 ? "none" : "1px solid #e4e8f0",
              },
              borderTop: {
                xs: index < 2 ? "none" : "1px solid #e4e8f0",
                md: "none",
              },
            }}
          >
            <SummaryMetric
              status={item.status}
              value={item.value}
              suffix={props.suffix}
              active={props.activeStatus === item.status}
              onClick={props.onStatusChange}
            />
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

function ChangeDetailList(props: { row: ComparisonRow }) {
  const { t } = useI18next();
  const items = buildChangeDetailItems(props.row, t);

  if (items.length === 0) {
    return (
      <Typography sx={{ color: "#9aa2b1", fontSize: "13px" }}>-</Typography>
    );
  }

  return (
    <Box
      component="ul"
      sx={{
        margin: 0,
        paddingLeft: "18px",
        "& li::marker": {
          color: "#8a94a6",
        },
      }}
    >
      {items.map((item, index) => (
        <Box
          component="li"
          key={`${item.title}-${index}`}
          sx={{
            marginBottom: index === items.length - 1 ? 0 : "8px",
            paddingLeft: "2px",
          }}
        >
          <Typography
            component="span"
            sx={{ color: "#2b3345", fontSize: "13px", fontWeight: 700 }}
          >
            {item.title}
          </Typography>
          {item.lines.length > 0 && (
            <Typography
              component="span"
              sx={{
                color: "#596174",
                display: "block",
                fontSize: "13px",
                marginTop: "2px",
                whiteSpace: "pre-wrap",
              }}
            >
              {item.lines.join("\n")}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

function SelectFilter(props: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  optionLabel?: (value: string) => string;
  minWidth?: number;
  includeAll?: boolean;
  emptyLabel?: string;
  emptyValue?: string;
}) {
  const { t } = useI18next();
  const emptyValue = props.emptyValue ?? "all";
  return (
    <FormControl
      size="small"
      sx={{ minWidth: { xs: "100%", md: props.minWidth || 150 } }}
    >
      <Select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        displayEmpty
        sx={{
          borderRadius: "6px",
          color: "#596174",
          fontSize: "14px",
          height: "44px",
        }}
      >
        {props.includeAll !== false && (
          <MenuItem value={emptyValue}>
            {props.emptyLabel ||
              `${props.label}: ${t("configComparison.filters.all")}`}
          </MenuItem>
        )}
        {props.options.map((option) => (
          <MenuItem key={option} value={option}>
            {props.label}: {props.optionLabel?.(option) || option}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function ConfigComparisonTable(props: {
  rows: ComparisonRow[];
  fromVersion: string;
  toVersion: string;
  contentType: ContentTypeId;
  showChangeDetails: boolean;
  showChangeNote: boolean;
}) {
  const { t } = useI18next();
  if (props.rows.length === 0) {
    return (
      <Box sx={{ padding: "36px", textAlign: "center", color: "#687083" }}>
        {t("configComparison.noMatchingItems")}
      </Box>
    );
  }
  const valueColumnLabel =
    props.contentType === "system_variables"
      ? t("configComparison.table.default")
      : t("configComparison.table.value");
  const itemColumnLabel =
    props.contentType === "system_variables"
      ? t("configComparison.table.systemVariable")
      : t("configComparison.table.item");
  const tableMinWidth =
    700 +
    (props.showChangeDetails ? 120 : 0) +
    (props.showChangeNote ? 140 : 0);

  return (
    <TableContainer
      sx={{
        background:
          "linear-gradient(to left, rgba(31, 36, 48, 0.12), rgba(31, 36, 48, 0)) right center / 28px 100% no-repeat",
        border: "1px solid #e4e8f0",
        borderRadius: "8px",
        overflowX: "auto",
      }}
    >
      <Table size="small" sx={{ minWidth: tableMinWidth }}>
        <TableHead>
          <TableRow
            sx={{
              backgroundColor: "#fbfcff",
              "& .MuiTableCell-root": {
                color: "#2b3345",
                fontSize: "13px",
                fontWeight: 700,
                whiteSpace: "nowrap",
              },
            }}
          >
            <TableCell>{t("configComparison.table.status")}</TableCell>
            <TableCell>{itemColumnLabel}</TableCell>
            <TableCell>
              {valueColumnLabel} ({props.fromVersion})
            </TableCell>
            <TableCell>
              {valueColumnLabel} ({props.toVersion})
            </TableCell>
            {props.showChangeDetails && (
              <TableCell>{t("configComparison.table.changeDetails")}</TableCell>
            )}
            <TableCell>{t("configComparison.table.deprecated")}</TableCell>
            {props.showChangeNote && (
              <TableCell>{t("configComparison.table.changeNote")}</TableCell>
            )}
            <TableCell>{t("configComparison.table.source")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {props.rows.map((row) => {
            const valueChanged = hasDisplayedValueChange(
              row,
              props.contentType
            );
            return (
              <TableRow
                hover
                key={`${row.content_type}-${row.item_key}`}
                sx={{
                  "& .MuiTableCell-root": {
                    borderColor: "#e8edf5",
                    paddingBottom: "14px",
                    paddingTop: "14px",
                  },
                }}
              >
                <TableCell>
                  <ChangeTypeChips row={row} />
                </TableCell>
                <TableCell
                  sx={{
                    fontFamily: "monospace",
                    fontSize: "13px",
                    maxWidth: 280,
                  }}
                >
                  {row.doc_link ? (
                    <Box
                      component="a"
                      href={row.doc_link}
                      sx={{
                        color: "var(--tiui-palette-secondary)",
                        overflowWrap: "anywhere",
                        textDecoration: "none",
                        "&:hover": {
                          textDecoration: "underline",
                        },
                      }}
                    >
                      {row.item_key}
                    </Box>
                  ) : (
                    row.item_key
                  )}
                </TableCell>
                <TableCell
                  sx={{
                    whiteSpace: "pre-wrap",
                    color: "#596174",
                    fontSize: "13px",
                    maxWidth: 220,
                  }}
                >
                  {displayValue(row.from_value)}
                </TableCell>
                <TableCell
                  sx={{
                    whiteSpace: "pre-wrap",
                    color: valueChanged ? "#d45a00" : "#596174",
                    fontSize: "13px",
                    maxWidth: 220,
                    fontWeight: valueChanged ? 700 : 400,
                  }}
                >
                  {displayValue(row.to_value)}
                </TableCell>
                {props.showChangeDetails && (
                  <TableCell
                    sx={{
                      color: "#596174",
                      fontSize: "13px",
                      maxWidth: 320,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    <ChangeDetailList row={row} />
                  </TableCell>
                )}
                <TableCell>
                  {row.is_deprecated ? (
                    <StatusChip status="deprecated" count={undefined} />
                  ) : (
                    <Typography sx={{ color: "#9aa2b1", fontSize: "13px" }}>
                      {t("configComparison.table.no")}
                    </Typography>
                  )}
                  {row.deprecated_since && (
                    <Typography
                      sx={{
                        color: "#7b2fd6",
                        fontSize: "12px",
                        marginTop: "4px",
                      }}
                    >
                      {row.deprecated_since}
                    </Typography>
                  )}
                </TableCell>
                {props.showChangeNote && (
                  <TableCell
                    sx={{
                      color: "#596174",
                      fontSize: "13px",
                      maxWidth: 420,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {row.change_note || "-"}
                    {row.change_note_version && row.change_note_url && (
                      <Typography sx={{ marginTop: "6px", fontSize: "12px" }}>
                        <Button
                          component="a"
                          href={row.change_note_url}
                          target="_blank"
                          rel="noreferrer"
                          size="small"
                          endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                          sx={{
                            color: "var(--tiui-palette-secondary)",
                            fontSize: "12px",
                            fontWeight: 700,
                            minWidth: 0,
                            padding: 0,
                            textTransform: "none",
                          }}
                        >
                          {row.change_note_version}
                        </Button>
                      </Typography>
                    )}
                  </TableCell>
                )}
                <TableCell sx={{ color: "#596174", fontSize: "13px" }}>
                  {row.source}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function EmptyComparisonIllustration() {
  return (
    <Box
      aria-hidden
      sx={{
        alignItems: "center",
        display: "flex",
        height: { xs: 220, md: 250 },
        justifyContent: "center",
        minWidth: { xs: "100%", md: 320 },
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 300 240"
        sx={{
          height: { xs: 250, md: 280 },
          width: { xs: 320, md: 350 },
        }}
        role="img"
      >
        <defs>
          <filter
            id="comparison-card-shadow"
            x="-35%"
            y="-25%"
            width="170%"
            height="160%"
          >
            <feDropShadow
              dx="0"
              dy="10"
              floodColor="#1f2430"
              floodOpacity="0.08"
              stdDeviation="12"
            />
          </filter>
        </defs>

        <circle
          cx="150"
          cy="120"
          fill="none"
          r="102"
          stroke="#6f7f99"
          strokeDasharray="4 9"
          strokeLinecap="round"
          strokeWidth="2"
        />
        <path
          d="M268 111V122"
          fill="none"
          stroke="#6f7f99"
          strokeDasharray="3 8"
          strokeWidth="2"
        />
        <path
          d="M30 116V126"
          fill="none"
          stroke="#d8e0ea"
          strokeDasharray="3 8"
          strokeWidth="2"
        />

        <g filter="url(#comparison-card-shadow)">
          <rect
            fill="#fff"
            height="126"
            rx="9"
            stroke="#b8cafa"
            strokeWidth="1.5"
            width="82"
            x="48"
            y="62"
          />
          <path
            d="M57 62H121C125.971 62 130 66.029 130 71V91H48V71C48 66.029 52.029 62 57 62Z"
            fill="#c8d8ff"
          />
          {[0, 1, 2, 3, 4].map((line) => (
            <g key={`left-${line}`} transform={`translate(0 ${line * 18})`}>
              <circle cx="66" cy="109" fill="#6f7a8f" r="3.2" />
              <rect
                fill="#dfe5ee"
                height="5"
                rx="2.5"
                width={line === 4 ? 34 : 42}
                x="82"
                y="106.5"
              />
            </g>
          ))}
        </g>

        <g filter="url(#comparison-card-shadow)">
          <rect
            fill="#fff"
            height="126"
            rx="9"
            stroke="#d7ddd9"
            strokeWidth="1.5"
            width="82"
            x="170"
            y="62"
          />
          <path
            d="M179 62H243C247.971 62 252 66.029 252 71V91H170V71C170 66.029 174.029 62 179 62Z"
            fill="#cfeee1"
          />
          {[0, 1, 2, 3, 4].map((line) => (
            <g key={`right-${line}`} transform={`translate(0 ${line * 18})`}>
              <circle cx="188" cy="109" fill="#6f7a8f" r="3.2" />
              <rect
                fill="#dfe5ee"
                height="5"
                rx="2.5"
                width={line === 4 ? 34 : 42}
                x="204"
                y="106.5"
              />
            </g>
          ))}
        </g>

        <path
          d="M138 113H160"
          fill="none"
          stroke="#2d86ff"
          strokeLinecap="round"
          strokeWidth="2.5"
        />
        <path
          d="M152 105L162 113L152 121"
          fill="none"
          stroke="#2d86ff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
        <path
          d="M162 143H140"
          fill="none"
          stroke="#33bc84"
          strokeLinecap="round"
          strokeWidth="2.5"
        />
        <path
          d="M148 135L138 143L148 151"
          fill="none"
          stroke="#33bc84"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />

        <g fill="none" strokeLinecap="round" strokeWidth="2.5">
          <path d="M265 43V57" stroke="#cbd6e4" />
          <path d="M258 50H272" stroke="#cbd6e4" />
          <path d="M26 167V181" stroke="#50a58d" />
          <path d="M19 174H33" stroke="#50a58d" />
          <path d="M41 45L47 51" stroke="#e8f3ff" />
          <path d="M47 45L41 51" stroke="#e8f3ff" />
          <path d="M35 200V212" stroke="#ffcc74" />
          <path d="M29 206H41" stroke="#ffcc74" />
          <path d="M270 190V202" stroke="#cbd6e4" />
          <path d="M264 196H276" stroke="#cbd6e4" />
        </g>
        <circle
          cx="249"
          cy="220"
          fill="none"
          r="5"
          stroke="#56c493"
          strokeWidth="2.5"
        />
      </Box>
    </Box>
  );
}

function DefaultComparisonState(props: {
  popularComparisons: PopularComparison[];
  onSelectPopularComparison: (comparison: PopularComparison) => void;
  t: (key: string) => string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        borderColor: "#dfe5ef",
        borderRadius: "8px",
        marginBottom: 3,
        padding: { xs: 3, md: 4 },
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={{ xs: 2, md: 5 }}
        alignItems="center"
      >
        <EmptyComparisonIllustration />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              color: "#1f2430",
              fontSize: { xs: "22px", md: "26px" },
              fontWeight: 700,
              marginBottom: 1.5,
            }}
          >
            {props.t("configComparison.defaultState.title")}
          </Typography>
          <Typography sx={{ color: "#596174", marginBottom: 1 }}>
            {props.t("configComparison.defaultState.description")}
          </Typography>
          <Typography sx={{ color: "#596174", marginBottom: 3 }}>
            {props.t("configComparison.defaultState.details")}
          </Typography>
          {props.popularComparisons.length > 0 && (
            <Box
              sx={{
                borderTop: "1px solid #e5eaf2",
                paddingTop: 2,
              }}
            >
              <Typography
                sx={{
                  color: "#1f2430",
                  fontSize: "14px",
                  fontWeight: 700,
                  marginBottom: 1,
                }}
              >
                {props.t("configComparison.defaultState.popularComparisons")}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                {props.popularComparisons.map((comparison) => (
                  <Button
                    key={`${comparison.from}-${comparison.to}`}
                    variant="outlined"
                    onClick={() => props.onSelectPopularComparison(comparison)}
                    sx={{
                      borderColor: "var(--tiui-palette-secondary-light)",
                      color: "var(--tiui-palette-secondary)",
                      fontWeight: 700,
                      minWidth: 0,
                      textTransform: "none",
                      "&:hover": {
                        backgroundColor: "var(--tiui-palette-peacock-50)",
                        borderColor: "var(--tiui-palette-secondary)",
                      },
                    }}
                  >
                    {comparison.from} -&gt; {comparison.to}
                  </Button>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

function ConfigComparisonInfoNote(props: { message: string }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{
        backgroundColor: "var(--tiui-palette-peacock-50)",
        border: "1px solid var(--tiui-palette-secondary-light)",
        borderRadius: "6px",
        color: "#596174",
        marginTop: 2,
        padding: "12px 16px",
      }}
    >
      <InfoOutlinedIcon
        sx={{ color: "var(--tiui-palette-secondary)", fontSize: 18 }}
      />
      <Typography sx={{ fontSize: "14px" }}>{props.message}</Typography>
    </Stack>
  );
}

export default function ConfigComparison() {
  const { t } = useI18next();
  const [dataset, setDataset] = React.useState<Dataset | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = React.useState(0);
  const [fromVersion, setFromVersion] = React.useState("");
  const [toVersion, setToVersion] = React.useState("");
  const [contentType, setContentType] =
    React.useState<ContentTypeId>("system_variables");
  const [filterStatus, setFilterStatus] =
    React.useState<FilterStatus>("changed");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  React.useEffect(() => {
    let isMounted = true;

    setError(null);
    fetchDataset()
      .then((payload) => {
        if (isMounted) {
          setDataset(payload);
        }
      })
      .catch((reason: unknown) => {
        if (isMounted) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [loadAttempt]);

  const orderedVersions = React.useMemo(
    () => (dataset ? sortedVersionsByReleaseDate(dataset.versions) : []),
    [dataset]
  );
  const versionOrder = React.useMemo(
    () => buildVersionOrder(orderedVersions),
    [orderedVersions]
  );

  React.useEffect(() => {
    if (!dataset) {
      return;
    }

    const fromOptions = orderedVersions.slice(0, -1);
    const allVersions = orderedVersions.map((version) => version.version);
    const defaultToVersion =
      orderedVersions[orderedVersions.length - 1]?.version || "";
    setFromVersion((current) =>
      current === "" ||
      fromOptions.some((version) => version.version === current)
        ? current
        : ""
    );
    setToVersion((current) =>
      allVersions.includes(current) ? current : defaultToVersion
    );
    setContentType((current) =>
      dataset.contentTypes.some((item) => item.id === current)
        ? current
        : dataset.contentTypes[0].id
    );
  }, [dataset, orderedVersions]);

  const releaseEventsByItem = React.useMemo(
    () => (dataset ? buildReleaseEventMap(dataset) : null),
    [dataset]
  );

  const fromVersionOptions = React.useMemo(
    () => orderedVersions.slice(0, -1),
    [orderedVersions]
  );
  const toVersionOptions = React.useMemo(
    () =>
      fromVersion
        ? orderedVersions.filter(
            (version) =>
              compareVersionByOrder(
                fromVersion,
                version.version,
                versionOrder
              ) < 0
          )
        : orderedVersions,
    [fromVersion, orderedVersions, versionOrder]
  );

  React.useEffect(() => {
    if (!fromVersion || toVersionOptions.length === 0) {
      return;
    }
    setToVersion((current) =>
      toVersionOptions.some((version) => version.version === current)
        ? current
        : toVersionOptions[toVersionOptions.length - 1].version
    );
  }, [fromVersion, toVersionOptions]);

  const popularComparisons = React.useMemo(
    () => buildPopularComparisons(orderedVersions),
    [orderedVersions]
  );

  const comparison = React.useMemo(() => {
    if (!dataset || !releaseEventsByItem || !fromVersion || !toVersion) {
      return null;
    }
    if (compareVersionByOrder(fromVersion, toVersion, versionOrder) >= 0) {
      return null;
    }
    return compare(
      dataset,
      releaseEventsByItem,
      fromVersion,
      toVersion,
      contentType
    );
  }, [
    dataset,
    releaseEventsByItem,
    fromVersion,
    toVersion,
    versionOrder,
    contentType,
  ]);

  const filteredRows = React.useMemo(() => {
    if (!comparison) {
      return [];
    }
    return comparison.rows.filter(
      (row) => matchesFilter(row, filterStatus) && matchesSearch(row, search)
    );
  }, [comparison, filterStatus, search]);
  const visibleRows = filteredRows.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );
  const showChangeDetails =
    filterStatus !== "new" && filterStatus !== "removed";
  const showChangeNote = filterStatus !== "new";

  React.useEffect(() => {
    setPage(0);
  }, [fromVersion, toVersion, contentType, filterStatus, search, rowsPerPage]);

  React.useEffect(() => {
    setFilterStatus("changed");
  }, [fromVersion, toVersion, contentType]);

  if (error) {
    return (
      <Paper sx={{ padding: 3, borderRadius: "8px", color: "#d62b2b" }}>
        <Typography sx={{ fontWeight: 700, marginBottom: 1 }}>
          {t("configComparison.loadFailed")}
        </Typography>
        <Typography sx={{ color: "#596174", marginBottom: 2 }}>
          {error}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => {
            setDataset(null);
            setLoadAttempt((current) => current + 1);
          }}
          sx={{ textTransform: "none" }}
        >
          {t("configComparison.retry")}
        </Button>
      </Paper>
    );
  }

  if (!dataset) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", padding: "96px" }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  const hasComparison = !!comparison;
  const summary = comparison?.summary || createEmptySummary();
  const versionLabel = (version: VersionInfo) =>
    `${version.version}${
      version.release_date ? ` (${version.release_date})` : ""
    }`;
  const versionLabelByValue = (value: string) => {
    const version = orderedVersions.find((item) => item.version === value);
    return version ? versionLabel(version) : value;
  };
  const summarySuffix =
    contentType === "system_variables"
      ? t("configComparison.suffix.variables")
      : t("configComparison.suffix.items");
  const searchPlaceholder =
    contentType === "system_variables"
      ? t("configComparison.searchVariablePlaceholder")
      : t("configComparison.searchConfigPlaceholder");
  const handleStatusChange = (status: FilterStatus) => {
    setFilterStatus(status);
    setPage(0);
  };
  const handlePopularComparison = (selectedComparison: PopularComparison) => {
    setFromVersion(selectedComparison.from);
    setToVersion(selectedComparison.to);
    setFilterStatus("changed");
    setSearch("");
    setPage(0);
  };

  return (
    <Box sx={{ padding: { xs: "24px 16px", md: "32px 32px 48px" } }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        spacing={2}
        sx={{ marginBottom: 3 }}
      >
        <Box>
          <Typography
            component="h1"
            sx={{
              color: "var(--tiui-palette-carbon-900)",
              fontSize: "2.5rem",
              fontWeight: 400,
              lineHeight: "3.75rem",
            }}
          >
            {t("configComparison.title")}
          </Typography>
        </Box>
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          backgroundColor: "#fff",
          borderColor: "#dfe5ef",
          borderRadius: "8px",
          marginBottom: 3,
          padding: { xs: 2, md: "20px 24px 24px" },
        }}
      >
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={{ xs: 2, lg: 2.5 }}
          alignItems="stretch"
        >
          <Box
            sx={{
              flex: { lg: "0 0 44%" },
              minWidth: 0,
            }}
          >
            <Typography
              sx={{
                color: "#1f2430",
                fontSize: "16px",
                fontWeight: 700,
                marginBottom: 2,
              }}
            >
              {t("configComparison.selectVersionsAndContent")}
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 1.5, sm: 2 }}
              alignItems={{ xs: "stretch", sm: "flex-end" }}
            >
              <Box sx={{ flex: 1, minWidth: { sm: 0 } }}>
                <Typography
                  sx={{
                    color: "#687083",
                    fontSize: "13px",
                    marginBottom: "6px",
                  }}
                >
                  {t("configComparison.from")}
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    displayEmpty
                    value={fromVersion}
                    renderValue={(selected) =>
                      selected
                        ? versionLabelByValue(String(selected))
                        : t("configComparison.selectSourceVersion")
                    }
                    onChange={(event) => setFromVersion(event.target.value)}
                    sx={{
                      backgroundColor: "#fff",
                      height: "44px",
                      ...(fromVersion ? {} : { color: "#8791a5" }),
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#dbe1ec",
                      },
                      "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#c7d1e0",
                      },
                      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: "var(--tiui-palette-secondary-light)",
                      },
                    }}
                  >
                    <MenuItem value="" disabled>
                      {t("configComparison.selectSourceVersion")}
                    </MenuItem>
                    {fromVersionOptions.map((version) => (
                      <MenuItem value={version.version} key={version.version}>
                        {versionLabel(version)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Typography
                aria-hidden
                sx={{
                  alignItems: "center",
                  color: "#8a94a6",
                  display: { xs: "none", sm: "flex" },
                  height: "44px",
                  justifyContent: "center",
                  width: "32px",
                }}
              >
                <SwapHorizIcon fontSize="small" />
              </Typography>
              <Box sx={{ flex: 1, minWidth: { sm: 0 } }}>
                <Typography
                  sx={{
                    color: "#687083",
                    fontSize: "13px",
                    marginBottom: "6px",
                  }}
                >
                  {t("configComparison.to")}
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={toVersion}
                    renderValue={(selected) =>
                      selected ? versionLabelByValue(String(selected)) : ""
                    }
                    onChange={(event) => setToVersion(event.target.value)}
                    sx={{
                      backgroundColor: "#fff",
                      height: "44px",
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#dbe1ec",
                      },
                      "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#c7d1e0",
                      },
                      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: "var(--tiui-palette-secondary-light)",
                      },
                    }}
                  >
                    {toVersionOptions.map((version) => (
                      <MenuItem value={version.version} key={version.version}>
                        {versionLabel(version)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Stack>
          </Box>
          <Divider
            flexItem
            orientation="vertical"
            sx={{
              borderColor: "#e5eaf2",
              display: { xs: "none", lg: "block" },
            }}
          />
          <Divider
            sx={{
              borderColor: "#e5eaf2",
              display: { xs: "block", lg: "none" },
            }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                justifyContent: { xs: "flex-start", lg: "flex-end" },
              }}
            >
              <Typography
                sx={{
                  color: "#687083",
                  fontSize: "13px",
                  marginBottom: "6px",
                }}
              >
                {t("configComparison.comparisonObject")}
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={contentType}
                onChange={(_, value) => value && setContentType(value)}
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  "& .MuiToggleButtonGroup-grouped": {
                    backgroundColor: "#fff",
                    border: "1px solid #dbe1ec !important",
                    color: "#596174",
                    margin: 0,
                    minHeight: "44px",
                    minWidth: { xs: "50%", sm: "auto" },
                    textTransform: "none",
                    padding: "10px 18px",
                    whiteSpace: "nowrap",
                    "&:hover": {
                      backgroundColor: "var(--tiui-palette-peacock-50)",
                    },
                    "&.Mui-selected": {
                      backgroundColor: "var(--tiui-palette-peacock-100)",
                      borderColor:
                        "var(--tiui-palette-secondary-light) !important",
                      color: "var(--tiui-palette-secondary)",
                      fontWeight: 700,
                      "&:hover": {
                        backgroundColor: "var(--tiui-palette-peacock-200)",
                      },
                    },
                  },
                }}
              >
                {dataset.contentTypes.map((item) => (
                  <ToggleButton value={item.id} key={item.id}>
                    {item.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          </Box>
        </Stack>
      </Paper>

      {hasComparison ? (
        <>
          <SummaryPanel
            summary={summary}
            suffix={summarySuffix}
            activeStatus={filterStatus}
            onStatusChange={handleStatusChange}
          />

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", md: "center" }}
            sx={{ flexWrap: "wrap", marginBottom: 2, rowGap: 2 }}
          >
            <TextField
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              sx={{ width: { xs: "100%", md: 420 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "#8791a5" }} />
                  </InputAdornment>
                ),
              }}
            />
            <SelectFilter
              label={t("configComparison.filters.status")}
              value={filterStatus}
              options={STATUS_FILTER_ORDER}
              onChange={(value) => setFilterStatus(value as FilterStatus)}
              optionLabel={(value) =>
                t(`configComparison.status.${value as FilterStatus}`)
              }
              minWidth={146}
              emptyLabel={t("configComparison.filters.status")}
              emptyValue="changed"
            />
            <Button
              variant="outlined"
              startIcon={<FileDownloadOutlinedIcon />}
              onClick={() =>
                downloadCsv(
                  filteredRows,
                  `${fromVersion}_to_${toVersion}_${contentType}.csv`,
                  t,
                  showChangeNote
                )
              }
              sx={{
                borderRadius: "6px",
                borderColor: "var(--tiui-palette-secondary)",
                color: "var(--tiui-palette-secondary)",
                fontWeight: 700,
                height: "44px",
                marginLeft: { md: "auto !important" },
                textTransform: "none",
                whiteSpace: "nowrap",
                "&:hover": {
                  backgroundColor: "var(--tiui-palette-peacock-50)",
                  borderColor: "var(--tiui-palette-secondary-dark)",
                },
              }}
            >
              {t("configComparison.exportResults")}
            </Button>
          </Stack>

          <ConfigComparisonTable
            rows={visibleRows}
            fromVersion={fromVersion}
            toVersion={toVersion}
            contentType={contentType}
            showChangeDetails={showChangeDetails}
            showChangeNote={showChangeNote}
          />
          <TablePagination
            component="div"
            count={filteredRows.length}
            page={page}
            labelDisplayedRows={({ from, to, count }) =>
              formatTemplate(t("configComparison.pagination"), {
                count: count.toLocaleString(),
                from,
                suffix: summarySuffix,
                to,
              })
            }
            onPageChange={(_, nextPage) => setPage(nextPage)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[10, 25, 50]}
            onRowsPerPageChange={(event) =>
              setRowsPerPage(Number(event.target.value))
            }
          />
        </>
      ) : (
        <DefaultComparisonState
          popularComparisons={popularComparisons}
          onSelectPopularComparison={handlePopularComparison}
          t={t}
        />
      )}
      <ConfigComparisonInfoNote message={t("configComparison.info")} />
    </Box>
  );
}
