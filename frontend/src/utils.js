import { API_BASE } from "./config";

export const getWebLink = (filepath) => {
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

export const getFilenameOnly = (filepath) => {
  if (!filepath) return "Unknown";
  const parts = filepath.split("/");
  return parts[parts.length - 1];
};

export const formatDocumentSetName = (name) => {
  if (!name) return "";
  if (name === "default") return "Default";
  if (name === "all") return "All";
  return name
    .split(/[_\-]/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

export { API_BASE };
