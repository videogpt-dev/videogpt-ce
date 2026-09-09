import { FolderOpen, Home, Plus } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router";

import { Button, StudioShell, cn } from "@videogpt/ui";

import { useStudio } from "../studio-context";
import { normalizeKind, projectPath } from "../types";
import { Brand } from "./brand";

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

      <p className="hidden text-[0.6875rem] leading-relaxed text-muted-foreground lg:block">
        Local-first. No account required.
      </p>
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
