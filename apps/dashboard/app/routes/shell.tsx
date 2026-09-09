import { AppShell } from "../../src/components/app-shell";
import { StudioProvider } from "../../src/studio-context";
import { loadStudio } from "../lib/core.server";
import type { Route } from "./+types/shell";

export function loader() {
  return loadStudio();
}

export default function Shell({ loaderData }: Route.ComponentProps) {
  return (
    <StudioProvider initial={loaderData}>
      <AppShell />
    </StudioProvider>
  );
}
