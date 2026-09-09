import { CircleAlert, LoaderCircle } from "lucide-react";
import { Link } from "react-router";

import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@videogpt/ui";

export function PageLoading({ label = "Loading project" }: { label?: string }) {
  return (
    <div className="grid min-h-72 place-items-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        {label}
      </div>
    </div>
  );
}

export function PageError({ message }: { message: string }) {
  return (
    <Empty className="min-h-72 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleAlert />
        </EmptyMedia>
        <EmptyTitle>Could not open this page</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link to="/">Back to library</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
