"use client";

import Image from "next/image";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { parseGpx } from "../../../lib/gpx/parseGpx";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import type { AdminTranslations } from "../../../locales/types";

const basePillClass = "rounded-full px-3 py-1 text-xs font-semibold";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const raceRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location_text: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  distance_km: z.number(),
  elevation_gain_m: z.number(),
  elevation_loss_m: z.number().nullable().optional(),
  trace_provider: z.string().nullable().optional(),
  trace_id: z.number().nullable().optional(),
  external_site_url: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
  is_live: z.boolean(),
  slug: z.string(),
  created_at: z.string().optional(),
});

type RaceRow = z.infer<typeof raceRowSchema>;

const editFormSchema = z.object({
  name: z.string().trim().min(1),
  location_text: z.string().trim().optional(),
  trace_id: z.string().trim().optional(),
  external_site_url: z.string().trim().optional(),
  thumbnail_url: z.string().trim().optional(),
  is_live: z.boolean(),
});

type EditFormValues = z.infer<typeof editFormSchema>;

const addFormSchema = z.object({
  name: z.string().trim().optional(),
  location_text: z.string().trim().optional(),
  trace_id: z.string().trim().optional(),
  external_site_url: z.string().trim().optional(),
  thumbnail_url: z.string().trim().optional(),
  is_live: z.boolean(),
});

type AddFormValues = z.infer<typeof addFormSchema>;

type ParsedPreview = { distanceKm: number; gainM: number; lossM: number };

type Props = {
  accessToken?: string;
  t: AdminTranslations["raceCatalog"];
};

