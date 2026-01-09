import { API_BASE } from "./config";

/**
 * Converts a file path to a web-accessible URL
 * Strips the monitored directory prefix
 */
export const getWebLink = (filepath: string): string => {
  if (!filepath) return "#";
  // Assuming backend mounts /data/monitored at /agent/files
  // And filepath is like /data/monitored/subdir/file.pdf
  // We need to strip /data/monitored/
  const prefix = "/data/monitored/";
  if (filepath.startsWith(prefix)) {
    const relative = filepath.substring(prefix.length);
    return `${API_BASE}/agent/files/${relative}`;
  }
  // Fallback if path structure is different (e.g. flat) or unknown
  const parts = filepath.split("/");
  return `${API_BASE}/agent/files/${parts[parts.length - 1]}`;
};

/**
 * Extracts just the filename from a full path
 */
export const getFilenameOnly = (filepath: string): string => {
  if (!filepath) return "Unknown";
  const parts = filepath.split("/");
  return parts[parts.length - 1];
};

/**
 * Formats document set names for display
 * Converts to title case and handles special names
 */
export const formatDocumentSetName = (name: string): string => {
  if (!name) return "";
  if (name === "default") return "Default";
  if (name === "all") return "All";
  return name
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

export { API_BASE };
