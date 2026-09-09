import { useState } from "react";
import { ChevronDown, TerminalSquare } from "lucide-react";

import { Button, JobProgress, StatusMessage } from "@videogpt/ui";

import type { Job } from "../types";

export function JobPanel({ job }: { job: Job }) {
  const [logsOpen, setLogsOpen] = useState(false);
  const progress = job.total > 0 ? Math.min(100, (job.step / job.total) * 100) : 0;
  const status = job.status === "done" ? "completed" : job.status === "error" ? "failed" : "running";

  return (
    <div className="grid gap-2">
      <JobProgress
        status={status}
        progress={job.status === "done" ? 100 : progress}
        stage={job.phase || (job.status === "running" ? "Working" : "Done")}
        detail={job.status === "running" ? "You can leave this page. The job continues locally." : job.kind}
      />
      {job.error ? (
        <StatusMessage tone="danger" title="This job failed">
          {job.error}
        </StatusMessage>
      ) : null}
      {job.logs.length ? (
        <div>
          <Button size="sm" variant="ghost" onClick={() => setLogsOpen((open) => !open)}>
            <TerminalSquare />
            {logsOpen ? "Hide technical log" : "Show technical log"}
            <ChevronDown className={logsOpen ? "rotate-180 transition" : "transition"} />
          </Button>
          {logsOpen ? (
            <pre className="mt-2 max-h-52 overflow-auto rounded-lg border bg-black/80 p-3 font-mono text-[0.6875rem] leading-relaxed text-white/75">
              {job.logs.join("\n")}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
