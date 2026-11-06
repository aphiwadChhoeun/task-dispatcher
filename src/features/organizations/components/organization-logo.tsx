import { MapPinned } from "lucide-react";
import { fileUrl } from "@/features/files/url";
import type { Organization } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export function OrganizationLogo({
  organization,
  className,
  iconClassName,
}: {
  organization: Pick<Organization, "name" | "logoKey">;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      className={cn(
        "brand-mark flex shrink-0 items-center justify-center overflow-hidden rounded-xl text-primary-foreground",
        className,
      )}
    >
      {organization.logoKey ? (
        <img
          src={fileUrl(organization.logoKey)}
          alt={`${organization.name} logo`}
          className="size-full object-contain p-1"
        />
      ) : (
        <MapPinned className={cn("size-5", iconClassName)} aria-hidden />
      )}
    </span>
  );
}
