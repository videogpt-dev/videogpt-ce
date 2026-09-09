import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  type LinksFunction,
  type MetaFunction,
} from "react-router";

import type { Route } from "./+types/root";
import stylesheet from "./app.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  { rel: "icon", href: "/videogpt-icon.svg", type: "image/svg+xml" },
];

export const meta: MetaFunction = () => [
  { title: "VideoGPT Studio" },
  { name: "description", content: "Create videos locally with the VideoGPT engine." },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message = isRouteErrorResponse(error)
    ? typeof error.data === "string"
      ? error.data
      : error.statusText
    : error instanceof Error
      ? error.message
      : "The local Studio could not load.";

  return (
    <main className="grid min-h-svh place-items-center bg-background p-6 text-foreground">
      <section className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-sm">
        <p className="text-sm font-semibold text-muted-foreground">Error {status}</p>
        <h1 className="mt-2 text-xl font-semibold">VideoGPT Studio is unavailable</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
        <a className="mt-5 inline-flex rounded-md border px-3 py-2 text-sm font-medium" href="/">
          Return to Studio
        </a>
      </section>
    </main>
  );
}
