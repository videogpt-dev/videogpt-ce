import { coreUrl } from "../lib/core.server";
import type { Route } from "./+types/core-proxy";

async function proxy({ request }: Route.LoaderArgs | Route.ActionArgs): Promise<Response> {
  const source = new URL(request.url);
  const target = coreUrl(`${source.pathname}${source.search}`);
  const headers = new Headers(request.headers);
  headers.delete("host");

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  try {
    return await fetch(target, init);
  } catch {
    return Response.json({ detail: "The local Core service is unavailable." }, { status: 503 });
  }
}

export function loader(args: Route.LoaderArgs) {
  return proxy(args);
}

export function action(args: Route.ActionArgs) {
  return proxy(args);
}
