import { FolderOpen, Home, Plus } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router";

import { Button, StudioShell, cn } from "@videogpt/ui";

import { useStudio } from "../studio-context";
import { normalizeKind, projectPath } from "../types";
import { Brand } from "./brand";

/** The community-edition source. Self-hosters run this build; the link takes them to the
 *  repo to read the source, file issues, or contribute. */
const GITHUB_URL = "https://github.com/videogpt-dev/videogpt-ce";

/** GitHub's own logo. lucide ships no brand marks, so it lives here. */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden focusable="false">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.03 11.03 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.38-5.25 5.67.41.35.78 1.05.78 2.12 0 1.53-.01 2.77-.01 3.15 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

function Sidebar() {
  const { projects } = useStudio();
  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Brand />
        <Button asChild size="icon-sm" className="lg:hidden" aria-label="Create">
          <Link to="/create">
            <Plus />
          </Link>
        </Button>
      </div>

      <nav className="hidden grid-cols-2 gap-2 lg:grid">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )
          }
        >
          <Home className="size-4" /> Library
        </NavLink>
        <Button asChild>
          <Link to="/create">
            <Plus /> New
          </Link>
        </Button>
      </nav>

      <div className="hidden min-h-0 flex-1 flex-col gap-2 lg:flex">
        <p className="px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Recent projects
        </p>
        <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
          {projects.slice(0, 12).map((project) => (
            <NavLink
              key={project.id}
              to={projectPath(project)}
              className={({ isActive }) =>
                cn(
                  "flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )
              }
            >
              <FolderOpen className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{project.title}</span>
              <span className="text-[0.625rem] uppercase opacity-60">{normalizeKind(project.kind)}</span>
            </NavLink>
          ))}
          {!projects.length ? (
            <p className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
              Your projects will stay on this machine and appear here.
            </p>
          ) : null}
        </div>
      </div>

      <div className="hidden flex-col gap-2 lg:flex">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-[0.6875rem] text-muted-foreground transition-colors hover:text-foreground"
        >
          <GithubMark className="size-3.5" />
          Source on GitHub
        </a>
        <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
          Local-first. No account required.
        </p>
      </div>
    </div>
  );
}

function Header() {
  const location = useLocation();
  const section = location.pathname.split("/").filter(Boolean)[0];
  const title = section === "clips" ? "Clips" : section === "story" ? "Story" : section === "series" ? "Series" : section === "create" ? "Create" : "Library";

  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">
        Studio
      </Link>
      <span className="text-muted-foreground/50">/</span>
      <span className="truncate font-medium">{title}</span>
    </div>
  );
}

export function AppShell() {
  return (
    <StudioShell
      navigation={<Sidebar />}
      header={<Header />}
      contentClassName="mx-auto w-full max-w-7xl"
      className="min-h-svh"
    >
      <Outlet />
    </StudioShell>
  );
}
