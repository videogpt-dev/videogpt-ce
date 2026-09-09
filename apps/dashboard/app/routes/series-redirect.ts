import { redirect } from "react-router";

import type { Route } from "./+types/series-redirect";

export function loader({ params }: Route.LoaderArgs) {
  if (!params.projectId) throw new Response("Project not found.", { status: 404 });
  return redirect(`/series/${params.projectId}/episodes`);
}
