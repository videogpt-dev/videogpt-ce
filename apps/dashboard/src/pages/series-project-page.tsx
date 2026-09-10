import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";

import {
  Badge,
  Button,
  Card,
  CardContent,
  Field,
  FieldLabel,
  Input,
  SeriesEpisodeList,
  SeriesWorkspaceLayout,
  StatusMessage,
  type SeriesEpisode,
} from "@videogpt/ui";

import { api } from "../api";
import { EpisodeWorkspace } from "../components/episode-workspace";
import { JobPanel } from "../components/job-panel";
import { PageError, PageLoading } from "../components/page-state";
import { normalizeKind } from "../types";
import { useProject, type ProjectSnapshot } from "../use-project";

export function SeriesProjectPage({ initial }: { initial?: ProjectSnapshot }) {
  const { projectId, episodeIndex, view } = useParams();
  const navigate = useNavigate();
  const { project, job, loading, busy, error, startJob, reload } = useProject(projectId, initial);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  if (loading) return <PageLoading />;
  if (error && !project) return <PageError message={error} />;
  if (!project) return <PageError message="Project not found." />;
  if (normalizeKind(project.kind) !== "series") return <PageError message="This is not a Series project." />;

  const result = project.last_series;
  const rawEpisodes = result?.episodes ?? [];
  const selectedIndex = episodeIndex === undefined ? null : Number(episodeIndex);

  // A selected episode runs the full Story workflow (script -> characters -> scenes -> assemble).
  if (projectId && selectedIndex !== null && Number.isInteger(selectedIndex) && rawEpisodes[selectedIndex]) {
    return (
      <EpisodeWorkspace
        project={project}
        projectId={projectId}
        index={selectedIndex}
        view={view}
        job={job}
        busy={busy}
        startJob={startJob}
        reload={reload}
      />
    );
  }

  const episodes: SeriesEpisode[] = rawEpisodes.map((episode, index) => ({
    id: String(index),
    title: episode.title || `Episode ${index + 1}`,
    description: episode.description,
    status: project.episode_renders?.[String(index)]?.render?.file
      ? "ready"
      : job?.kind === `episode:${index}` && job.status === "running"
        ? "generating"
        : job?.kind === `episode:${index}` && job.status === "error"
          ? "failed"
          : "draft",
  }));
  const brief = project.series_brief ?? {};

  async function addEpisode() {
    const title = newTitle.trim();
    if (!title) return;
    const res = await api<{ index: number }>(`/api/projects/${projectId}/series/episodes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, description: newDescription.trim() }),
    });
    navigate(`/series/${projectId}/episodes/${res.index}/story`);
  }

  return (
    <SeriesWorkspaceLayout
      className="max-w-6xl"
      header={
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Series project</p>
          <h1 className="mt-1 truncate text-xl font-semibold">{project.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{String(brief.premise ?? "Your locally planned recurring show.")}</p>
        </div>
      }
      headerActions={
        <>
          <Badge variant="outline">{episodes.length} episodes</Badge>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setAdding((open) => !open)}>
            <Plus /> New episode
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void startJob(`/api/projects/${projectId}/series`, brief)}>
            <RefreshCw /> Replan
          </Button>
        </>
      }
      episodes={
        <div className="flex flex-col gap-5">
          {job ? <JobPanel job={job} /> : null}
          {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
          {result?.error ? <StatusMessage tone="danger" title="Series planning failed">{result.error}</StatusMessage> : null}
          {adding ? (
            <Card className="gap-0 py-0">
              <CardContent className="flex flex-col gap-3 p-4">
                <Field>
                  <FieldLabel htmlFor="ep-title">Title</FieldLabel>
                  <Input id="ep-title" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Episode title" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ep-desc">Premise</FieldLabel>
                  <Input id="ep-desc" value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder="What happens in this episode" />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
                  <Button size="sm" disabled={!newTitle.trim()} onClick={() => void addEpisode()}>
                    <Plus /> Add episode
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
          <SeriesEpisodeList
            episodes={episodes}
            description="Open an episode to write its script, review scenes, then generate the video."
            renderLink={(episode, children) => (
              <Link className="block min-w-0" to={`/series/${projectId}/episodes/${episode.id}`}>
                {children}
              </Link>
            )}
          />
        </div>
      }
      aside={
        <Card className="gap-0 py-0">
          <CardContent className="flex flex-col gap-3 p-4">
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Series defaults</p>
              <p className="mt-2 text-sm font-medium">{String(brief.style || "Default visual style")}</p>
            </div>
            <dl className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Episodes</dt><dd>{episodes.length}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Aspect</dt><dd>{String(brief.aspect_ratio || "9:16")}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Language</dt><dd>{String(brief.language || "Auto")}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Render</dt><dd>{String(brief.engine || "storyboard")}</dd></div>
              {brief.resolution ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Resolution</dt><dd>{String(brief.resolution)}</dd></div> : null}
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Mature</dt><dd>{brief.mature ? "Yes" : "No"}</dd></div>
            </dl>
            <StatusMessage title="Community catalog">Episode ideas use the synced public definitions and your local provider keys.</StatusMessage>
          </CardContent>
        </Card>
      }
    />
  );
}
