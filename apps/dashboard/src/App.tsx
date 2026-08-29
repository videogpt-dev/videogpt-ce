import { useEffect, useRef, useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  SegmentPicker,
  StudioShell,
  type SegmentDefinition,
} from "@videogpt/ui";

const CORE_URL = import.meta.env.VITE_CORE_URL || "http://127.0.0.1:8000";

type Project = {
  id: string;
  title: string;
  kind: string;
  created_at: number;
  source?: string;
  last_result?: { status?: string; artifacts?: Artifact[]; error?: string };
  last_story?: StoryResult;
  last_series?: SeriesResult;
};
type Artifact = Record<string, unknown>;
type Scene = { prompt?: string; narration?: string; motion?: boolean };
type StoryResult = {
  ok?: boolean;
  error?: string;
  story?: { logline?: string; style?: string; characters?: { name?: string; description?: string }[]; scenes?: Scene[] };
  warnings?: string[];
};
type Episode = { title?: string; description?: string };
type SeriesResult = { ok?: boolean; error?: string; episodes?: Episode[] };

function artifactHref(a: Artifact): string | null {
  const rel = (a.rel ?? a.rel_path ?? a.url ?? a.file ?? a.path) as string | undefined;
  if (!rel) return null;
  if (/^https?:/.test(rel)) return rel;
  return `${CORE_URL}/files/${String(rel).replace(/^\/+/, "")}`;
}

