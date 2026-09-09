import { StoryProjectPage } from "../../src/pages/story-project-page";
import { loadProject } from "../lib/core.server";
import type { Route } from "./+types/story-project";

export function loader({ params }: Route.LoaderArgs) {
  if (!params.projectId) throw new Response("Project not found.", { status: 404 });
  return loadProject(params.projectId);
}

export default function StoryProject({ loaderData }: Route.ComponentProps) {
  return <StoryProjectPage initial={loaderData} />;
}
