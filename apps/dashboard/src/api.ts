import type { Artifact } from "./types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "detail" in payload
        ? String(payload.detail)
        : typeof payload === "string" && payload
          ? payload
          : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export function fileUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:/.test(path)) return path;
  return `/files/${path.replace(/^\/+/, "")}`;
}

export function artifactUrl(artifact: Artifact): string | null {
  return fileUrl(artifact.rel ?? artifact.rel_path ?? artifact.url ?? artifact.file ?? artifact.path);
}
