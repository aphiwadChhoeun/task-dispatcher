"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { assertSameOrigin } from "@/lib/csrf";
import { AppError } from "@/lib/errors";
import { reportError } from "@/lib/observability";
import { config } from "@/config";
import { requirePermission } from "@/features/auth/session";
import { recordAudit } from "@/features/audit/log";
import { getStorage } from "@/features/files/storage";
import { storageKey, validateUpload } from "@/features/files/validation";
import { organizationSettingsSchema } from "./schemas";

export type OrganizationFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

export async function updateOrganizationAction(
  _prev: OrganizationFormState,
  formData: FormData,
): Promise<OrganizationFormState> {
  let newLogoKey: string | null | undefined;
  let saved = false;

  try {
    await assertSameOrigin();
    const session = await requirePermission("org.manage");

    const parsed = organizationSettingsSchema.safeParse({
      brandColor: formData.get("brandColor") || undefined,
      accentColor: formData.get("accentColor") || undefined,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
    }

    const file = formData.get("logo");
    const removeLogo = formData.get("removeLogo") === "on";
    const previousLogoKey = session.organization.logoKey;

    if (file instanceof File && file.size > 0) {
      const validation = await validateUpload(file, config.uploads.photoMimes);
      if (!validation.ok) return { error: validation.error };

      newLogoKey = storageKey(
        session.orgId,
        "organizations",
        session.orgId,
        validation.file.extension,
        "logo",
      );
      await getStorage().put(newLogoKey, await file.arrayBuffer(), {
        contentType: validation.file.mimeType,
        fileName: file.name.slice(0, 200),
      });
    } else if (removeLogo) {
      newLogoKey = null;
    }

    await getDb()
      .update(organizations)
      .set({
        brandColor: parsed.data.brandColor,
        accentColor: parsed.data.accentColor,
        ...(newLogoKey !== undefined ? { logoKey: newLogoKey } : {}),
      })
      .where(eq(organizations.id, session.orgId));
    saved = true;

    if (newLogoKey !== undefined && previousLogoKey && previousLogoKey !== newLogoKey) {
      await getStorage()
        .delete(previousLogoKey)
        .catch((error) => reportError(error, { scope: "organizations.logo.delete" }));
    }

    await recordAudit(getDb(), {
      orgId: session.orgId,
      actorId: session.user.id,
      action: "organization.branding_updated",
      entity: "organization",
      entityId: session.orgId,
      metadata: {
        brandColor: parsed.data.brandColor,
        accentColor: parsed.data.accentColor,
        logoChanged: newLogoKey !== undefined,
      },
    }).catch((error) => reportError(error, { scope: "organizations.update.audit" }));

    // Branding lives in the authenticated layouts, so refresh the whole tree.
    revalidatePath("/", "layout");
    return { success: "Organization branding updated." };
  } catch (error) {
    if (newLogoKey && !saved) {
      await getStorage()
        .delete(newLogoKey)
        .catch((cleanupError) => reportError(cleanupError, { scope: "organizations.logo.cleanup" }));
    }
    if (error instanceof AppError) return { error: error.message };
    reportError(error, { scope: "organizations.update" });
    return { error: "Could not update the organization. Please try again." };
  }
}
