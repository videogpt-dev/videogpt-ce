import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { SegmentDefinition } from "@videogpt/ui";

import { api } from "./api";
import type { InferenceProvider, Project, ProjectKind } from "./types";

export type EngineState = "up" | "down" | "checking";

export type StudioSnapshot = {
  engine: EngineState;
  segments: SegmentDefinition[];
  projects: Project[];
  providers: InferenceProvider[];
  bootError: string | null;
};

type StudioContextValue = {
  engine: EngineState;
  segments: SegmentDefinition[];
  projects: Project[];
  providers: InferenceProvider[];
  bootError: string | null;
  refresh: () => Promise<void>;
  refreshProjects: () => Promise<Project[]>;
  createProject: (kind: ProjectKind, title: string) => Promise<Project>;
  removeProject: (id: string) => Promise<void>;
  segment: (kind: ProjectKind) => SegmentDefinition | undefined;
};

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children, initial }: { children: ReactNode; initial?: StudioSnapshot }) {
  const [engine, setEngine] = useState<EngineState>(initial?.engine ?? "checking");
  const [segments, setSegments] = useState<SegmentDefinition[]>(initial?.segments ?? []);
  const [projects, setProjects] = useState<Project[]>(initial?.projects ?? []);
  const [providers, setProviders] = useState<InferenceProvider[]>(initial?.providers ?? []);
  const [bootError, setBootError] = useState<string | null>(initial?.bootError ?? null);

  const refreshProjects = useCallback(async () => {
    const next = await api<Project[]>("/api/projects");
    setProjects(next);
    return next;
  }, []);

  const refresh = useCallback(async () => {
    setEngine("checking");
    setBootError(null);
    try {
      const [health, catalog, providerCatalog] = await Promise.all([
        api<{ status: string }>("/health"),
        api<{ segments?: SegmentDefinition[] }>("/api/engine/segments"),
        api<{ items?: InferenceProvider[] }>("/api/inference/providers?kind=text").catch(
          () => ({ items: [] }),
        ),
      ]);
      setEngine(health.status === "ok" ? "up" : "down");
      setSegments(catalog.segments ?? []);
      setProviders(providerCatalog.items ?? []);
      await refreshProjects();
    } catch (error) {
      setEngine("down");
      setBootError(error instanceof Error ? error.message : "The local services are unavailable.");
      try {
        await refreshProjects();
      } catch {
        setProjects([]);
      }
    }
  }, [refreshProjects]);

  useEffect(() => {
    if (!initial) void refresh();
  }, [initial, refresh]);

  const createProject = useCallback(
    async (kind: ProjectKind, title: string) => {
      const project = await api<Project>("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, title }),
      });
      await refreshProjects();
      return project;
    },
    [refreshProjects],
  );

  const removeProject = useCallback(
    async (id: string) => {
      await api(`/api/projects/${id}`, { method: "DELETE" });
      await refreshProjects();
    },
    [refreshProjects],
  );

  const value = useMemo<StudioContextValue>(
    () => ({
      engine,
      segments,
      projects,
      providers,
      bootError,
      refresh,
      refreshProjects,
      createProject,
      removeProject,
      segment: (kind) => segments.find((item) => item.code_name === kind),
    }),
    [bootError, createProject, engine, projects, providers, refresh, refreshProjects, removeProject, segments],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioContextValue {
  const value = useContext(StudioContext);
  if (!value) throw new Error("useStudio must be used inside StudioProvider");
  return value;
}
