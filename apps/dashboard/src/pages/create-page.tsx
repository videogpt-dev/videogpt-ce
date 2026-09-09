import { RotateCw } from "lucide-react";
import { useNavigate } from "react-router";

import { Button, CreateHubLayout, StatusMessage } from "@videogpt/ui";

import { useStudio } from "../studio-context";

export function CreatePage() {
  const navigate = useNavigate();
  const { segments, engine, bootError, refresh } = useStudio();

  return (
    <CreateHubLayout
      segments={segments.filter((segment) => segment.status !== "disabled")}
      title="What do you want to make?"
      description="Choose a workflow. You can change generation settings before anything runs."
      onOpen={(code) => navigate(`/${code}/new`)}
      notice={
        bootError ? (
          <StatusMessage tone="danger" title="The local engine is not ready">
            <span>{bootError}</span>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => void refresh()}>
              <RotateCw /> Retry services
            </Button>
          </StatusMessage>
        ) : null
      }
      empty={
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {engine === "checking" ? "Discovering available workflows..." : "No workflows are available."}
        </div>
      }
    />
  );
}