export function App() {
  const [engine, setEngine] = useState<"up" | "down" | "checking">("checking");
  const [segments, setSegments] = useState<SegmentDefinition[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<Project | null>(null);
  const [busy, setBusy] = useState<"" | "upload" | "url" | "run" | "story" | "series">("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [description, setDescription] = useState("");
  const [sceneCount, setSceneCount] = useState(8);
  const [premise, setPremise] = useState("");
  const [episodeCount, setEpisodeCount] = useState(6);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadProjects() {
    setProjects(await fetch(`${CORE_URL}/api/projects`).then((r) => r.json()));
  }
  async function refreshSelected(id: string) {
    const p = await fetch(`${CORE_URL}/api/projects/${id}`).then((r) => r.json());
    setSelected(p);
  }

  async function boot() {
    try {
      const health = await fetch(`${CORE_URL}/health`).then((r) => r.json());
      setEngine(health.status === "ok" ? "up" : "down");
      const cat = await fetch(`${CORE_URL}/api/engine/segments`).then((r) => r.json());
      setSegments(cat.segments ?? []);
      await loadProjects();
    } catch {
      setEngine("down");
    }
  }
  useEffect(() => {
    boot();
  }, []);

  async function create(kind: string, name: string) {
    if (!name.trim()) return;
    const p = await fetch(`${CORE_URL}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: name, kind }),
    }).then((r) => r.json());
    setTitle("");
    await loadProjects();
    setSelected(p);
  }

  async function remove(id: string) {
    await fetch(`${CORE_URL}/api/projects/${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    loadProjects();
  }

  async function upload(file: File) {
    if (!selected) return;
    setBusy("upload");
    const body = new FormData();
    body.append("file", file);
    await fetch(`${CORE_URL}/api/projects/${selected.id}/source`, { method: "POST", body });
    await refreshSelected(selected.id);
    setBusy("");
  }

  async function fetchUrl() {
    if (!selected || !sourceUrl.trim()) return;
    setBusy("url");
    try {
      const r = await fetch(`${CORE_URL}/api/projects/${selected.id}/source-url`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: sourceUrl.trim() }),
      });
      if (!r.ok) alert(`Download failed: ${(await r.json()).detail ?? r.status}`);
      else setSourceUrl("");
    } finally {
      await refreshSelected(selected.id);
      setBusy("");
    }
  }

  async function runClips() {
    if (!selected) return;
    setBusy("run");
    try {
      await fetch(`${CORE_URL}/api/projects/${selected.id}/clips`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
    } finally {
      await refreshSelected(selected.id);
      setBusy("");
    }
  }

  async function writeStory() {
    if (!selected) return;
    setBusy("story");
    try {
      const r = await fetch(`${CORE_URL}/api/projects/${selected.id}/story`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description, scene_count: sceneCount }),
      });
      if (!r.ok) alert(`Story failed: ${(await r.json()).detail ?? r.status}`);
    } finally {
      await refreshSelected(selected.id);
      setBusy("");
    }
  }

  async function planSeries() {
    if (!selected) return;
    setBusy("series");
    try {
      const r = await fetch(`${CORE_URL}/api/projects/${selected.id}/series`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ premise, count: episodeCount }),
      });
      if (!r.ok) alert(`Series failed: ${(await r.json()).detail ?? r.status}`);
    } finally {
      await refreshSelected(selected.id);
      setBusy("");
    }
  }

  const kind = (selected?.kind ?? "").toLowerCase();
  const isStory = kind === "story";
  const isSeries = kind === "series";
  const isClips = !isStory && !isSeries;
  const result = selected?.last_result;
  const artifacts = result?.artifacts ?? [];
  const story = selected?.last_story;
  const series = selected?.last_series;

  return (
    <StudioShell
      navigation={
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold">videogpt</p>
            <p className="text-muted-foreground text-xs">self-hosted</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Projects
            </p>
            {projects.length === 0 && <p className="text-muted-foreground text-xs">None yet.</p>}
            {projects.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer p-0 ${selected?.id === p.id ? "ring-2 ring-ring" : ""}`}
                onClick={() => refreshSelected(p.id)}
              >
                <CardContent className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{p.title}</p>
                    <p className="text-muted-foreground text-xs">{p.kind}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(p.id);
                    }}
                  >
                    Delete
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      }
      header={
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold">Studio</h1>
          <Badge variant={engine === "up" ? "default" : "destructive"}>engine {engine}</Badge>
        </div>
      }
      inspector={
        selected ? (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold">{selected.title}</p>
              <p className="text-muted-foreground text-xs">{selected.kind}</p>
            </div>

            {isClips && (
            <>
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground text-xs font-medium uppercase">Source</p>
              {selected.source ? (
                <p className="truncate text-xs">{selected.source}</p>
              ) : (
                <p className="text-muted-foreground text-xs">No video uploaded.</p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== ""}
                onClick={() => fileRef.current?.click()}
              >
                {busy === "upload" ? "Uploading..." : selected.source ? "Replace video" : "Upload video"}
              </Button>

              <p className="text-muted-foreground text-xs">or paste a video URL (YouTube, etc.)</p>
              <div className="flex gap-2">
                <Input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  onKeyDown={(e) => e.key === "Enter" && fetchUrl()}
                />
                <Button size="sm" variant="outline" disabled={busy !== ""} onClick={fetchUrl}>
                  {busy === "url" ? "Fetching..." : "Fetch"}
                </Button>
              </div>
            </div>

            <Button disabled={!selected.source || busy !== ""} onClick={runClips}>
              {busy === "run" ? "Running clips..." : "Run clips"}
            </Button>

            {result && (
              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  Result: {result.status || "done"}
                </p>
                {result.error && <p className="text-destructive text-xs">{result.error}</p>}
                {artifacts.map((a, i) => {
                  const href = artifactHref(a);
                  return (
                    <Card key={i} className="p-0">
                      <CardContent className="flex flex-col gap-1 p-2 text-xs">
                        {href ? (
                          <>
                            <video src={href} controls className="w-full rounded" />
                            <a className="underline" href={href} target="_blank" rel="noreferrer">
                              clip {i + 1}
                            </a>
                          </>
                        ) : (
                          <pre className="overflow-x-auto">{JSON.stringify(a)}</pre>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                {artifacts.length === 0 && !result.error && (
                  <p className="text-muted-foreground text-xs">No artifacts.</p>
                )}
              </div>
            )}
            </>
            )}

            {isStory && (
              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground text-xs font-medium uppercase">Story</p>
                <textarea
                  className="border-input bg-background min-h-20 rounded-md border p-2 text-xs"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the idea to turn into a narrated video..."
                />
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">Scenes</span>
                  <Input
                    type="number"
                    min={1}
                    max={64}
                    value={sceneCount}
                    onChange={(e) => setSceneCount(Number(e.target.value) || 8)}
                    className="w-20"
                  />
                </div>
                <Button disabled={busy !== ""} onClick={writeStory}>
                  {busy === "story" ? "Writing..." : "Write story"}
                </Button>
                {story && story.error && <p className="text-destructive text-xs">{story.error}</p>}
                {story?.story && (
                  <div className="flex flex-col gap-2">
                    {story.story.logline && (
                      <p className="text-xs">
                        <span className="font-semibold">Logline. </span>
                        {story.story.logline}
                      </p>
                    )}
                    {story.story.style && (
                      <p className="text-muted-foreground text-xs">{story.story.style}</p>
                    )}
                    {(story.story.scenes ?? []).map((s, i) => (
                      <Card key={i} className="p-0">
                        <CardContent className="flex flex-col gap-1 p-2 text-xs">
                          <p className="font-medium">Scene {i + 1}</p>
                          <p>{s.prompt}</p>
                          {s.narration && (
                            <p className="text-muted-foreground italic">&ldquo;{s.narration}&rdquo;</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    {(story.warnings ?? []).map((w, i) => (
                      <p key={i} className="text-muted-foreground text-xs">
                        {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isSeries && (
              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground text-xs font-medium uppercase">Series</p>
                <textarea
                  className="border-input bg-background min-h-20 rounded-md border p-2 text-xs"
                  value={premise}
                  onChange={(e) => setPremise(e.target.value)}
                  placeholder="Describe the premise of the show..."
                />
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">Episodes</span>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={episodeCount}
                    onChange={(e) => setEpisodeCount(Number(e.target.value) || 6)}
                    className="w-20"
                  />
                </div>
                <Button disabled={busy !== ""} onClick={planSeries}>
                  {busy === "series" ? "Planning..." : "Plan episodes"}
                </Button>
                {series && series.error && (
                  <p className="text-destructive text-xs">{series.error}</p>
                )}
                {(series?.episodes ?? []).map((ep, i) => (
                  <Card key={i} className="p-0">
                    <CardContent className="flex flex-col gap-1 p-2 text-xs">
                      <p className="font-medium">
                        {i + 1}. {ep.title}
                      </p>
                      {ep.description && <p className="text-muted-foreground">{ep.description}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-6 p-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">New project</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Project title"
              onKeyDown={(e) => e.key === "Enter" && create("clip", title)}
            />
            <Button onClick={() => create("clip", title)}>Create</Button>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-muted-foreground mb-3 text-sm font-medium">Start from a segment</h2>
          {segments.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {engine === "up" ? "No segments reported." : "Engine unreachable."}
            </p>
          ) : (
            <SegmentPicker
              segments={segments}
              actionLabel="Start"
              onValueChange={(code, seg) => create(code, title.trim() || seg.name)}
            />
          )}
        </div>
      </div>
    </StudioShell>
  );
}
