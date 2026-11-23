"use client";

import Image from "next/image";
import { useEffect, useState, type ChangeEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { Button } from "../../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../../components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import type { AdminTranslations } from "../../../../locales/types";
import {
  editEventFormSchema,
  eventEditDefaults,
  eventPatchBody,
  imageFileProblem,
  type EditEventFormValues,
  type RaceEventRow,
} from "./race-catalog-model";

/**
 * « Modifier l’événement »: name, short name of the reels, place, date, image URL, online state
 * (PATCH `/api/admin/race-events/[id]`) and image upload (PUT `…/thumbnail`). Same requests and
 * messages as before lot 5; messages and errors are shown by the section.
 */
export function EditEventDialog({ accessToken, t, event, onClose, onMessage, onError, onSaved }: {
  accessToken?: string;
  t: AdminTranslations["raceCatalog"];
  event: RaceEventRow | null;
  onClose: () => void;
  onMessage: (message: string) => void;
  onError: (message: string | null, clearMessage?: boolean) => void;
  onSaved: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [editEvent, setEditEvent] = useState<RaceEventRow | null>(event);
  const [editEventImageFile, setEditEventImageFile] = useState<File | null>(null);
  const [editEventImagePreview, setEditEventImagePreview] = useState<string | null>(null);
  const [editEventImageError, setEditEventImageError] = useState<string | null>(null);
  const [isUploadingEventImage, setIsUploadingEventImage] = useState(false);

  const editEventForm = useForm<EditEventFormValues>({
    resolver: zodResolver(editEventFormSchema),
  });

  // Opening on an event resets the form and the image draft (former `handleOpenEditEvent`).
  useEffect(() => {
    setEditEvent(event);
    if (event) editEventForm.reset(eventEditDefaults(event));
    setEditEventImageFile(null);
    setEditEventImagePreview(null);
    setEditEventImageError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  const handleClose = () => {
    if (editEventImagePreview) URL.revokeObjectURL(editEventImagePreview);
    onClose();
  };

  const updateEventMutation = useMutation({
    mutationFn: async (payload: { id: string } & Partial<EditEventFormValues>) => {
      const { id, ...fields } = payload;
      const response = await fetch(`/api/admin/race-events/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(eventPatchBody(fields)),
      });
      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        throw new Error((data as { message?: string } | null)?.message ?? t.errors.updateFailed);
      }
    },
    onSuccess: () => onSaved(t.messages.updated),
    onError: (err) => onError(err instanceof Error ? err.message : t.errors.updateFailed, true),
  });

  const handleEditEventImageChange = (changeEvent: ChangeEvent<HTMLInputElement>) => {
    const file = changeEvent.target.files?.[0];
    if (!file) return;
    setEditEventImageError(null);

    const problem = imageFileProblem(file);
    if (problem) {
      setEditEventImageError(problem === "type" ? t.errors.imageInvalidType : t.errors.imageTooLarge);
      return;
    }

    setEditEventImageFile(file);
    if (editEventImagePreview) URL.revokeObjectURL(editEventImagePreview);
    const objectUrl = URL.createObjectURL(file);
    setEditEventImagePreview(objectUrl);
  };

  const handleUploadEventImage = async () => {
    if (!editEvent || !editEventImageFile) return;
    setIsUploadingEventImage(true);
    onError(null);
    try {
      const formData = new FormData();
      formData.append("image", editEventImageFile);
      const response = await fetch(`/api/admin/race-events/${editEvent.id}/thumbnail`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as { message?: string; thumbnail_url?: string } | null;
      if (!response.ok) throw new Error(data?.message ?? t.errors.imageUploadFailed);
      onMessage(t.messages.updated);
      setEditEventImageFile(null);
      if (editEventImagePreview) URL.revokeObjectURL(editEventImagePreview);
      setEditEventImagePreview(null);
      if (data?.thumbnail_url && editEvent) {
        setEditEvent({ ...editEvent, thumbnail_url: data.thumbnail_url });
        editEventForm.setValue("thumbnail_url", data.thumbnail_url, { shouldDirty: true });
      }
      void queryClient.invalidateQueries({ queryKey: ["admin", "race-catalog", accessToken] });
    } catch (err) {
      onError(err instanceof Error ? err.message : t.errors.imageUploadFailed);
    } finally {
      setIsUploadingEventImage(false);
    }
  };

  const handleEditEventSubmit = editEventForm.handleSubmit((values) => {
    if (!editEvent) return;
    updateEventMutation.mutate({ id: editEvent.id, ...values });
  });

  return (
    <Dialog open={event !== null} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.editEventTitle}</DialogTitle>
          <DialogDescription>{editEvent?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <form onSubmit={handleEditEventSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">{t.fields.name}</Label>
                <Input className="h-9 text-sm" {...editEventForm.register("name")} />
                {editEventForm.formState.errors.name ? (
                  <p className="text-xs text-red-500">{editEventForm.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.fields.location}</Label>
                <Input className="h-9 text-sm" {...editEventForm.register("location")} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Nom court (vidéo)</Label>
                <Input className="h-9 text-sm" maxLength={40} placeholder="Facultatif : sinon déduit du nom" {...editEventForm.register("short_name")} />
                {editEventForm.formState.errors.short_name ? (
                  <p className="text-xs text-red-500">{editEventForm.formState.errors.short_name.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Affiché en ouverture des reels. Sans année ni sponsor, 40 caractères au plus.</p>
                )}
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Date de l’événement</Label>
                <Input type="date" className="h-9 text-sm" {...editEventForm.register("race_date")} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">{t.fields.thumbnailUrl}</Label>
                <Input className="h-9 text-sm" placeholder="https://…" {...editEventForm.register("thumbnail_url")} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 bg-white text-emerald-500 dark:border-slate-700 dark:bg-slate-950"
                {...editEventForm.register("is_live")}
              />
              {t.fields.isLive}
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                {t.actions.cancel}
              </Button>
              <Button type="submit" disabled={updateEventMutation.isPending}>
                {updateEventMutation.isPending ? t.actions.saving : t.actions.save}
              </Button>
            </div>
          </form>

          <hr className="border-slate-200 dark:border-slate-800" />

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Image de l’événement</p>
            {editEvent?.thumbnail_url && !editEventImagePreview ? (
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">Image actuelle de l’événement</p>
                <Image
                  src={editEvent.thumbnail_url}
                  alt={editEvent.name}
                  width={120}
                  height={80}
                  className="h-20 w-auto rounded border border-slate-200 object-cover dark:border-slate-700"
                  unoptimized
                />
              </div>
            ) : null}
            {editEventImagePreview ? (
              <div className="space-y-1">
                <Image
                  src={editEventImagePreview}
                  alt="preview"
                  width={120}
                  height={80}
                  className="h-20 w-auto rounded border border-slate-200 object-cover dark:border-slate-700"
                  unoptimized
                />
              </div>
            ) : null}
            <div className="space-y-1">
              <Label className="text-xs">Remplacer l’image d’événement</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="h-9 text-sm"
                onChange={handleEditEventImageChange}
              />
              <p className="text-xs text-slate-400">JPEG, PNG, WebP, AVIF — max 5 MB</p>
            </div>
            {editEventImageError ? <p className="text-xs text-red-500">{editEventImageError}</p> : null}
            {editEventImageFile && !editEventImageError ? (
              <Button
                type="button"
                className="h-8 px-4 text-xs"
                disabled={isUploadingEventImage}
                onClick={() => void handleUploadEventImage()}
              >
                {isUploadingEventImage ? t.uploadingImage : t.actions.save}
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
