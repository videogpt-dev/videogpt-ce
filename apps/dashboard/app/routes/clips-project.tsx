import { ClipProjectPage } from "../../src/pages/clip-project-page";
import { loadProject } from "../lib/core.server";
import type { Route } from "./+types/clips-project";

export function loader({ params }: Route.LoaderArgs) {
  if (!params.projectId) throw new Response("Project not found.", { status: 404 });
  return loadProject(params.projectId);
}

export default function ClipsProject({ loaderData }: Route.ComponentProps) {
  return <ClipProjectPage initial={loaderData} />;
}
