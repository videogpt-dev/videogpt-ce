import { SeriesProjectPage } from "../../src/pages/series-project-page";
import { loadProject } from "../lib/core.server";
import type { Route } from "./+types/series-project";

export function loader({ params }: Route.LoaderArgs) {
  if (!params.projectId) throw new Response("Project not found.", { status: 404 });
  return loadProject(params.projectId);
}

export default function SeriesProject({ loaderData }: Route.ComponentProps) {
  return <SeriesProjectPage initial={loaderData} />;
}
