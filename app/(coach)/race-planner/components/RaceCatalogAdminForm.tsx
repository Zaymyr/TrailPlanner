"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { parseGpx } from "../../../../lib/gpx/parseGpx";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";

import type { RacePlannerTranslations } from "../../../../locales/types";

const formSchema = z.object({
  name: z.string().trim().optional(),
  location_text: z.string().trim().optional(),
  trace_id: z.string().trim().optional(),
  external_site_url: z.string().trim().optional(),
  thumbnail_url: z.string().trim().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type RaceCatalogAdminFormProps = {
  accessToken?: string;
  copy: RacePlannerTranslations["raceCatalog"]["admin"];
  onCreated: (message?: string) => void;
  onError: (message?: string) => void;
};

type ParsedPreview = {
  distanceKm: number;
  gainM: number;
  lossM: number;
};

export function RaceCatalogAdminForm({ accessToken, copy, onCreated, onError }: RaceCatalogAdminFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      location_text: "",
      trace_id: "",
      external_site_url: "",
      thumbnail_url: "",
    },
  });

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
    setParseError(null);
    onError();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setGpxFile(file);
    setParseError(null);

    try {
      const content = await file.text();
      const parsed = parseGpx(content);
      setPreview({
        distanceKm: parsed.stats.distanceKm,
        gainM: parsed.stats.gainM,
        lossM: parsed.stats.lossM,
      });
      if (!form.getValues("name") && parsed.name) {
        form.setValue("name", parsed.name, { shouldDirty: true });
      }
    } catch (error) {
      setPreview(null);
      setParseError(copy.errors.invalidGpx);
    }
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    if (!accessToken) {
      onError(copy.errors.authRequired);
      return;
    }

    if (!gpxFile) {
      onError(copy.errors.missingGpx);
      return;
    }

    setIsSubmitting(true);
    onError();

    try {
      const formData = new FormData();
      formData.append("gpx", gpxFile);
      Object.entries(values).forEach(([key, value]) => {
        if (value && value.length > 0) {
          formData.append(key, value);
        }
      });

      const response = await fetch("/api/race-catalog", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? copy.errors.createFailed);
      }

      form.reset();
      setGpxFile(null);
      setPreview(null);
      setIsOpen(false);
      onCreated(copy.messages.created);
    } catch (error) {
      onError(error instanceof Error ? error.message : copy.errors.createFailed);
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{copy.title}</p>
          <p className="text-xs text-muted-foreground">{copy.subtitle}</p>
        </div>
        <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={handleToggle}>
          {isOpen ? copy.close : copy.addAction}
        </Button>
      </div>

      {isOpen ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input className="h-9 text-sm" placeholder={copy.fields.name} {...form.register("name")} />
            <Input className="h-9 text-sm" placeholder={copy.fields.location} {...form.register("location_text")} />
            <Input className="h-9 text-sm" placeholder={copy.fields.traceId} {...form.register("trace_id")} />
            <Input
              className="h-9 text-sm"
              placeholder={copy.fields.externalUrl}
              {...form.register("external_site_url")}
            />
            <Input
              className="h-9 text-sm"
              placeholder={copy.fields.thumbnailUrl}
              {...form.register("thumbnail_url")}
            />
            <Input
              type="file"
              accept=".gpx,application/gpx+xml"
              onChange={handleFileChange}
              className="h-9 text-sm"
            />
          </div>

          {preview ? (
            <p className="text-xs text-muted-foreground">
              {copy.preview}
              <span className="ml-2">{preview.distanceKm.toFixed(1)} km</span>
              <span className="ml-2">D+ {Math.round(preview.gainM)} m</span>
              <span className="ml-2">D- {Math.round(preview.lossM)} m</span>
            </p>
          ) : null}

          {parseError ? <p className="text-xs text-red-500">{parseError}</p> : null}

          <Button type="submit" className="h-9 px-4 text-xs" disabled={isSubmitting}>
            {isSubmitting ? copy.creating : copy.submit}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