export default function AdminRaceCatalogSection({ accessToken, t }: Props) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editRace, setEditRace] = useState<RaceRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Add form GPX state
  const [addGpxFile, setAddGpxFile] = useState<File | null>(null);
  const [addGpxPreview, setAddGpxPreview] = useState<ParsedPreview | null>(null);
  const [addGpxError, setAddGpxError] = useState<string | null>(null);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Edit dialog file states
  const [editGpxFile, setEditGpxFile] = useState<File | null>(null);
  const [editGpxPreview, setEditGpxPreview] = useState<ParsedPreview | null>(null);
  const [editGpxError, setEditGpxError] = useState<string | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editImageError, setEditImageError] = useState<string | null>(null);
  const [isUploadingGpx, setIsUploadingGpx] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const racesQuery = useQuery({
    queryKey: ["admin", "race-catalog", accessToken],
    enabled: Boolean(accessToken),
    queryFn: async () => {
      const response = await fetch("/api/admin/race-catalog", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        throw new Error((data as { message?: string } | null)?.message ?? t.loadError);
      }
      const parsed = z.object({ races: z.array(raceRowSchema) }).safeParse(data);
      if (!parsed.success) throw new Error(t.loadError);
      return parsed.data.races;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string } & Partial<EditFormValues>) => {
      const { id, ...fields } = payload;
      const body: Record<string, unknown> = {};
      if (fields.name !== undefined) body.name = fields.name;
      if (fields.location_text !== undefined) body.location_text = fields.location_text || null;
      if (fields.trace_id !== undefined) body.trace_id = fields.trace_id || null;
      if (fields.external_site_url !== undefined) body.external_site_url = fields.external_site_url || null;
      if (fields.thumbnail_url !== undefined) body.thumbnail_url = fields.thumbnail_url || null;
      if (fields.is_live !== undefined) body.is_live = fields.is_live;

      const response = await fetch(`/api/race-catalog/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        throw new Error((data as { message?: string } | null)?.message ?? t.errors.updateFailed);
      }
    },
    onSuccess: () => {
      setMessage(t.messages.updated);
      setError(null);
      setEditRace(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "race-catalog", accessToken] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t.errors.updateFailed);
      setMessage(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/race-catalog/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        throw new Error((data as { message?: string } | null)?.message ?? t.errors.deleteFailed);
      }
    },
    onSuccess: () => {
      setMessage(t.messages.deleted);
      setError(null);
      setDeletingId(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "race-catalog", accessToken] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t.errors.deleteFailed);
      setMessage(null);
      setDeletingId(null);
    },
  });

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
  });

  const addForm = useForm<AddFormValues>({
    resolver: zodResolver(addFormSchema),
    defaultValues: {
      name: "",
      location_text: "",
      trace_id: "",
      external_site_url: "",
      thumbnail_url: "",
      is_live: true,
    },
  });

  const handleOpenEdit = (race: RaceRow) => {
    setEditRace(race);
    editForm.reset({
      name: race.name,
      location_text: race.location_text ?? "",
      trace_id: race.trace_id?.toString() ?? "",
      external_site_url: race.external_site_url ?? "",
      thumbnail_url: race.thumbnail_url ?? "",
      is_live: race.is_live,
    });
    setEditGpxFile(null);
    setEditGpxPreview(null);
    setEditGpxError(null);
    setEditImageFile(null);
    setEditImagePreview(null);
    setEditImageError(null);
    setMessage(null);
    setError(null);
  };

  const handleCloseEdit = () => {
    setEditRace(null);
    setEditGpxFile(null);
    setEditGpxPreview(null);
    setEditGpxError(null);
    setEditImageFile(null);
    setEditImagePreview(null);
    setEditImageError(null);
  };

  // GPX file change for add form
  const handleAddGpxChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAddGpxFile(file);
    setAddGpxError(null);
    try {
      const content = await file.text();
      const parsed = parseGpx(content);
      setAddGpxPreview({ distanceKm: parsed.stats.distanceKm, gainM: parsed.stats.gainM, lossM: parsed.stats.lossM });
      if (!addForm.getValues("name") && parsed.name) {
        addForm.setValue("name", parsed.name, { shouldDirty: true });
      }
    } catch (error) {
      setAddGpxPreview(null);
      setAddGpxError(error instanceof Error ? `${t.errors.invalidGpx} (${error.message})` : t.errors.invalidGpx);
    }
  };

  // GPX file change for edit form
  const handleEditGpxChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setEditGpxFile(file);
    setEditGpxError(null);
    try {
      const content = await file.text();
      const parsed = parseGpx(content);
      setEditGpxPreview({ distanceKm: parsed.stats.distanceKm, gainM: parsed.stats.gainM, lossM: parsed.stats.lossM });
    } catch (error) {
      setEditGpxPreview(null);
      setEditGpxError(error instanceof Error ? `${t.errors.invalidGpx} (${error.message})` : t.errors.invalidGpx);
    }
  };

  // Image file change for edit form
  const handleEditImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setEditImageError(null);

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setEditImageError(t.errors.imageInvalidType);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setEditImageError(t.errors.imageTooLarge);
      return;
    }

    setEditImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setEditImagePreview(objectUrl);
  };

  const handleUploadGpx = async () => {
    if (!editRace || !editGpxFile) return;
    setIsUploadingGpx(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("gpx", editGpxFile);
      const response = await fetch(`/api/race-catalog/${editRace.id}/gpx`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(data?.message ?? t.errors.gpxUploadFailed);
      setMessage(t.messages.updated);
      setEditGpxFile(null);
      setEditGpxPreview(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "race-catalog", accessToken] });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.gpxUploadFailed);
    } finally {
      setIsUploadingGpx(false);
    }
  };

  const handleUploadImage = async () => {
    if (!editRace || !editImageFile) return;
    setIsUploadingImage(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", editImageFile);
      const response = await fetch(`/api/race-catalog/${editRace.id}/thumbnail`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as { message?: string; thumbnail_url?: string } | null;
      if (!response.ok) throw new Error(data?.message ?? t.errors.imageUploadFailed);
      setMessage(t.messages.updated);
      setEditImageFile(null);
      if (editImagePreview) URL.revokeObjectURL(editImagePreview);
      setEditImagePreview(null);
      // Update the local race state so the current thumbnail refreshes
      if (data?.thumbnail_url && editRace) {
        setEditRace({ ...editRace, thumbnail_url: data.thumbnail_url });
      }
      void queryClient.invalidateQueries({ queryKey: ["admin", "race-catalog", accessToken] });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.imageUploadFailed);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleEditSubmit = editForm.handleSubmit((values) => {
    if (!editRace) return;
    updateMutation.mutate({ id: editRace.id, ...values });
  });

  const handleAddSubmit = addForm.handleSubmit(async (values) => {
    if (!addGpxFile) {
      setAddGpxError(t.errors.missingGpx);
      return;
    }
    setIsSubmittingAdd(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("gpx", addGpxFile);
      if (values.name) formData.append("name", values.name);
      if (values.location_text) formData.append("location_text", values.location_text);
      if (values.trace_id) formData.append("trace_id", values.trace_id);
      if (values.external_site_url) formData.append("external_site_url", values.external_site_url);
      if (values.thumbnail_url) formData.append("thumbnail_url", values.thumbnail_url);
      formData.append("is_live", String(values.is_live));

      const response = await fetch("/api/race-catalog", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(data?.message ?? t.errors.createFailed);
      setMessage(t.messages.created);
      setError(null);
      setAddOpen(false);
      addForm.reset();
      setAddGpxFile(null);
      setAddGpxPreview(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "race-catalog", accessToken] });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.createFailed);
    } finally {
      setIsSubmittingAdd(false);
    }
  });

  const handleDelete = (id: string) => {
    if (!window.confirm(t.errors.confirmDelete)) return;
    setDeletingId(id);
    deleteMutation.mutate(id);
  };

  const raceRows = racesQuery.data ?? [];
  const filteredRaces = search
    ? raceRows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    : raceRows;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg text-slate-900 dark:text-slate-50">{t.title}</CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t.description}</p>
          </div>
          <Button
            className="h-9 px-4 text-sm"
            onClick={() => {
              setAddOpen(true);
              setMessage(null);
              setError(null);
            }}
          >
            {t.actions.add}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? <p className="text-sm text-emerald-700 dark:text-emerald-200">{message}</p> : null}
        {error || racesQuery.error ? (
          <p className="text-sm text-red-600 dark:text-red-300">
            {error ?? (racesQuery.error instanceof Error ? racesQuery.error.message : t.loadError)}
          </p>
        ) : null}

        {racesQuery.isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.loading}</p>
        ) : null}

        {!racesQuery.isLoading && raceRows.length > 0 ? (
          <Input
            className="h-9 max-w-xs text-sm"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        ) : null}

        {!racesQuery.isLoading && raceRows.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.empty}</p>
        ) : null}

        {filteredRaces.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-600 dark:text-slate-300">{t.table.name}</TableHead>
                <TableHead className="text-slate-600 dark:text-slate-300">{t.table.location}</TableHead>
                <TableHead className="text-slate-600 dark:text-slate-300">{t.table.distance}</TableHead>
                <TableHead className="text-slate-600 dark:text-slate-300">{t.table.elevation}</TableHead>
                <TableHead className="text-slate-600 dark:text-slate-300">{t.table.status}</TableHead>
                <TableHead className="text-right text-slate-600 dark:text-slate-300">{t.table.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRaces.map((race) => (
                <TableRow key={race.id}>
                  <TableCell className="font-semibold text-slate-900 dark:text-slate-50">
                    <div className="flex items-center gap-2">
                      {race.thumbnail_url ? (
                        <Image
                          src={race.thumbnail_url}
                          alt={race.name}
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded object-cover"
                          unoptimized
                        />
                      ) : null}
                      {race.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-700 dark:text-slate-200">
                    {race.location_text ?? race.location ?? "—"}
                  </TableCell>
                  <TableCell className="text-slate-700 dark:text-slate-200">
                    {race.distance_km.toFixed(1)} km
                  </TableCell>
                  <TableCell className="text-slate-700 dark:text-slate-200">
                    {Math.round(race.elevation_gain_m)} m
                  </TableCell>
                  <TableCell>
                    {race.is_live ? (
                      <span
                        className={`${basePillClass} bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200`}
                      >
                        {t.status.live}
                      </span>
                    ) : (
                      <span
                        className={`${basePillClass} bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200`}
                      >
                        {t.status.draft}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="flex justify-end gap-2">
                    <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => handleOpenEdit(race)}>
                      {t.actions.edit}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      disabled={updateMutation.isPending}
                      onClick={() => updateMutation.mutate({ id: race.id, is_live: !race.is_live })}
                    >
                      {race.is_live ? t.actions.setDraft : t.actions.setLive}
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-8 px-3 text-xs text-red-600 hover:text-red-600"
                      disabled={deleteMutation.isPending && deletingId === race.id}
                      onClick={() => handleDelete(race.id)}
                    >
                      {t.actions.delete}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>

      {/* ── Add dialog ── */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            addForm.reset();
            setAddGpxFile(null);
            setAddGpxPreview(null);
            setAddGpxError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.addTitle}</DialogTitle>
            <DialogDescription>{t.description}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">{t.fields.name}</Label>
                <Input className="h-9 text-sm" {...addForm.register("name")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.fields.location}</Label>
                <Input className="h-9 text-sm" {...addForm.register("location_text")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.fields.traceId}</Label>
                <Input className="h-9 text-sm" {...addForm.register("trace_id")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.fields.externalUrl}</Label>
                <Input className="h-9 text-sm" {...addForm.register("external_site_url")} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">{t.fields.thumbnailUrl}</Label>
                <Input className="h-9 text-sm" placeholder="https://…" {...addForm.register("thumbnail_url")} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">{t.fields.gpxFile}</Label>
                <Input
                  type="file"
                  accept=".gpx,application/gpx+xml"
                  className="h-9 text-sm"
                  onChange={handleAddGpxChange}
                />
                {addGpxPreview ? (
                  <p className="text-xs text-muted-foreground">
                    {t.preview}
                    <span className="ml-2">{addGpxPreview.distanceKm.toFixed(1)} km</span>
                    <span className="ml-2">D+ {Math.round(addGpxPreview.gainM)} m</span>
                    <span className="ml-2">D- {Math.round(addGpxPreview.lossM)} m</span>
                  </p>
                ) : null}
                {addGpxError ? <p className="text-xs text-red-500">{addGpxError}</p> : null}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 bg-white text-emerald-500 dark:border-slate-700 dark:bg-slate-950"
                {...addForm.register("is_live")}
              />
              {t.fields.isLive}
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                {t.actions.cancel}
              </Button>
              <Button type="submit" disabled={isSubmittingAdd}>
                {isSubmittingAdd ? t.creating : t.actions.add}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={editRace !== null} onOpenChange={(open) => { if (!open) handleCloseEdit(); }}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.editTitle}</DialogTitle>
            <DialogDescription>{editRace?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Metadata form */}
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t.fields.name}</Label>
                  <Input className="h-9 text-sm" {...editForm.register("name")} />
                  {editForm.formState.errors.name ? (
                    <p className="text-xs text-red-500">{editForm.formState.errors.name.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t.fields.location}</Label>
                  <Input className="h-9 text-sm" {...editForm.register("location_text")} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t.fields.traceId}</Label>
                  <Input className="h-9 text-sm" {...editForm.register("trace_id")} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t.fields.externalUrl}</Label>
                  <Input className="h-9 text-sm" {...editForm.register("external_site_url")} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">{t.fields.thumbnailUrl}</Label>
                  <Input className="h-9 text-sm" placeholder="https://…" {...editForm.register("thumbnail_url")} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 bg-white text-emerald-500 dark:border-slate-700 dark:bg-slate-950"
                  {...editForm.register("is_live")}
                />
                {t.fields.isLive}
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseEdit}>
                  {t.actions.cancel}
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? t.actions.saving : t.actions.save}
                </Button>
              </div>
            </form>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* GPX replacement */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t.gpxSection}
                {editRace?.gpx_storage_path ? (
                  <span className="ml-2 text-xs font-normal text-emerald-600 dark:text-emerald-400">✓</span>
                ) : null}
              </p>
              <div className="space-y-1">
                <Label className="text-xs">{t.fields.replaceGpx}</Label>
                <Input
                  type="file"
                  accept=".gpx,application/gpx+xml"
                  className="h-9 text-sm"
                  onChange={handleEditGpxChange}
                />
              </div>
              {editGpxPreview ? (
                <p className="text-xs text-muted-foreground">
                  {t.preview}
                  <span className="ml-2">{editGpxPreview.distanceKm.toFixed(1)} km</span>
                  <span className="ml-2">D+ {Math.round(editGpxPreview.gainM)} m</span>
                  <span className="ml-2">D- {Math.round(editGpxPreview.lossM)} m</span>
                </p>
              ) : null}
              {editGpxError ? <p className="text-xs text-red-500">{editGpxError}</p> : null}
              {editGpxFile ? (
                <Button
                  type="button"
                  className="h-8 px-4 text-xs"
                  disabled={isUploadingGpx || Boolean(editGpxError)}
                  onClick={() => void handleUploadGpx()}
                >
                  {isUploadingGpx ? t.uploadingGpx : t.actions.save}
                </Button>
              ) : null}
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* Image replacement */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.imageSection}</p>
              {editRace?.thumbnail_url && !editImagePreview ? (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.currentThumbnail}</p>
                  <Image
                    src={editRace.thumbnail_url}
                    alt={editRace.name}
                    width={120}
                    height={80}
                    className="h-20 w-auto rounded border border-slate-200 object-cover dark:border-slate-700"
                    unoptimized
                  />
                </div>
              ) : null}
              {editImagePreview ? (
                <div className="space-y-1">
                  <Image
                    src={editImagePreview}
                    alt="preview"
                    width={120}
                    height={80}
                    className="h-20 w-auto rounded border border-slate-200 object-cover dark:border-slate-700"
                    unoptimized
                  />
                </div>
              ) : null}
              <div className="space-y-1">
                <Label className="text-xs">{t.fields.replaceImage}</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="h-9 text-sm"
                  onChange={handleEditImageChange}
                />
                <p className="text-xs text-slate-400">JPEG, PNG, WebP, AVIF — max 5 MB</p>
              </div>
              {editImageError ? <p className="text-xs text-red-500">{editImageError}</p> : null}
              {editImageFile && !editImageError ? (
                <Button
                  type="button"
                  className="h-8 px-4 text-xs"
                  disabled={isUploadingImage}
                  onClick={() => void handleUploadImage()}
                >
                  {isUploadingImage ? t.uploadingImage : t.actions.save}
                </Button>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
