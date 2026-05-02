import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
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
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";

type ContentTypeId =
  | "system_variables"
  | "tidb_config"
  | "tikv_config"
  | "tiflash_config"
  | "pd_config";

type Status = "new" | "removed" | "modified" | "unchanged";
type FilterStatus = Status | "deprecated" | "all";

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
}

interface ComponentConfigRow {
  Type: string;
  Instance: string;
  Name: string;
  Value?: unknown;
}

interface MetadataRow {
  content_type: ContentTypeId;
  component: string;
  item_key: string;
  display_name?: string | null;
  description?: string | null;
  value_type?: string | null;
  variable_scope?: string | null;
  docs_url?: string | null;
  new_since?: string | null;
  deprecated_since?: string | null;
  deprecated_since_versions?: string[];
  removed_since?: string | null;
  replacement?: string | null;
  persists_to_cluster?: string | null;
  applies_to_set_var?: string | null;
  source?: string | null;
}

interface Dataset {
  generatedAt: string;
  versions: VersionInfo[];
  contentTypes: ContentTypeInfo[];
  captures: Record<
    string,
    Record<ContentTypeId, SystemVariableRow[] | ComponentConfigRow[]>
  >;
  metadata: MetadataRow[];
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
  from_value?: unknown;
  to_value?: unknown;
  field_changes: Record<string, { from: unknown; to: unknown }>;
  is_deprecated: boolean;
  new_since?: string | null;
  deprecated_since?: string | null;
  deprecated_since_versions: string[];
  removed_since?: string | null;
  replacement?: string | null;
  persists_to_cluster?: string | null;
  applies_to_set_var?: string | null;
  description?: string | null;
  docs_url?: string | null;
  source: string;
  scope?: string | null;
  instances?: Record<string, unknown>;
}

const DATASET_URL = "/data/config-comparison/dataset.json";

const STATUS_ORDER: FilterStatus[] = [
  "all",
  "new",
  "removed",
  "modified",
  "deprecated",
  "unchanged",
];

const STATUS_LABEL: Record<FilterStatus, string> = {
  all: "All",
  new: "New",
  removed: "Removed",
  modified: "Modified",
  deprecated: "Deprecated",
  unchanged: "Unchanged",
};

const STATUS_TONE: Record<FilterStatus, { fg: string; bg: string }> = {
  all: { fg: "#2f5bff", bg: "#eef3ff" },
  new: { fg: "#0f8f4d", bg: "#e8f6ee" },
  removed: { fg: "#d62b2b", bg: "#fff0f0" },
  modified: { fg: "#d45a00", bg: "#fff4e8" },
  deprecated: { fg: "#7b2fd6", bg: "#f5ecff" },
  unchanged: { fg: "#596174", bg: "#f2f4f8" },
};

const SYSTEM_COMPARE_FIELDS = [
  "VARIABLE_SCOPE",
  "DEFAULT_VALUE",
  "MIN_VALUE",
  "MAX_VALUE",
  "POSSIBLE_VALUES",
  "IS_NOOP",
] as const;

function normalizeValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function displayValue(value: unknown): string {
  const normalized = normalizeValue(value);
  if (normalized === null || normalized === "") {
    return "-";
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(
        ([instance, instanceValue]) =>
          `${instance}=${displayValue(instanceValue)}`
      )
      .join("\n");
  }
  return normalized;
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

function versionGte(version: string, other?: string | null): boolean {
  const left = versionTuple(version);
  const right = versionTuple(other);
  if (!left || !right) {
    return false;
  }
  return (
    left[0] > right[0] ||
    (left[0] === right[0] &&
      (left[1] > right[1] || (left[1] === right[1] && left[2] >= right[2])))
  );
}

function versionSameMinorGte(version: string, other: string): boolean {
  const left = versionTuple(version);
  const right = versionTuple(other);
  if (!left || !right || left[0] !== right[0] || left[1] !== right[1]) {
    return false;
  }
  return left[2] >= right[2];
}

function activeLifecycleSince(
  version: string,
  singleSince?: string | null,
  branchSinceVersions: string[] = []
) {
  if (branchSinceVersions.length > 0) {
    return (
      branchSinceVersions.find((since) =>
        versionSameMinorGte(version, since)
      ) || null
    );
  }
  return singleSince && versionGte(version, singleSince) ? singleSince : null;
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

function metadataKey(contentType: ContentTypeId, itemKey: string) {
  return `${contentType}\u0000${itemKey}`;
}

function buildMetadataMap(dataset: Dataset) {
  const map = new Map<string, MetadataRow>();
  for (const item of dataset.metadata) {
    map.set(metadataKey(item.content_type, item.item_key), item);
  }
  return map;
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
  for (const field of fields) {
    const fromValue = normalizeValue(
      (fromRow as Record<string, unknown>)[field]
    );
    const toValue = normalizeValue((toRow as Record<string, unknown>)[field]);
    if (fromValue !== toValue) {
      changes[field] = {
        from: (fromRow as Record<string, unknown>)[field],
        to: (toRow as Record<string, unknown>)[field],
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

function compare(
  dataset: Dataset,
  fromVersion: string,
  toVersion: string,
  contentType: ContentTypeId
) {
  const spec = dataset.contentTypes.find((item) => item.id === contentType)!;
  const fromRows = loadRows(dataset, fromVersion, contentType);
  const toRows = loadRows(dataset, toVersion, contentType);
  const metadata = buildMetadataMap(dataset);
  const keys = Array.from(
    new Set([...fromRows.keys(), ...toRows.keys()])
  ).sort();
  const rows: ComparisonRow[] = [];
  const summary = {
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
    const meta = metadata.get(metadataKey(contentType, itemKey));
    const compareFields =
      contentType === "system_variables"
        ? SYSTEM_COMPARE_FIELDS
        : (["Value"] as const);
    const changes = fieldChanges(fromRow, toRow, compareFields);
    const status = statusFor(fromRow, toRow, changes);
    const deprecatedSinceVersions = meta?.deprecated_since_versions || [];
    const activeDeprecatedSince = activeLifecycleSince(
      toVersion,
      meta?.deprecated_since,
      deprecatedSinceVersions
    );
    const isDeprecated = !!activeDeprecatedSince;

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
      rows.push({
        status,
        content_type: contentType,
        component: spec.component,
        item_key: itemKey,
        display_name: meta?.display_name || itemKey,
        value_type:
          meta?.value_type ||
          inferValueType(
            fromValue,
            toValue,
            effectiveVariable?.POSSIBLE_VALUES
          ),
        from_value: fromValue,
        to_value: toValue,
        field_changes: changes,
        is_deprecated: isDeprecated,
        new_since: meta?.new_since,
        deprecated_since: activeDeprecatedSince || meta?.deprecated_since,
        deprecated_since_versions: deprecatedSinceVersions,
        removed_since: meta?.removed_since,
        replacement: meta?.replacement,
        persists_to_cluster: meta?.persists_to_cluster,
        applies_to_set_var: meta?.applies_to_set_var,
        description: meta?.description,
        docs_url: meta?.docs_url,
        source: meta?.source || "variables_info",
        scope:
          meta?.variable_scope || effectiveVariable?.VARIABLE_SCOPE || null,
      });
    } else {
      const fromConfig = fromRow as CollapsedConfigRow | undefined;
      const toConfig = toRow as CollapsedConfigRow | undefined;
      const effectiveConfig = effectiveRow as CollapsedConfigRow | undefined;
      rows.push({
        status,
        content_type: contentType,
        component: spec.component,
        item_key: itemKey,
        display_name: meta?.display_name || itemKey,
        value_type:
          meta?.value_type ||
          inferValueType(fromConfig?.Value, toConfig?.Value),
        from_value: fromConfig?.Value,
        to_value: toConfig?.Value,
        field_changes: changes,
        is_deprecated: isDeprecated,
        new_since: meta?.new_since,
        deprecated_since: activeDeprecatedSince || meta?.deprecated_since,
        deprecated_since_versions: deprecatedSinceVersions,
        removed_since: meta?.removed_since,
        replacement: meta?.replacement,
        persists_to_cluster: meta?.persists_to_cluster,
        applies_to_set_var: meta?.applies_to_set_var,
        description: meta?.description,
        docs_url: meta?.docs_url,
        source: meta?.source || "show_config",
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
  return [
    row.item_key,
    row.display_name,
    row.description,
    displayValue(row.from_value),
    displayValue(row.to_value),
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function matchesFilter(row: ComparisonRow, status: FilterStatus) {
  if (status === "all") {
    return true;
  }
  if (status === "deprecated") {
    return row.is_deprecated;
  }
  return row.status === status;
}

function csvEscape(value: unknown) {
  const text = displayValue(value).replace(/\n/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(rows: ComparisonRow[], filename: string) {
  const headers = [
    "status",
    "item_key",
    "scope",
    "value_type",
    "from_value",
    "to_value",
    "is_deprecated",
    "new_since",
    "deprecated_since",
    "replacement",
    "description",
    "docs_url",
  ];
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) =>
          csvEscape((row as unknown as Record<string, unknown>)[header])
        )
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function StatusChip(props: { status: FilterStatus; count?: number }) {
  const tone = STATUS_TONE[props.status];
  return (
    <Chip
      label={`${STATUS_LABEL[props.status]}${
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

function SummaryTile(props: {
  status: FilterStatus;
  value: number;
  suffix: string;
}) {
  const tone = STATUS_TONE[props.status];
  return (
    <Box
      sx={{
        border: "1px solid #e4e8f0",
        borderRadius: "8px",
        minHeight: "84px",
        padding: "14px 16px",
        background: "#fff",
      }}
    >
      <Typography sx={{ color: tone.fg, fontSize: "13px", fontWeight: 700 }}>
        {STATUS_LABEL[props.status]}
      </Typography>
      <Stack
        direction="row"
        alignItems="baseline"
        spacing={1}
        sx={{ marginTop: 1 }}
      >
        <Typography
          sx={{ fontSize: "28px", fontWeight: 700, color: "#1f2430" }}
        >
          {props.value.toLocaleString()}
        </Typography>
        <Typography sx={{ fontSize: "13px", color: "#687083" }}>
          {props.suffix}
        </Typography>
      </Stack>
    </Box>
  );
}

function ConfigComparisonTable(props: {
  rows: ComparisonRow[];
  fromVersion: string;
  toVersion: string;
  contentType: ContentTypeId;
}) {
  if (props.rows.length === 0) {
    return (
      <Box sx={{ padding: "36px", textAlign: "center", color: "#687083" }}>
        No matching items
      </Box>
    );
  }

  return (
    <TableContainer sx={{ border: "1px solid #e4e8f0", borderRadius: "8px" }}>
      <Table size="small" sx={{ minWidth: 1180 }}>
        <TableHead>
          <TableRow>
            <TableCell>Status</TableCell>
            <TableCell>Item</TableCell>
            <TableCell>Scope</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Default ({props.fromVersion})</TableCell>
            <TableCell>Default ({props.toVersion})</TableCell>
            <TableCell>Deprecated</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Source</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {props.rows.map((row) => (
            <TableRow hover key={`${row.content_type}-${row.item_key}`}>
              <TableCell>
                <StatusChip status={row.status} />
              </TableCell>
              <TableCell sx={{ fontFamily: "monospace", fontSize: "13px" }}>
                {row.item_key}
              </TableCell>
              <TableCell
                sx={{ color: "#596174", fontSize: "13px", maxWidth: 160 }}
              >
                {row.scope || "-"}
              </TableCell>
              <TableCell sx={{ color: "#596174", fontSize: "13px" }}>
                {row.value_type || "-"}
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
                  color: row.status === "modified" ? "#d45a00" : "#596174",
                  fontSize: "13px",
                  maxWidth: 220,
                  fontWeight: row.status === "modified" ? 700 : 400,
                }}
              >
                {displayValue(row.to_value)}
              </TableCell>
              <TableCell>
                {row.is_deprecated ? (
                  <StatusChip status="deprecated" count={undefined} />
                ) : (
                  <Typography sx={{ color: "#9aa2b1", fontSize: "13px" }}>
                    No
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
              <TableCell
                sx={{ color: "#596174", fontSize: "13px", maxWidth: 360 }}
              >
                {row.description || row.replacement || "-"}
              </TableCell>
              <TableCell>
                {row.docs_url ? (
                  <Tooltip title="Open docs">
                    <IconButton
                      component="a"
                      href={row.docs_url}
                      target="_blank"
                      rel="noreferrer"
                      size="small"
                      aria-label={`Open docs for ${row.item_key}`}
                    >
                      <OpenInNewIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Typography sx={{ color: "#9aa2b1", fontSize: "13px" }}>
                    -
                  </Typography>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function ConfigComparison() {
  const theme = useTheme();
  const [dataset, setDataset] = React.useState<Dataset | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [fromVersion, setFromVersion] = React.useState("v8.1.2");
  const [toVersion, setToVersion] = React.useState("v8.5.6");
  const [contentType, setContentType] =
    React.useState<ContentTypeId>("system_variables");
  const [filterStatus, setFilterStatus] = React.useState<FilterStatus>("all");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  React.useEffect(() => {
    fetch(DATASET_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ${DATASET_URL}`);
        }
        return response.json();
      })
      .then((payload: Dataset) => {
        setDataset(payload);
        const versions = payload.versions.map((version) => version.version);
        if (!versions.includes(fromVersion)) {
          setFromVersion(versions[0]);
        }
        if (!versions.includes(toVersion)) {
          setToVersion(versions[versions.length - 1]);
        }
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const comparison = React.useMemo(() => {
    if (!dataset) {
      return null;
    }
    return compare(dataset, fromVersion, toVersion, contentType);
  }, [dataset, fromVersion, toVersion, contentType]);

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

  React.useEffect(() => {
    setPage(0);
  }, [fromVersion, toVersion, contentType, filterStatus, search, rowsPerPage]);

  if (error) {
    return (
      <Paper sx={{ padding: 3, borderRadius: "8px", color: "#d62b2b" }}>
        {error}
      </Paper>
    );
  }

  if (!dataset || !comparison) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", padding: "96px" }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  const versions = dataset.versions;
  const summary = comparison.summary;
  const versionLabel = (version: VersionInfo) =>
    `${version.version}${
      version.release_date ? ` (${version.release_date})` : ""
    }`;

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
              color: "#1f2430",
              fontSize: { xs: "32px", md: "44px" },
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            Config Comparison
          </Typography>
          <Typography sx={{ marginTop: 1, color: "#687083", fontSize: "16px" }}>
            Compare TiDB system variables and component configuration across
            selected versions.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<FileDownloadOutlinedIcon />}
          onClick={() =>
            downloadCsv(
              filteredRows,
              `${fromVersion}_to_${toVersion}_${contentType}.csv`
            )
          }
          sx={{
            alignSelf: { xs: "stretch", md: "center" },
            borderRadius: "6px",
          }}
        >
          Export Results
        </Button>
      </Stack>

      <Paper
        variant="outlined"
        sx={{ padding: 2, borderRadius: "8px", marginBottom: 3 }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={5}>
            <Typography sx={{ fontWeight: 700, marginBottom: 1 }}>
              Select Versions
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControl fullWidth size="small">
                <Select
                  value={fromVersion}
                  onChange={(event) => setFromVersion(event.target.value)}
                >
                  {versions.map((version) => (
                    <MenuItem value={version.version} key={version.version}>
                      {versionLabel(version)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Tooltip title="Swap versions">
                <IconButton
                  aria-label="Swap versions"
                  onClick={() => {
                    setFromVersion(toVersion);
                    setToVersion(fromVersion);
                  }}
                >
                  <SwapHorizIcon />
                </IconButton>
              </Tooltip>
              <FormControl fullWidth size="small">
                <Select
                  value={toVersion}
                  onChange={(event) => setToVersion(event.target.value)}
                >
                  {versions.map((version) => (
                    <MenuItem value={version.version} key={version.version}>
                      {versionLabel(version)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Grid>
          <Grid item xs={12} md={7}>
            <Typography sx={{ fontWeight: 700, marginBottom: 1 }}>
              Select Content
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={contentType}
              onChange={(_, value) => value && setContentType(value)}
              sx={{
                flexWrap: "wrap",
                gap: "8px",
                "& .MuiToggleButtonGroup-grouped": {
                  border: "1px solid #dbe1ec !important",
                  borderRadius: "6px !important",
                  margin: 0,
                  textTransform: "none",
                  padding: "8px 14px",
                },
              }}
            >
              {dataset.contentTypes.map((item) => (
                <ToggleButton value={item.id} key={item.id}>
                  {item.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={2} sx={{ marginBottom: 3 }}>
        <Grid item xs={6} md={2}>
          <SummaryTile status="all" value={summary.total} suffix="items" />
        </Grid>
        <Grid item xs={6} md={2}>
          <SummaryTile status="new" value={summary.new} suffix="items" />
        </Grid>
        <Grid item xs={6} md={2}>
          <SummaryTile
            status="removed"
            value={summary.removed}
            suffix="items"
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <SummaryTile
            status="modified"
            value={summary.modified}
            suffix="items"
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <SummaryTile
            status="deprecated"
            value={summary.deprecated}
            suffix="items"
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <SummaryTile
            status="unchanged"
            value={summary.unchanged}
            suffix="items"
          />
        </Grid>
      </Grid>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
        sx={{ marginBottom: 2 }}
      >
        <TextField
          size="small"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by item name, value, or description"
          sx={{ width: { xs: "100%", md: 420 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "#8791a5" }} />
              </InputAdornment>
            ),
          }}
        />
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
          {STATUS_ORDER.map((status) => (
            <Button
              key={status}
              size="small"
              onClick={() => setFilterStatus(status)}
              sx={{
                borderRadius: "6px",
                textTransform: "none",
                color:
                  filterStatus === status
                    ? STATUS_TONE[status].fg
                    : theme.palette.carbon[700],
                backgroundColor:
                  filterStatus === status
                    ? STATUS_TONE[status].bg
                    : "transparent",
              }}
            >
              {STATUS_LABEL[status]}
            </Button>
          ))}
        </Stack>
      </Stack>

      <ConfigComparisonTable
        rows={visibleRows}
        fromVersion={fromVersion}
        toVersion={toVersion}
        contentType={contentType}
      />
      <TablePagination
        component="div"
        count={filteredRows.length}
        page={page}
        onPageChange={(_, nextPage) => setPage(nextPage)}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[10, 25, 50]}
        onRowsPerPageChange={(event) =>
          setRowsPerPage(Number(event.target.value))
        }
      />
    </Box>
  );
}
