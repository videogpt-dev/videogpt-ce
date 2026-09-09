export type ProjectKind = "clips" | "story" | "series";

export type InferenceProvider = {
  provider: string;
  kind: string;
};

export type Artifact = {
  path?: string;
  rel?: string;
  rel_path?: string;
  url?: string;
  file?: string;
  media?: string;
  meta?: Record<string, unknown>;
};

export type Scene = {
  prompt: string;
  narration: string;
  motion?: boolean;
};

export type StoryResult = {
  ok?: boolean;
  error?: string;
  story?: {
    logline?: string;
    style?: string;
    characters?: { name?: string; description?: string }[];
    scenes?: Scene[];
  };
  warnings?: string[];
};

export type Episode = {
  title?: string;
  description?: string;
};

export type SeriesResult = {
  ok?: boolean;
  error?: string;
  episodes?: Episode[];
};

export type RenderResult = {
  ok?: boolean;
  error?: string;
  file?: string;
};

export type Project = {
  id: string;
  title: string;
  kind: string;
  created_at: number;
  source?: string;
  source_url?: string;
  clip_options?: Record<string, unknown>;
  story_brief?: Record<string, unknown>;
  series_brief?: Record<string, unknown>;
  last_result?: {
    status?: string;
    artifacts?: Artifact[];
    error?: string;
  };
  last_story?: StoryResult;
  last_series?: SeriesResult;
  last_render?: RenderResult;
  episode_renders?: Record<string, { title?: string; render?: RenderResult }>;
};

export type Job = {
  id: string;
  project_id: string;
  kind: string;
  status: "running" | "done" | "error";
  phase: string;
  step: number;
  total: number;
  logs: string[];
  error?: string | null;
  created_at?: number;
  finished_at?: number | null;
};

export function normalizeKind(kind: string): ProjectKind {
  if (kind === "clip" || kind === "clips") return "clips";
  if (kind === "series") return "series";
  return "story";
}

export function projectPath(project: Project): string {
  const kind = normalizeKind(project.kind);
  if (kind === "clips") {
    const view = project.last_result ? "results" : project.source ? "settings" : "source";
    return `/clips/${project.id}/${view}`;
  }
  if (kind === "story") {
    const view = project.last_render ? "publish" : project.last_story?.story ? "scenes" : "story";
    return `/story/${project.id}/${view}`;
  }
  return `/series/${project.id}/episodes`;
}
