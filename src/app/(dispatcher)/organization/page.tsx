import type { Metadata } from "next";
import { Building2, CheckCircle2, Palette } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requirePermission } from "@/features/auth/session";
import { fileUrl } from "@/features/files/url";
import { OrganizationSettingsForm } from "@/features/organizations/components/organization-settings-form";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Organization" };
export const dynamic = "force-dynamic";

export default async function OrganizationPage() {
  const { organization } = await requirePermission("org.manage");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Workspace"
        title="Organization settings"
        description="Customize how your workspace appears to dispatchers and taskers."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/[0.07] text-primary ring-1 ring-inset ring-primary/10">
                <Palette className="size-3.5" aria-hidden />
              </span>
              Brand identity
            </CardTitle>
            <CardDescription>
              Upload a logo and choose the colors used across the workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationSettingsForm
              organization={{
                name: organization.name,
                logoUrl: organization.logoKey ? fileUrl(organization.logoKey) : null,
                brandColor: organization.brandColor,
                accentColor: organization.accentColor,
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/[0.07] text-primary ring-1 ring-inset ring-primary/10">
                  <Building2 className="size-3.5" aria-hidden />
                </span>
                Workspace details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Organization name
                </p>
                <p className="mt-1 font-medium">{organization.name}</p>
              </div>
              {organization.slug ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Workspace identifier
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {organization.slug}
                  </p>
                </div>
              ) : null}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Created
                </p>
                <p className="mt-1 text-muted-foreground">{formatDate(organization.createdAt)}</p>
              </div>
              <p className="rounded-xl border border-border/80 bg-muted/35 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                Organization names are permanent. Your logo and color scheme update every
                dispatcher and tasker screen in this workspace.
              </p>
            </CardContent>
          </Card>

          <Card className="stat-sheen">
            <CardContent className="space-y-2.5 p-5">
              <p className="text-sm font-semibold">Branding tips</p>
              <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                {[
                  "Use a square or wide logo with a transparent background for the cleanest mark.",
                  "Pick a dark, saturated brand color so white button text stays legible.",
                  "Save changes to refresh the navigation, buttons, and focus states.",
                ].map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
