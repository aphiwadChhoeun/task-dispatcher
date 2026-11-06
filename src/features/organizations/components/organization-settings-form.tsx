"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Building2, ImageUp, RotateCcw, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  updateOrganizationAction,
  type OrganizationFormState,
} from "@/features/organizations/actions";
import {
  DEFAULT_ORGANIZATION_COLORS,
  ORGANIZATION_COLOR_SCHEMES,
  organizationThemeStyle,
} from "@/features/organizations/theme";
import { cn } from "@/lib/utils";

type OrganizationBranding = {
  name: string;
  logoUrl: string | null;
  brandColor: string;
  accentColor: string;
};

export function OrganizationSettingsForm({
  organization,
}: {
  organization: OrganizationBranding;
}) {
  const [state, formAction] = useActionState(
    updateOrganizationAction,
    {} as OrganizationFormState,
  );
  const [brandColor, setBrandColor] = useState(organization.brandColor);
  const [accentColor, setAccentColor] = useState(organization.accentColor);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!state.success) return;
    setPreviewUrl(null);
    setSelectedFileName(null);
    setRemoveLogo(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [state.success]);

  const logoSrc = previewUrl ?? (removeLogo ? null : organization.logoUrl);
  const themeStyle = organizationThemeStyle({ brandColor, accentColor });

  const chooseLogo = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setPreviewUrl(null);
      setSelectedFileName(null);
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    setSelectedFileName(file.name);
    setRemoveLogo(false);
  };

  const removeCurrentLogo = (checked: boolean) => {
    setRemoveLogo(checked);
    if (!checked) return;
    setPreviewUrl(null);
    setSelectedFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <form action={formAction} style={themeStyle} className="space-y-6">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.success ? <Alert variant="success">{state.success}</Alert> : null}

      <Field
        label="Organization name"
        htmlFor="organization-name"
        hint="The workspace name is set when the organization is created and cannot be changed."
      >
        <Input id="organization-name" value={organization.name} disabled readOnly />
      </Field>

      <div className="space-y-3 border-t border-border/70 pt-5">
        <div>
          <p className="text-sm font-semibold">Logo</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Used in the navigation on dispatcher and tasker screens.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <span className="brand-mark flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-primary-foreground">
            {logoSrc ? (
              <img src={logoSrc} alt="" className="size-full object-contain p-1.5" />
            ) : (
              <Building2 className="size-6" aria-hidden />
            )}
          </span>
          <div className="min-w-0 space-y-2">
            <label
              htmlFor="organization-logo"
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-dashed border-input/80 bg-muted/35 px-3 text-sm font-medium transition-colors hover:bg-muted/70"
            >
              <ImageUp className="size-4" aria-hidden />
              {selectedFileName
                ? "Choose a different logo"
                : organization.logoUrl
                  ? "Replace logo"
                  : "Upload logo"}
              <input
                ref={fileInputRef}
                id="organization-logo"
                type="file"
                name="logo"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={chooseLogo}
              />
            </label>
            {selectedFileName ? (
              <p className="max-w-56 truncate text-xs text-muted-foreground">{selectedFileName}</p>
            ) : null}
            {organization.logoUrl ? (
              <label className="flex w-fit cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
                <input
                  type="checkbox"
                  name="removeLogo"
                  checked={removeLogo}
                  onChange={(event) => removeCurrentLogo(event.target.checked)}
                  className="size-4 rounded border-input text-primary focus:ring-primary"
                />
                <Trash2 className="size-3.5" aria-hidden />
                Remove current logo
              </label>
            ) : null}
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          PNG, JPG, or WebP up to 8 MB. Square artwork works best.
        </p>
      </div>

      <div className="space-y-3 border-t border-border/70 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Color scheme</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Applied to buttons, links, focus states, and the navigation shell.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setBrandColor(DEFAULT_ORGANIZATION_COLORS.brandColor);
              setAccentColor(DEFAULT_ORGANIZATION_COLORS.accentColor);
            }}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Reset
          </Button>
        </div>

        <div
          role="group"
          aria-label="Color scheme presets"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {ORGANIZATION_COLOR_SCHEMES.map((scheme) => {
            const selected =
              scheme.brandColor === brandColor && scheme.accentColor === accentColor;
            return (
              <button
                key={scheme.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setBrandColor(scheme.brandColor);
                  setAccentColor(scheme.accentColor);
                }}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition-colors",
                  selected
                    ? "border-primary/40 bg-primary/[0.055] ring-1 ring-inset ring-primary/10"
                    : "border-border/80 bg-card hover:border-primary/25 hover:bg-muted/40",
                )}
              >
                <span className="flex shrink-0 -space-x-1.5" aria-hidden>
                  <span
                    className="size-5 rounded-full ring-2 ring-card"
                    style={{ background: scheme.brandColor }}
                  />
                  <span
                    className="size-5 rounded-full ring-2 ring-card"
                    style={{ background: scheme.accentColor }}
                  />
                </span>
                {scheme.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Brand color"
            htmlFor="brand-color"
            hint="Primary buttons, links, and active navigation."
          >
            <div className="flex items-center gap-2">
              <Input
                id="brand-color"
                name="brandColor"
                type="color"
                value={brandColor}
                onChange={(event) => setBrandColor(event.target.value)}
                className="color-swatch h-11 w-16 shrink-0 p-1"
              />
              <span className="font-mono text-xs uppercase text-muted-foreground">{brandColor}</span>
            </div>
          </Field>
          <Field
            label="Accent color"
            htmlFor="accent-color"
            hint="Status highlights and small brand details."
          >
            <div className="flex items-center gap-2">
              <Input
                id="accent-color"
                name="accentColor"
                type="color"
                value={accentColor}
                onChange={(event) => setAccentColor(event.target.value)}
                className="color-swatch h-11 w-16 shrink-0 p-1"
              />
              <span className="font-mono text-xs uppercase text-muted-foreground">
                {accentColor}
              </span>
            </div>
          </Field>
        </div>
      </div>

      <div className="rounded-2xl border border-border/85 bg-card p-4 shadow-card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Live preview
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span className="brand-mark flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-primary-foreground">
            {logoSrc ? (
              <img src={logoSrc} alt="" className="size-full object-contain p-1" />
            ) : (
              <Building2 className="size-4" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Task Dispatcher</p>
            <p className="truncate text-[11px] text-muted-foreground">{organization.name}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            Primary
          </span>
          <span className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
            Accent
          </span>
          <span className="rounded-lg border border-primary/20 bg-primary/[0.07] px-3 py-1.5 text-xs font-semibold text-primary">
            Tint
          </span>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border/70 pt-4 sm:flex-row sm:justify-end">
        <SubmitButton pendingLabel="Saving…">Save organization settings</SubmitButton>
      </div>
    </form>
  );
}
