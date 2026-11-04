import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnnouncementForm } from "@/features/announcements/components/announcement-form";
import { listAllTaskerRecipients, listAnnouncementsForDispatcher } from "@/features/announcements/queries";
import { requireDispatcher } from "@/features/auth/session";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Broadcasts" };
export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const { user } = await requireDispatcher();
  const db = getDb();
  const [taskers, announcements] = await Promise.all([
    listAllTaskerRecipients(db, user.orgId),
    listAnnouncementsForDispatcher(db, user.orgId),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Broadcasts"
        description="Send a short announcement to all or selected taskers."
      />

      <Card className="stat-sheen">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/[0.07] text-primary ring-1 ring-inset ring-primary/10">
              <Megaphone className="size-3.5" aria-hidden />
            </span>
            New announcement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AnnouncementForm taskers={taskers} />
        </CardContent>
      </Card>

      <section className="space-y-2.5">
        <SectionHeading title="Recent broadcasts" />
        {announcements.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-5 text-sm text-muted-foreground">
            No announcements sent yet.
          </p>
        ) : (
          <div className="space-y-2.5">
            {announcements.map(({ announcement, senderName, recipients }) => (
              <Card key={announcement.id}>
                <CardContent className="p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{announcement.body}</p>
                  <p className="mt-2.5 text-[11px] text-muted-foreground">
                    {senderName ?? "Dispatch"} · {formatDateTime(announcement.createdAt)} ·{" "}
                    {Number(recipients)} recipient{Number(recipients) === 1 ? "" : "s"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
