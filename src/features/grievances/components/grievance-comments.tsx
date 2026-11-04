import { Badge } from "@/components/ui/badge";
import { formatDateTime, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";

type CommentRow = {
  comment: {
    id: string;
    body: string;
    isInternal: boolean;
    createdAt: Date;
    authorId: string;
  };
  authorName: string | null;
  authorRole: string | null;
};

export function GrievanceComments({ comments }: { comments: CommentRow[] }) {
  if (comments.length === 0) {
    return <p className="text-sm text-muted-foreground">No comments yet.</p>;
  }

  return (
    <ol className="space-y-3">
      {comments.map(({ comment, authorName, authorRole }) => {
        const dispatcher = authorRole === "dispatcher" || authorRole === "admin";
        return (
          <li
            key={comment.id}
            className={cn(
              "rounded-xl border p-3.5",
              dispatcher ? "border-primary/15 bg-primary/[0.045]" : "border-border/85 bg-card",
            )}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold">{authorName ?? "Unknown"}</span>
              {authorRole ? <span className="text-muted-foreground">{titleCase(authorRole)}</span> : null}
              {comment.isInternal ? <Badge variant="warning">Internal</Badge> : null}
              <span className="ml-auto text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
          </li>
        );
      })}
    </ol>
  );
}
