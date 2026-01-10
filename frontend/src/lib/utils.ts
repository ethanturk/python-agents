import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { API_BASE } from "@/config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getWebLink(filepath: string): string {
  if (!filepath) return "#";
  const prefix = "/data/monitored/";
  if (filepath.startsWith(prefix)) {
    const relative = filepath.substring(prefix.length);
    return `${API_BASE}/agent/files/${relative}`;
  }
  const parts = filepath.split("/");
  return `${API_BASE}/agent/files/${parts[parts.length - 1]}`;
}

export function getFilenameOnly(filepath: string): string {
  if (!filepath) return "Unknown";
  const parts = filepath.split("/");
  return parts[parts.length - 1];
}

export function formatDocumentSetName(name: string): string {
  if (!name) return "";
  if (name === "default") return "Default";
  if (name === "all") return "All";
  return name
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
