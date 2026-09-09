import { Download, RefreshCw, Sparkles } from "lucide-react";
import { Link, useParams } from "react-router";

import {
  Badge,
  Button,
  Card,
  CardContent,
  MediaCanvas,
  SeriesEpisodeList,
  SeriesWorkspaceLayout,
  StatusMessage,
  type SeriesEpisode,
} from "@videogpt/ui";

import { fileUrl } from "../api";
import { JobPanel } from "../components/job-panel";
import { PageError, PageLoading } from "../components/page-state";
import { normalizeKind } from "../types";
import { useProject, type ProjectSnapshot } from "../use-project";

export function SeriesProjectPage({ initial }: { initial?: ProjectSnapshot }) {
  const { projectId, episodeIndex } = useParams();
  const { project, job, loading, busy, error, startJob } = useProject(projectId, initial);

  if (loading) return <PageLoading />;
  if (error && !project) return <PageError message={error} />;
  if (!project) return <PageError message="Project not found." />;
  if (normalizeKind(project.kind) !== "series") return <PageError message="This is not a Series project." />;

  const result = project.last_series;
  const rawEpisodes = result?.episodes ?? [];
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
  const selectedIndex = episodeIndex === undefined ? null : Number(episodeIndex);
  const selected = selectedIndex !== null && Number.isInteger(selectedIndex) ? episodes[selectedIndex] : undefined;
  const selectedRender = selectedIndex === null ? undefined : project.episode_renders?.[String(selectedIndex)]?.render;
  const selectedUrl = fileUrl(selectedRender?.file);
  const brief = project.series_brief ?? {};

  const episodeList = (
    <SeriesEpisodeList
      episodes={episodes}
      description="Open an episode to generate or download its finished video."
      renderLink={(episode, children) => (
        <Link className="block min-w-0" to={`/series/${projectId}/episodes/${episode.id}`}>
          {children}
        </Link>
      )}
      renderActions={(episode) => (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void startJob(`/api/projects/${projectId}/series/episodes/${episode.id}/render`)}
        >
          <Sparkles /> <span className="hidden sm:inline">Generate</span>
        </Button>
      )}
    />
  );

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
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void startJob(`/api/projects/${projectId}/series`, brief)}>
            <RefreshCw /> Replan
          </Button>
        </>
      }
      episodes={
        <div className="grid gap-5">
          {job ? <JobPanel job={job} /> : null}
          {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
          {result?.error ? <StatusMessage tone="danger" title="Series planning failed">{result.error}</StatusMessage> : null}
          {selected ? (
            <Card className="gap-0 py-0">
              <CardContent className="grid gap-4 p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">EPISODE {selectedIndex! + 1}</p>
                    <h2 className="mt-1 text-lg font-semibold">{selected.title}</h2>
                    {selected.description ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{selected.description}</p> : null}
                  </div>
                  <Button asChild size="sm" variant="ghost"><Link to={`/series/${projectId}/episodes`}>Close</Link></Button>
                </div>
                <MediaCanvas
                  src={selectedUrl ?? undefined}
                  title={selected.title}
                  aspect="portrait"
                  emptyTitle={selected.status === "generating" ? "Generating this episode" : "Episode not generated yet"}
                  emptyDescription={selected.status === "generating" ? "Writing, scene generation, narration, and assembly continue locally." : "Generate this episode when you are happy with the plan."}
                />
                <div className="flex flex-wrap justify-end gap-2">
                  {selectedUrl ? <Button asChild variant="outline"><a href={selectedUrl} download><Download /> Download</a></Button> : null}
                  <Button disabled={busy} onClick={() => void startJob(`/api/projects/${projectId}/series/episodes/${selected.id}/render`)}>
                    <Sparkles /> {selectedUrl ? "Generate again" : "Generate episode"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
          {episodeList}
        </div>
      }
      aside={
        <Card className="gap-0 py-0">
          <CardContent className="grid gap-3 p-4">
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Series defaults</p>
              <p className="mt-2 text-sm font-medium">{String(brief.style || "Default visual style")}</p>
            </div>
            <dl className="grid gap-2 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Aspect</dt><dd>{String(brief.aspect_ratio || "9:16")}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Language</dt><dd>{String(brief.language || "Auto")}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Render</dt><dd>{String(brief.engine || "storyboard")}</dd></div>
            </dl>
            <StatusMessage title="Community catalog">Episode ideas use the synced public definitions and your local provider keys.</StatusMessage>
          </CardContent>
        </Card>
      }
    />
  );
}
