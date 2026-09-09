import { index, layout, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  route("health", "routes/core-proxy.ts", { id: "core-health" }),
  route("api/*", "routes/core-proxy.ts", { id: "core-api" }),
  route("files/*", "routes/core-proxy.ts", { id: "core-files" }),
  layout("routes/shell.tsx", [
    index("routes/library.tsx"),
    route("create", "routes/create.tsx"),
    route("clips/new", "routes/clips-new.tsx"),
    route("clips/:projectId", "routes/clips-redirect.ts"),
    route("clips/:projectId/:view", "routes/clips-project.tsx"),
    route("story/new", "routes/story-new.tsx"),
    route("story/:projectId", "routes/story-redirect.ts"),
    route("story/:projectId/:view", "routes/story-project.tsx"),
    route("series/new", "routes/series-new.tsx"),
    route("series/:projectId", "routes/series-redirect.ts"),
    route("series/:projectId/episodes", "routes/series-project.tsx", { id: "series-episodes" }),
    route("series/:projectId/episodes/:episodeIndex", "routes/series-project.tsx", { id: "series-episode" }),
    route("*", "routes/not-found.tsx"),
  ]),
] satisfies RouteConfig;
