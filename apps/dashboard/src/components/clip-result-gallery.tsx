import { Download } from "lucide-react";

import { Button, ClipLibraryCard, ClipLibraryLayout } from "@videogpt/ui";

import { artifactUrl } from "../api";
import type { Artifact } from "../types";

export function ClipResultGallery({ artifacts }: { artifacts: Artifact[] }) {
  if (!artifacts.length) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <p className="text-sm font-medium">No clips rendered yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the settings above, then start moment discovery.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 border-t pt-5">
      <div>
        <h3 className="font-semibold">Your clips</h3>
        <p className="text-sm text-muted-foreground">
          {artifacts.length} rendered {artifacts.length === 1 ? "clip" : "clips"}
        </p>
      </div>
      <ClipLibraryLayout
        clips={artifacts}
        getKey={(artifact) => String(artifact.meta?.clip_id ?? artifactUrl(artifact) ?? artifact.path)}
        gridClassName="sm:grid-cols-2 xl:grid-cols-3"
        renderClip={(artifact) => {
          const index = artifacts.indexOf(artifact);
          const href = artifactUrl(artifact);
          return (
            <ClipLibraryCard
              clip={{
                id: `Clip ${index + 1}`,
                durationSeconds: 0,
                format: String(artifact.meta?.format ?? "video"),
                rendered: Boolean(href),
                size: artifact.media ?? null,
              }}
              videoSrc={href ?? undefined}
              actions={
                href ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={href} download>
                      <Download /> Download
                    </a>
                  </Button>
                ) : null
              }
            />
          );
        }}
      />
    </div>
  );
}
