import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Download, RefreshCw, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router";

import {
  Button,
  Card,
  CardContent,
  MediaCanvas,
  StatusMessage,
  StoryLockedNotice,
  StorySceneList,
  StoryWorkspaceLayout,
  STORY_STEPS,
  type StoryStepKind,
  type StoryStepStatus,
} from "@videogpt/ui";

import { api, fileUrl } from "../api";
import { JobPanel } from "./job-panel";
import type { Job, Project } from "../types";

// Community Edition renders local artifacts only, so the shared "Publish" step is a local Export.
const EPISODE_STEPS = STORY_STEPS.map((step) =>
  step.kind === "publish" ? { ...step, label: "Export" } : step,
);
const VALID_VIEWS = new Set<StoryStepKind>(["story", "characters", "scenes", "music", "assemble", "publish"]);

/** An episode runs through the same Story workflow (script, characters, scenes, assemble, export)
 *  as a standalone story, but scoped to the series project's per-episode data and endpoints. */
export function EpisodeWorkspace({
  project,
  projectId,
  index,
  view,
  job,
  busy,
  startJob,
  reload,
}: {
  project: Project;
  projectId: string;
  index: number;
  view?: string;
  job: Job | null;
  busy: boolean;
  startJob: (url: string, body?: unknown) => void;
  reload: () => Promise<unknown>;
}) {
  const navigate = useNavigate();
  const active: StoryStepKind = VALID_VIEWS.has(view as StoryStepKind) ? (view as StoryStepKind) : "story";
  const episode = (project.last_series?.episodes ?? [])[index];
  const story = project.episode_stories?.[String(index)];

  const [styleDraft, setStyleDraft] = useState(story?.style ?? "");
  const [savingStyle, setSavingStyle] = useState(false);
  useEffect(() => {
    setStyleDraft(story?.style ?? "");
  }, [story?.style]);

  async function saveStyle() {
    setSavingStyle(true);
    try {
      await api(`/api/projects/${projectId}/series/episodes/${index}/style`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ style: styleDraft }),
      });
      await reload();
    } finally {
      setSavingStyle(false);
    }
  }
  const render = project.episode_renders?.[String(index)]?.render;
  const renderUrl = fileUrl(render?.file);

  const writeKind = `episode-write:${index}`;
  const renderKind = `episode:${index}`;
  const writing = job?.kind === writeKind && job.status === "running";
  const writeError = job?.kind === writeKind && job.status === "error";
  const rendering = job?.kind === renderKind && job.status === "running";
  const renderError = job?.kind === renderKind && job.status === "error";

  function status(kind: StoryStepKind): StoryStepStatus {
    if (kind === active) {
      if (kind === "story" && writing) return "busy";
      if (kind === "story" && writeError) return "error";
      if (kind === "assemble" && rendering) return "busy";
      if (kind === "assemble" && renderError) return "error";
      return "active";
    }
    if (!story) return kind === "story" ? (writeError ? "error" : "pending") : "locked";
    if (kind === "story" || kind === "characters" || kind === "scenes") return "done";
    if (kind === "music") return "pending";
    if (kind === "assemble") return render?.file ? "done" : "pending";
    return render?.file ? "pending" : "locked";
  }

  const writeEpisode = () => startJob(`/api/projects/${projectId}/series/episodes/${index}/write`);
  const renderEpisode = () => startJob(`/api/projects/${projectId}/series/episodes/${index}/render`);
  const goStory = () => navigate(`/series/${projectId}/episodes/${index}/story`);

  let title: string;
  let subtitle: string;
  let content: ReactNode;

  if (active === "story") {
    title = "Script";
    subtitle = story ? "Review the episode before generating media." : "Write the script for this episode.";
    content = story ? (
      <div className="flex flex-col gap-4">
        {story.logline ? (
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Logline</p>
            <p className="mt-2 text-sm leading-relaxed">{story.logline}</p>
          </div>
        ) : null}
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Visual style</p>
          <p className="mt-1 text-xs text-muted-foreground">Leads every scene's image prompt. Edit it, then regenerate to apply.</p>
          <textarea
            className="mt-2 min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            value={styleDraft}
            onChange={(event) => setStyleDraft(event.target.value)}
            placeholder="e.g. cinematic film still, dramatic lighting, shallow depth of field"
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="outline" disabled={savingStyle || styleDraft === (story.style ?? "")} onClick={() => void saveStyle()}>
              {savingStyle ? "Saving…" : "Save style"}
            </Button>
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" disabled={busy} onClick={writeEpisode}><RefreshCw /> Rewrite script</Button>
        </div>
      </div>
    ) : (
      <div className="flex flex-col gap-4">
        {job?.kind === writeKind ? <JobPanel job={job} /> : null}
        {episode?.description ? (
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Episode premise</p>
            <p className="mt-2 text-sm leading-relaxed">{episode.description}</p>
          </div>
        ) : null}
        <div className="flex justify-end">
          <Button disabled={busy} onClick={writeEpisode}><Sparkles /> {writing ? "Writing…" : "Write script"}</Button>
        </div>
      </div>
    );
  } else if (active === "characters") {
    title = "Characters";
    subtitle = "The cast the screenwriter wrote for this episode.";
    content = story ? (
      story.characters?.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {story.characters.map((character, i) => (
            <Card key={`${character.name}-${i}`} className="gap-0 py-0">
              <CardContent className="p-4">
                <p className="font-medium">{character.name || `Character ${i + 1}`}</p>
                {character.description ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{character.description}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : <StatusMessage title="No recurring characters">This episode does not define a cast.</StatusMessage>
    ) : <StoryLockedNotice description="Write the script before reviewing characters." actionLabel="Go to Script" onAction={goStory} />;
  } else if (active === "scenes") {
    title = "Scenes";
    subtitle = "Narration and visual prompts for each scene.";
    content = story ? (
      <StorySceneList
        readOnly
        scenes={(story.scenes ?? []).map((scene) => ({ prompt: scene.prompt ?? "", narration: scene.narration ?? "", motion: scene.motion }))}
        empty={<StatusMessage tone="warning">This episode returned no scenes.</StatusMessage>}
      />
    ) : <StoryLockedNotice description="Write the script before reviewing scenes." actionLabel="Go to Script" onAction={goStory} />;
  } else if (active === "music") {
    title = "Music";
    subtitle = "Optional soundtrack.";
    content = <StatusMessage title="Music is optional in Community Edition">The local renderer assembles narration and scene media without a generated soundtrack.</StatusMessage>;
  } else if (active === "assemble") {
    title = "Assemble";
    subtitle = "Generate scene media, then assemble the finished episode video.";
    content = story ? (
      <div className="flex flex-col gap-4">
        {job?.kind === renderKind ? <JobPanel job={job} /> : null}
        <MediaCanvas
          src={renderUrl ?? undefined}
          title={episode?.title}
          aspect="portrait"
          emptyTitle={rendering ? "Rendering this episode" : "Ready to render"}
          emptyDescription={rendering ? "Scene generation, narration, and assembly continue locally." : "Generate the video from the script."}
        />
        <div className="flex justify-end">
          <Button disabled={busy} onClick={renderEpisode}><Sparkles /> {renderUrl ? "Render again" : "Generate video"}</Button>
        </div>
      </div>
    ) : <StoryLockedNotice description="Write the script before assembling the video." actionLabel="Go to Script" onAction={goStory} />;
  } else {
    title = "Export";
    subtitle = "Preview and download the finished episode.";
    content = renderUrl ? (
      <div className="flex flex-col gap-4">
        <MediaCanvas src={renderUrl} title={episode?.title} aspect="portrait" />
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild><a href={renderUrl} download><Download /> Download video</a></Button>
        </div>
      </div>
    ) : <StoryLockedNotice description="Render the episode before exporting it." actionLabel="Go to Assemble" onAction={() => navigate(`/series/${projectId}/episodes/${index}/assemble`)} />;
  }

  return (
    <StoryWorkspaceLayout
      status={status}
      steps={EPISODE_STEPS}
      stepNav
      onStepChange={(next) => navigate(`/series/${projectId}/episodes/${index}/${next}`)}
      title={title}
      subtitle={subtitle}
      header={
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{episode?.title || `Episode ${index + 1}`}</p>
            <p className="text-xs text-muted-foreground">{project.title} · Episode {index + 1}</p>
          </div>
          <Button asChild size="sm" variant="ghost"><Link to={`/series/${projectId}/episodes`}><ArrowLeft /> Series</Link></Button>
        </div>
      }
    >
      {content}
    </StoryWorkspaceLayout>
  );
}
