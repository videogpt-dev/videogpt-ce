import { redirect } from "react-router";

import type { Route } from "./+types/clips-redirect";

export function loader({ params }: Route.LoaderArgs) {
  if (!params.projectId) throw new Response("Project not found.", { status: 404 });
  return redirect(`/clips/${params.projectId}/source`);
}
