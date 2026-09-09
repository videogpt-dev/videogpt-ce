import type { SegmentDefinition } from "@videogpt/ui";

import type { InferenceProvider, Job, Project } from "../../src/types";

const CORE_URL = (process.env.CORE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export type StudioSnapshot = {
  engine: "up" | "down";
  segments: SegmentDefinition[];
  projects: Project[];
  providers: InferenceProvider[];
  bootError: string | null;
};

export type ProjectSnapshot = {
  project: Project;
  jobs: Job[];
};

export function coreUrl(path: string): URL {
  return new URL(path, `${CORE_URL}/`);
}

export async function coreRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(coreUrl(path), init);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Response(detail || response.statusText, { status: response.status });
  }
  return response.json() as Promise<T>;
}

export async function loadStudio(): Promise<StudioSnapshot> {
  try {
    const [health, catalog, projects, providerCatalog] = await Promise.all([
      coreRequest<{ status: string }>("/health"),
      coreRequest<{ segments?: SegmentDefinition[] }>("/api/engine/segments"),
      coreRequest<Project[]>("/api/projects"),
      coreRequest<{ items?: InferenceProvider[] }>("/api/inference/providers?kind=text").catch(
        () => ({ items: [] }),
      ),
    ]);
    return {
      engine: health.status === "ok" ? "up" : "down",
      segments: catalog.segments ?? [],
      projects,
      providers: providerCatalog.items ?? [],
      bootError: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The local services are unavailable.";
    return { engine: "down", segments: [], projects: [], providers: [], bootError: message };
  }
}

export async function loadProject(projectId: string): Promise<ProjectSnapshot> {
  const [project, jobs] = await Promise.all([
    coreRequest<Project>(`/api/projects/${projectId}`),
    coreRequest<Job[]>(`/api/projects/${projectId}/jobs`),
  ]);
  return { project, jobs };
}
