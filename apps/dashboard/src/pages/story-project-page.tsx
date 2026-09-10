import { Download, RefreshCw, Sparkles } from "lucide-react";
import { useNavigate, useParams } from "react-router";

import {
  Badge,
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

import { fileUrl } from "../api";
import { JobPanel } from "../components/job-panel";
import { PageError, PageLoading } from "../components/page-state";
import { normalizeKind } from "../types";
import { useProject, type ProjectSnapshot } from "../use-project";

const VALID_VIEWS = new Set<StoryStepKind>(["story", "characters", "scenes", "music", "assemble", "publish"]);

// Community Edition renders local artifacts only; the shared "Publish" step is a local Export
// here (no social publishing), so relabel it while keeping the "publish" kind for routing.
const CE_STORY_STEPS = STORY_STEPS.map((step) =>
  step.kind === "publish" ? { ...step, label: "Export" } : step,
);

export function StoryProjectPage({ initial }: { initial?: ProjectSnapshot }) {
  const { projectId, view = "story" } = useParams();
  const navigate = useNavigate();
  const { project, job, loading, busy, error, startJob } = useProject(projectId, initial);
  const active: StoryStepKind = VALID_VIEWS.has(view as StoryStepKind) ? (view as StoryStepKind) : "story";

  if (loading) return <PageLoading />;
  if (error && !project) return <PageError message={error} />;
  if (!project) return <PageError message="Project not found." />;
  if (normalizeKind(project.kind) !== "story") return <PageError message="This is not a Story project." />;

  const result = project.last_story;
  const story = result?.story;
  const render = project.last_render;
  const renderUrl = fileUrl(render?.file);
  const brief = project.story_brief ?? {};

  function status(kind: StoryStepKind): StoryStepStatus {
    if (kind === active) {
      if (job?.status === "running" && ((kind === "story" && job.kind === "story") || (kind === "assemble" && job.kind === "render"))) return "busy";
      if (job?.status === "error" && ((kind === "story" && job.kind === "story") || (kind === "assemble" && job.kind === "render"))) return "error";
      return "active";
    }
    if (!story) return kind === "story" ? (job?.status === "error" ? "error" : "pending") : "locked";
    if (kind === "story" || kind === "characters" || kind === "scenes") return "done";
    if (kind === "music") return "pending";
    if (kind === "assemble") return render?.file ? "done" : "pending";
    return render?.file ? "pending" : "locked";
  }

  function retryStory() {
    void startJob(`/api/projects/${projectId}/story`, brief);
  }

  let content;
  let title: string;
  let subtitle: string;

  if (active === "story") {
    title = "Story";
    subtitle = story ? "Review the narrative direction before generating media." : "The community screenwriter is drafting your story.";
    content = story ? (
      <div className="grid gap-4">
        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Logline</p>
          <p className="mt-2 text-sm leading-relaxed">{story.logline || "No logline returned."}</p>
        </div>
        {story.style ? (
          <div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Visual direction</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{story.style}</p>
          </div>
        ) : null}
        {(result?.warnings ?? []).map((warning) => <StatusMessage key={warning} tone="warning">{warning}</StatusMessage>)}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={retryStory}><RefreshCw /> Rewrite with the same brief</Button>
        </div>
      </div>
    ) : (
      <div className="grid gap-4">
        {job ? <JobPanel job={job} /> : null}
        {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
        {job?.status === "error" ? <Button className="w-fit" onClick={retryStory}><RefreshCw /> Try again</Button> : null}
      </div>
    );
  } else if (active === "characters") {
    title = "Characters";
    subtitle = "Characters identified by the community screenwriter.";
    content = story ? (
      story.characters?.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {story.characters.map((character, index) => (
            <Card key={`${character.name}-${index}`} className="gap-0 py-0">
              <CardContent className="p-4">
                <p className="font-medium">{character.name || `Character ${index + 1}`}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{character.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : <StatusMessage title="No recurring characters">This story does not require a defined cast.</StatusMessage>
    ) : <StoryLockedNotice description="Write the story before reviewing characters." actionLabel="Go to Story" onAction={() => navigate(`/story/${projectId}/story`)} />;
  } else if (active === "scenes") {
    title = "Scenes";
    subtitle = "Review narration and visual prompts before assembly.";
    content = story ? (
      <StorySceneList
        readOnly
        scenes={(story.scenes ?? []).map((scene) => ({ prompt: scene.prompt ?? "", narration: scene.narration ?? "", motion: scene.motion }))}
        empty={<StatusMessage tone="warning">The screenwriter returned no scenes.</StatusMessage>}
      />
    ) : <StoryLockedNotice description="Write the story before reviewing scenes." actionLabel="Go to Story" onAction={() => navigate(`/story/${projectId}/story`)} />;
  } else if (active === "music") {
    title = "Music";
    subtitle = "Optional soundtrack configuration.";
    content = <StatusMessage title="Music is optional in Community Edition">The current local renderer assembles narration and scene media without a generated soundtrack.</StatusMessage>;
  } else if (active === "assemble") {
    title = "Assemble";
    subtitle = "Generate scene images and narration, then assemble the final video.";
    content = story ? (
      <div className="grid gap-4">
        {job?.kind === "render" ? <JobPanel job={job} /> : null}
        {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
        <MediaCanvas
          src={renderUrl ?? undefined}
          title="Story preview"
          aspect="portrait"
          emptyTitle={busy ? "Rendering your story" : "Ready to render"}
          emptyDescription={busy ? "Scene generation and assembly continue even if you leave this page." : "The local pipeline will generate every scene, narration track, and final video."}
        />
        <div className="flex justify-end">
          <Button disabled={busy} onClick={() => void startJob(`/api/projects/${projectId}/story/render`)}>
            <Sparkles /> {renderUrl ? "Render again" : "Generate video"}
          </Button>
        </div>
      </div>
    ) : <StoryLockedNotice description="Write the story before assembling a video." actionLabel="Go to Story" onAction={() => navigate(`/story/${projectId}/story`)} />;
  } else {
    title = "Export";
    subtitle = "Preview and download the finished local artifact.";
    content = renderUrl ? (
      <div className="grid gap-4">
        <MediaCanvas src={renderUrl} title={project.title} aspect="portrait" />
        <div className="flex flex-wrap justify-end gap-2">
          <Badge variant="outline">Saved locally</Badge>
          <Button asChild><a href={renderUrl} download><Download /> Download video</a></Button>
        </div>
      </div>
    ) : <StoryLockedNotice description="Render the story before exporting it." actionLabel="Go to Assemble" onAction={() => navigate(`/story/${projectId}/assemble`)} />;
  }

  return (
    <StoryWorkspaceLayout
      status={status}
      steps={CE_STORY_STEPS}
      stepNav
      onStepChange={(next) => navigate(`/story/${projectId}/${next}`)}
      title={title}
      subtitle={subtitle}
      progress={job?.status === "running" && active !== "story" && active !== "assemble" ? <JobPanel job={job} /> : undefined}
      header={
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{project.title}</p>
            <p className="text-xs text-muted-foreground">Local story project</p>
          </div>
          <Badge variant="outline">{story?.scenes?.length ?? 0} scenes</Badge>
        </div>
      }
    >
      {content}
    </StoryWorkspaceLayout>
  );
}
