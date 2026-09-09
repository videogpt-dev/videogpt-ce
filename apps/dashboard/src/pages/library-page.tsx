import { ArrowRight, Clapperboard, Clock3, Film, ListVideo, Plus, Scissors, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@videogpt/ui";

import { useStudio } from "../studio-context";
import { normalizeKind, projectPath, type Project } from "../types";

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp * 1000));
}

function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate();
  const { removeProject } = useStudio();
  const kind = normalizeKind(project.kind);
  const KindIcon = kind === "clips" ? Scissors : kind === "story" ? Clapperboard : ListVideo;
  const hasOutput = Boolean(
    project.last_render?.file ||
      project.last_result?.artifacts?.length ||
      Object.values(project.episode_renders ?? {}).some((item) => item.render?.file),
  );

  async function remove() {
    if (!window.confirm(`Delete “${project.title}” and its project record?`)) return;
    await removeProject(project.id);
  }

  return (
    <Card className="group gap-0 py-0 transition-shadow hover:shadow-md">
      <CardHeader className="gap-3 py-4">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-vui-brand/10 text-vui-brand">
            <KindIcon className="size-4" />
          </span>
          <Badge variant="outline" className="capitalize">
            {kind}
          </Badge>
        </div>
        <div className="min-w-0">
          <CardTitle className="truncate">{project.title}</CardTitle>
          <CardDescription className="mt-1 flex items-center gap-1.5">
            <Clock3 className="size-3" /> {formatDate(project.created_at)}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3 border-t py-3">
        <span className="text-xs text-muted-foreground">
          {hasOutput ? "Output ready" : project.source ? "Source ready" : "Draft"}
        </span>
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" onClick={() => void remove()} aria-label={`Delete ${project.title}`}>
            <Trash2 />
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(projectPath(project))}>
            Open <ArrowRight />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function LibraryPage() {
  const { projects } = useStudio();

  return (
    <div className="grid gap-7">
      <section className="relative overflow-hidden rounded-2xl border bg-card px-5 py-6 sm:px-7">
        <div className="pointer-events-none absolute -top-24 right-0 size-72 rounded-full bg-vui-brand/10 blur-3xl" />
        <div className="relative flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wider text-vui-brand uppercase">Your local studio</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Make videos on your own machine</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Cut long videos into clips, write visual stories, or build a recurring series. Projects and outputs stay in your self-hosted data volume.
            </p>
          </div>
          <Button asChild size="lg">
            <Link to="/create">
              <Plus /> Create something
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Projects</h2>
            <p className="text-sm text-muted-foreground">Continue where you left off.</p>
          </div>
          {projects.length ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/create">
                <Plus /> New project
              </Link>
            </Button>
          ) : null}
        </div>

        {projects.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <Empty className="min-h-72 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Film />
              </EmptyMedia>
              <EmptyTitle>No projects yet</EmptyTitle>
              <EmptyDescription>Choose a workflow and create your first local video project.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link to="/create">
                  <Plus /> Start a project
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </section>
    </div>
  );
}
