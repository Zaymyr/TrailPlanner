"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
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

const basePillClass = "whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const raceEventSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  is_live: z.boolean().nullable().optional(),
});

const raceRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  event_id: z.string().uuid().nullable().optional(),
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
  race_events: raceEventSchema.nullable().optional(),
});

const aidStationRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  km: z.number(),
  water_available: z.boolean(),
  notes: z.string().nullable().optional(),
  order_index: z.number(),
});

type RaceRow = z.infer<typeof raceRowSchema>;
type RaceEventRow = z.infer<typeof raceEventSchema>;
type AidStationRow = z.infer<typeof aidStationRowSchema>;

const editFormSchema = z.object({
  name: z.string().trim().min(1),
  event_id: z.string().trim().optional(),
  location_text: z.string().trim().optional(),
  elevation_gain_m: z.string().trim().optional(),
  elevation_loss_m: z.string().trim().optional(),
  trace_id: z.string().trim().optional(),
  external_site_url: z.string().trim().optional(),
  thumbnail_url: z.string().trim().optional(),
  is_live: z.boolean(),
});

type EditFormValues = z.infer<typeof editFormSchema>;

const editEventFormSchema = z.object({
  name: z.string().trim().min(1),
  location: z.string().trim().optional(),
  race_date: z.string().trim().optional(),
  thumbnail_url: z.string().trim().optional(),
  is_live: z.boolean(),
});

type EditEventFormValues = z.infer<typeof editEventFormSchema>;

const addFormSchema = z.object({
  name: z.string().trim().optional(),
  event_id: z.string().trim().optional(),
  event_name: z.string().trim().optional(),
  event_location: z.string().trim().optional(),
  event_race_date: z.string().trim().optional(),
  event_thumbnail_url: z.string().trim().optional(),
  race_date: z.string().trim().optional(),
  location_text: z.string().trim().optional(),
  elevation_gain_m: z.string().trim().optional(),
  elevation_loss_m: z.string().trim().optional(),
  trace_id: z.string().trim().optional(),
  external_site_url: z.string().trim().optional(),
  thumbnail_url: z.string().trim().optional(),
  is_live: z.boolean(),
});

type AddFormValues = z.infer<typeof addFormSchema>;

type ParsedPreview = { distanceKm: number; gainM: number; lossM: number; waypointCount: number };
type EventMode = "none" | "existing" | "new";
type AidStationDraft = { name: string; distanceKm: string; waterRefill: boolean };
type PreparedAidStation = AidStationDraft & { distanceKmValue: number; hasValue: boolean };
type ImportedRacePreview = {
  url: string;
  courseName: string;
  eventName: string;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  date: string | null;
  location: string | null;
  aidStationCount: number;
};
type ExistingRacePreview = {
  id: string;
  name: string;
  slug?: string | null;
};

type Props = {
  accessToken?: string;
  t: AdminTranslations["raceCatalog"];
};

const normalizeAidStationDrafts = (stations: AidStationDraft[]): PreparedAidStation[] =>
  stations
    .map((station) => {
      const name = station.name.trim();
      const distanceText = station.distanceKm.trim();
      return {
        name,
        distanceKm: distanceText,
        distanceKmValue: distanceText ? Number(distanceText.replace(",", ".")) : Number.NaN,
        waterRefill: station.waterRefill,
        hasValue: name.length > 0 || distanceText.length > 0,
      };
    })
    .filter((station) => station.hasValue);

const aidStationRowsToDrafts = (stations: AidStationRow[]): AidStationDraft[] =>
  [...stations]
    .sort((a, b) => a.order_index - b.order_index)
    .map((station) => ({
      name: station.name,
      distanceKm: String(station.km),
      waterRefill: station.water_available,
    }));

export default function AdminRaceCatalogSection({ accessToken, t }: Props) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addUtmbOpen, setAddUtmbOpen] = useState(false);
  const [addTraceDeTrailOpen, setAddTraceDeTrailOpen] = useState(false);
  const [editRace, setEditRace] = useState<RaceRow | null>(null);
  const [editEvent, setEditEvent] = useState<RaceEventRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [utmbUrl, setUtmbUrl] = useState("");
  const [utmbPreview, setUtmbPreview] = useState<ImportedRacePreview | null>(null);
  const [utmbDuplicateRace, setUtmbDuplicateRace] = useState<ExistingRacePreview | null>(null);
  const [utmbError, setUtmbError] = useState<string | null>(null);
  const [traceDeTrailUrl, setTraceDeTrailUrl] = useState("");
  const [traceDeTrailPreview, setTraceDeTrailPreview] = useState<ImportedRacePreview | null>(null);
  const [traceDeTrailDuplicateRace, setTraceDeTrailDuplicateRace] = useState<ExistingRacePreview | null>(null);
  const [traceDeTrailError, setTraceDeTrailError] = useState<string | null>(null);

  // Add form GPX state
  const [addGpxFile, setAddGpxFile] = useState<File | null>(null);
  const [addGpxPreview, setAddGpxPreview] = useState<ParsedPreview | null>(null);
  const [addGpxError, setAddGpxError] = useState<string | null>(null);
  const [addEventMode, setAddEventMode] = useState<EventMode>("none");
  const [addAidStations, setAddAidStations] = useState<AidStationDraft[]>([]);
  const [addImageFile, setAddImageFile] = useState<File | null>(null);
  const [addImagePreview, setAddImagePreview] = useState<string | null>(null);
  const [addImageError, setAddImageError] = useState<string | null>(null);
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
  const [editAidStations, setEditAidStations] = useState<AidStationDraft[]>([]);
  const [editAidStationsError, setEditAidStationsError] = useState<string | null>(null);
  const [isSavingAidStations, setIsSavingAidStations] = useState(false);
  const [editEventImageFile, setEditEventImageFile] = useState<File | null>(null);
  const [editEventImagePreview, setEditEventImagePreview] = useState<string | null>(null);
  const [editEventImageError, setEditEventImageError] = useState<string | null>(null);
  const [isUploadingEventImage, setIsUploadingEventImage] = useState(false);

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
      const parsed = z.object({ races: z.array(raceRowSchema), events: z.array(raceEventSchema) }).safeParse(data);
      if (!parsed.success) throw new Error(t.loadError);
      return parsed.data;
    },
  });

  const editAidStationsQuery = useQuery({
    queryKey: ["admin", "race-catalog", editRace?.id, "aid-stations"],
    enabled: Boolean(editRace?.id),
    queryFn: async () => {
      if (!editRace) return [];
      const response = await fetch(`/api/race-catalog/${editRace.id}/aid-stations`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        throw new Error((data as { message?: string } | null)?.message ?? t.errors.loadFailed);
      }
      const parsed = z.object({ aidStations: z.array(aidStationRowSchema) }).safeParse(data);
      if (!parsed.success) throw new Error(t.errors.loadFailed);
      return parsed.data.aidStations;
    },
  });

  useEffect(() => {
    if (!editAidStationsQuery.data) return;
    setEditAidStations(aidStationRowsToDrafts(editAidStationsQuery.data));
    setEditAidStationsError(null);
  }, [editAidStationsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string } & Partial<EditFormValues>) => {
      const { id, ...fields } = payload;
      const body: Record<string, unknown> = {};
      if (fields.name !== undefined) body.name = fields.name;
      if (fields.event_id !== undefined) body.event_id = fields.event_id || null;
      if (fields.location_text !== undefined) body.location_text = fields.location_text || null;
      if (fields.elevation_gain_m !== undefined && fields.elevation_gain_m !== "") {
        body.elevation_gain_m = Number(fields.elevation_gain_m.replace(",", "."));
      }
      if (fields.elevation_loss_m !== undefined) {
        body.elevation_loss_m = fields.elevation_loss_m === "" ? null : Number(fields.elevation_loss_m.replace(",", "."));
      }
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

  const updateEventMutation = useMutation({
    mutationFn: async (payload: { id: string } & Partial<EditEventFormValues>) => {
      const { id, ...fields } = payload;
      const body: Record<string, unknown> = {};
      if (fields.name !== undefined) body.name = fields.name;
      if (fields.location !== undefined) body.location = fields.location || null;
      if (fields.race_date !== undefined) body.race_date = fields.race_date || null;
      if (fields.thumbnail_url !== undefined) body.thumbnail_url = fields.thumbnail_url || null;
      if (fields.is_live !== undefined) body.is_live = fields.is_live;

      const response = await fetch(`/api/admin/race-events/${id}`, {
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
      setEditEvent(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "race-catalog", accessToken] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t.errors.updateFailed);
      setMessage(null);
    },
  });

  const utmbPreviewMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch("/api/admin/race-catalog/utmb", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ url, action: "preview" }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; preview?: ImportedRacePreview; duplicateRace?: ExistingRacePreview | null }
        | null;

      if (!response.ok || !data?.preview) {
        throw new Error(data?.message ?? t.errors.utmbImportFailed);
      }

      return data;
    },
    onSuccess: (data) => {
      setUtmbPreview(data.preview ?? null);
      setUtmbDuplicateRace(data.duplicateRace ?? null);
      setUtmbError(null);
    },
    onError: (err) => {
      setUtmbPreview(null);
      setUtmbDuplicateRace(null);
      setUtmbError(err instanceof Error ? err.message : t.errors.utmbImportFailed);
    },
  });

  const utmbImportMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch("/api/admin/race-catalog/utmb", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ url, action: "import" }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; race?: RaceRow }
        | null;

      if (!response.ok || !data?.race) {
        throw new Error(data?.message ?? t.errors.utmbImportFailed);
      }

      return data;
    },
    onSuccess: () => {
      setMessage(t.messages.imported);
      setError(null);
      setUtmbError(null);
      setUtmbPreview(null);
      setUtmbDuplicateRace(null);
      setUtmbUrl("");
      setAddUtmbOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["admin", "race-catalog", accessToken] });
    },
    onError: (err) => {
      setUtmbError(err instanceof Error ? err.message : t.errors.utmbImportFailed);
    },
  });

  const traceDeTrailPreviewMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch("/api/admin/race-catalog/tracedetrail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ url, action: "preview" }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; preview?: ImportedRacePreview; duplicateRace?: ExistingRacePreview | null }
        | null;

      if (!response.ok || !data?.preview) {
        throw new Error(data?.message ?? t.errors.traceDeTrailImportFailed);
      }

      return data;
    },
    onSuccess: (data) => {
      setTraceDeTrailPreview(data.preview ?? null);
      setTraceDeTrailDuplicateRace(data.duplicateRace ?? null);
      setTraceDeTrailError(null);
    },
    onError: (err) => {
      setTraceDeTrailPreview(null);
      setTraceDeTrailDuplicateRace(null);
      setTraceDeTrailError(err instanceof Error ? err.message : t.errors.traceDeTrailImportFailed);
    },
  });

  const traceDeTrailImportMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch("/api/admin/race-catalog/tracedetrail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ url, action: "import" }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; race?: RaceRow }
        | null;

      if (!response.ok || !data?.race) {
        throw new Error(data?.message ?? t.errors.traceDeTrailImportFailed);
      }

      return data;
    },
    onSuccess: () => {
      setMessage(t.messages.imported);
      setError(null);
      setTraceDeTrailError(null);
      setTraceDeTrailPreview(null);
      setTraceDeTrailDuplicateRace(null);
      setTraceDeTrailUrl("");
      setAddTraceDeTrailOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["admin", "race-catalog", accessToken] });
    },
    onError: (err) => {
      setTraceDeTrailError(err instanceof Error ? err.message : t.errors.traceDeTrailImportFailed);
    },
  });

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
  });

  const editEventForm = useForm<EditEventFormValues>({
    resolver: zodResolver(editEventFormSchema),
  });

  const addForm = useForm<AddFormValues>({
    resolver: zodResolver(addFormSchema),
    defaultValues: {
      name: "",
      event_id: "",
      event_name: "",
      event_location: "",
      event_race_date: "",
      event_thumbnail_url: "",
      race_date: "",
      location_text: "",
      elevation_gain_m: "",
      elevation_loss_m: "",
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
      event_id: race.event_id ?? "",
      location_text: race.location_text ?? "",
      elevation_gain_m: Math.round(race.elevation_gain_m).toString(),
      elevation_loss_m: race.elevation_loss_m != null ? Math.round(race.elevation_loss_m).toString() : "",
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
    setEditAidStations([]);
    setEditAidStationsError(null);
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
    setEditAidStations([]);
    setEditAidStationsError(null);
  };

  const handleOpenEditEvent = (event: RaceEventRow) => {
    setEditEvent(event);
    editEventForm.reset({
      name: event.name,
      location: event.location ?? "",
      race_date: event.race_date ?? "",
      thumbnail_url: event.thumbnail_url ?? "",
      is_live: event.is_live !== false,
    });
    setEditEventImageFile(null);
    setEditEventImagePreview(null);
    setEditEventImageError(null);
    setMessage(null);
    setError(null);
  };

  const handleCloseEditEvent = () => {
    setEditEvent(null);
    setEditEventImageFile(null);
    if (editEventImagePreview) URL.revokeObjectURL(editEventImagePreview);
    setEditEventImagePreview(null);
    setEditEventImageError(null);
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
      setAddGpxPreview({
        distanceKm: parsed.stats.distanceKm,
        gainM: parsed.stats.gainM,
        lossM: parsed.stats.lossM,
        waypointCount: parsed.waypoints.length,
      });
      if (!addForm.getValues("name") && parsed.name) {
        addForm.setValue("name", parsed.name, { shouldDirty: true });
      }
      if (!addForm.getValues("elevation_gain_m")) {
        addForm.setValue("elevation_gain_m", Math.round(parsed.stats.gainM).toString(), { shouldDirty: true });
      }
      if (!addForm.getValues("elevation_loss_m")) {
        addForm.setValue("elevation_loss_m", Math.round(parsed.stats.lossM).toString(), { shouldDirty: true });
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
      setEditGpxPreview({
        distanceKm: parsed.stats.distanceKm,
        gainM: parsed.stats.gainM,
        lossM: parsed.stats.lossM,
        waypointCount: parsed.waypoints.length,
      });
    } catch (error) {
      setEditGpxPreview(null);
      setEditGpxError(error instanceof Error ? `${t.errors.invalidGpx} (${error.message})` : t.errors.invalidGpx);
    }
  };

  const handleAddImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAddImageError(null);

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setAddImageError(t.errors.imageInvalidType);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setAddImageError(t.errors.imageTooLarge);
      return;
    }

    setAddImageFile(file);
    if (addImagePreview) URL.revokeObjectURL(addImagePreview);
    setAddImagePreview(URL.createObjectURL(file));
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

  const handleEditEventImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setEditEventImageError(null);

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setEditEventImageError(t.errors.imageInvalidType);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setEditEventImageError(t.errors.imageTooLarge);
      return;
    }

    setEditEventImageFile(file);
    if (editEventImagePreview) URL.revokeObjectURL(editEventImagePreview);
    const objectUrl = URL.createObjectURL(file);
    setEditEventImagePreview(objectUrl);
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
      void queryClient.invalidateQueries({ queryKey: ["admin", "race-catalog", editRace.id, "aid-stations"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.gpxUploadFailed);
    } finally {
      setIsUploadingGpx(false);
    }
  };

  const handleSaveEditAidStations = async () => {
    if (!editRace) return;

    const aidStations = normalizeAidStationDrafts(editAidStations);
    if (
      aidStations.some(
        (station) => station.name.length === 0 || !Number.isFinite(station.distanceKmValue) || station.distanceKmValue < 0
      )
    ) {
      setEditAidStationsError(t.errors.invalidAidStations);
      return;
    }

    setIsSavingAidStations(true);
    setEditAidStationsError(null);
    setError(null);

    try {
      const response = await fetch(`/api/race-catalog/${editRace.id}/aid-stations`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          aidStations: aidStations.map((station) => ({
            name: station.name,
            distanceKm: station.distanceKmValue,
            waterRefill: station.waterRefill,
          })),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; aidStations?: AidStationRow[] }
        | null;
      if (!response.ok) {
        throw new Error(data?.message ?? t.errors.aidStationsUpdateFailed);
      }

      setMessage(t.messages.updated);
      setEditAidStations(data?.aidStations ? aidStationRowsToDrafts(data.aidStations) : editAidStations);
      void queryClient.invalidateQueries({ queryKey: ["admin", "race-catalog", editRace.id, "aid-stations"] });
    } catch (err) {
      setEditAidStationsError(err instanceof Error ? err.message : t.errors.aidStationsUpdateFailed);
    } finally {
      setIsSavingAidStations(false);
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

  const handleUploadEventImage = async () => {
    if (!editEvent || !editEventImageFile) return;
    setIsUploadingEventImage(true);
    setError(null);
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
      setMessage(t.messages.updated);
      setEditEventImageFile(null);
      if (editEventImagePreview) URL.revokeObjectURL(editEventImagePreview);
      setEditEventImagePreview(null);
      if (data?.thumbnail_url && editEvent) {
        setEditEvent({ ...editEvent, thumbnail_url: data.thumbnail_url });
        editEventForm.setValue("thumbnail_url", data.thumbnail_url, { shouldDirty: true });
      }
      void queryClient.invalidateQueries({ queryKey: ["admin", "race-catalog", accessToken] });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.imageUploadFailed);
    } finally {
      setIsUploadingEventImage(false);
    }
  };

  const handleEditSubmit = editForm.handleSubmit((values) => {
    if (!editRace) return;
    updateMutation.mutate({ id: editRace.id, ...values });
  });

  const handleEditEventSubmit = editEventForm.handleSubmit((values) => {
    if (!editEvent) return;
    updateEventMutation.mutate({ id: editEvent.id, ...values });
  });

  const resetAddDialog = () => {
    addForm.reset();
    setAddEventMode("none");
    setAddAidStations([]);
    setAddGpxFile(null);
    setAddGpxPreview(null);
    setAddGpxError(null);
    setAddImageFile(null);
    if (addImagePreview) URL.revokeObjectURL(addImagePreview);
    setAddImagePreview(null);
    setAddImageError(null);
  };

  const handleAddAidStation = () => {
    setAddAidStations((stations) => [
      ...stations,
      { name: `Ravito ${stations.length + 1}`, distanceKm: "", waterRefill: true },
    ]);
  };

  const updateAddAidStation = (index: number, patch: Partial<AidStationDraft>) => {
    setAddAidStations((stations) =>
      stations.map((station, stationIndex) => (stationIndex === index ? { ...station, ...patch } : station))
    );
  };

  const removeAddAidStation = (index: number) => {
    setAddAidStations((stations) => stations.filter((_, stationIndex) => stationIndex !== index));
  };

  const handleAddEditAidStation = () => {
    setEditAidStations((stations) => [
      ...stations,
      { name: `Ravito ${stations.length + 1}`, distanceKm: "", waterRefill: true },
    ]);
  };

  const updateEditAidStation = (index: number, patch: Partial<AidStationDraft>) => {
    setEditAidStations((stations) =>
      stations.map((station, stationIndex) => (stationIndex === index ? { ...station, ...patch } : station))
    );
  };

  const removeEditAidStation = (index: number) => {
    setEditAidStations((stations) => stations.filter((_, stationIndex) => stationIndex !== index));
  };

  const handleAddSubmit = addForm.handleSubmit(async (values) => {
    if (!addGpxFile) {
      setAddGpxError(t.errors.missingGpx);
      return;
    }
    if (addImageError) {
      return;
    }
    if (addEventMode === "existing" && !values.event_id) {
      setError(t.errors.missingEvent);
      return;
    }
    if (addEventMode === "new" && !values.event_name?.trim()) {
      setError(t.errors.missingEvent);
      return;
    }
    const aidStations = normalizeAidStationDrafts(addAidStations);

    if (
      aidStations.some(
        (station) => station.name.length === 0 || !Number.isFinite(station.distanceKmValue) || station.distanceKmValue < 0
      )
    ) {
      setAddGpxError(t.errors.invalidAidStations);
      return;
    }

    setIsSubmittingAdd(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("gpx", addGpxFile);
      if (addImageFile) formData.append("image", addImageFile);
      if (values.name) formData.append("name", values.name);
      if (addEventMode === "existing" && values.event_id) formData.append("event_id", values.event_id);
      if (addEventMode === "new" && values.event_name) formData.append("event_name", values.event_name);
      if (addEventMode === "new" && values.event_location) formData.append("event_location", values.event_location);
      if (addEventMode === "new" && values.event_race_date) formData.append("event_race_date", values.event_race_date);
      if (addEventMode === "new" && values.event_thumbnail_url) {
        formData.append("event_thumbnail_url", values.event_thumbnail_url);
      }
      if (values.race_date) formData.append("race_date", values.race_date);
      if (values.location_text) formData.append("location_text", values.location_text);
      if (values.elevation_gain_m) formData.append("elevation_gain_m", values.elevation_gain_m);
      if (values.elevation_loss_m) formData.append("elevation_loss_m", values.elevation_loss_m);
      if (values.trace_id) formData.append("trace_id", values.trace_id);
      if (values.external_site_url) formData.append("external_site_url", values.external_site_url);
      if (values.thumbnail_url) formData.append("thumbnail_url", values.thumbnail_url);
      if (aidStations.length > 0) {
        formData.append(
          "aid_stations",
          JSON.stringify(
            aidStations.map((station) => ({
              name: station.name,
              distanceKm: station.distanceKmValue,
              waterRefill: station.waterRefill,
            }))
          )
        );
      }
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
      resetAddDialog();
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

  const resetUtmbDialog = () => {
    setUtmbUrl("");
    setUtmbPreview(null);
    setUtmbDuplicateRace(null);
    setUtmbError(null);
  };

  const resetTraceDeTrailDialog = () => {
    setTraceDeTrailUrl("");
    setTraceDeTrailPreview(null);
    setTraceDeTrailDuplicateRace(null);
    setTraceDeTrailError(null);
  };

  const raceRows = racesQuery.data?.races ?? [];
  const eventRows = racesQuery.data?.events ?? [];
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="h-9 px-4 text-sm"
              onClick={() => {
                resetTraceDeTrailDialog();
                setAddTraceDeTrailOpen(true);
                setMessage(null);
                setError(null);
              }}
            >
              {t.actions.addTraceDeTrail}
            </Button>
            <Button
              variant="outline"
              className="h-9 px-4 text-sm"
              onClick={() => {
                resetUtmbDialog();
                setAddUtmbOpen(true);
                setMessage(null);
                setError(null);
              }}
            >
              {t.actions.addUtmb}
            </Button>
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
          <Table className="table-fixed" containerClassName="overflow-x-hidden rounded-lg border border-border">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[31%] text-slate-600 dark:text-slate-300">{t.table.name}</TableHead>
                <TableHead className="w-[21%] text-slate-600 dark:text-slate-300">{t.table.location}</TableHead>
                <TableHead className="hidden">{t.table.event}</TableHead>
                <TableHead className="w-[13%] text-slate-600 dark:text-slate-300">{t.table.distance}</TableHead>
                <TableHead className="hidden">{t.table.elevation}</TableHead>
                <TableHead className="w-[10%] text-slate-600 dark:text-slate-300">{t.table.status}</TableHead>
                <TableHead className="w-[25%] text-right text-slate-600 dark:text-slate-300">{t.table.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRaces.map((race) => (
                <TableRow key={race.id}>
                  <TableCell className="align-middle font-semibold text-slate-900 dark:text-slate-50">
                    <div className="flex items-center gap-2">
                      {race.race_events?.thumbnail_url ?? race.thumbnail_url ? (
                        <Image
                          src={race.race_events?.thumbnail_url ?? race.thumbnail_url ?? ""}
                          alt={race.name}
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded object-cover"
                          unoptimized
                        />
                      ) : null}
                      <div className="min-w-0">
                        <p className="truncate">{race.name}</p>
                        {race.race_events?.name ? (
                          <p className="truncate text-xs font-normal text-slate-500 dark:text-slate-400">
                            {race.race_events.name}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="align-middle text-slate-700 dark:text-slate-200">
                    <div className="space-y-1">
                      <p>{race.location_text ?? race.location ?? "—"}</p>
                      {race.race_events?.location || race.race_events?.race_date ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t.table.event}: {[race.race_events?.location, race.race_events?.race_date].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-slate-700 dark:text-slate-200">
                    {race.race_events?.location ?? race.location_text ?? race.location ?? "—"}
                  </TableCell>
                  <TableCell className="align-middle text-slate-700 dark:text-slate-200">
                    <div className="space-y-1">
                      <p>{race.distance_km.toFixed(1)} km</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">D+ {Math.round(race.elevation_gain_m)} m</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-slate-700 dark:text-slate-200">
                    {Math.round(race.elevation_gain_m)} m
                  </TableCell>
                  <TableCell className="align-middle">
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
                  <TableCell className="align-middle">
                    <div className="flex flex-wrap justify-end gap-2">
                      {race.race_events ? (
                        <Button
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          onClick={() => handleOpenEditEvent(race.race_events!)}
                        >
                          {t.actions.editEvent}
                        </Button>
                      ) : null}
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>

      {/* ── Add dialog ── */}
      <Dialog
        open={addTraceDeTrailOpen}
        onOpenChange={(open) => {
          setAddTraceDeTrailOpen(open);
          if (!open) resetTraceDeTrailDialog();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.traceDeTrailTitle}</DialogTitle>
            <DialogDescription>{t.traceDeTrailDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">{t.fields.traceDeTrailUrl}</Label>
              <Input
                className="h-9 text-sm"
                placeholder="https://tracedetrail.fr/fr/trace/312934"
                value={traceDeTrailUrl}
                onChange={(event) => {
                  setTraceDeTrailUrl(event.target.value);
                  setTraceDeTrailPreview(null);
                  setTraceDeTrailDuplicateRace(null);
                  setTraceDeTrailError(null);
                }}
              />
            </div>

            {traceDeTrailError ? (
              <p className="text-sm text-red-600 dark:text-red-300">{traceDeTrailError}</p>
            ) : null}

            {traceDeTrailPreview ? (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {t.traceDeTrailPreview.title}
                </p>
                <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                  <p className="font-medium">{traceDeTrailPreview.courseName}</p>
                  <p>{traceDeTrailPreview.eventName}</p>
                  <p>
                    {traceDeTrailPreview.distanceKm.toFixed(1)} km · D+{" "}
                    {Math.round(traceDeTrailPreview.elevationGainM)} m · D-{" "}
                    {Math.round(traceDeTrailPreview.elevationLossM)} m
                  </p>
                  <p>
                    {traceDeTrailPreview.location ?? "—"}
                    {traceDeTrailPreview.date ? ` · ${traceDeTrailPreview.date}` : ""}
                  </p>
                  <p>
                    {t.traceDeTrailPreview.aidStations.replace(
                      "{count}",
                      String(traceDeTrailPreview.aidStationCount)
                    )}
                  </p>
                </div>
              </div>
            ) : null}

            {traceDeTrailDuplicateRace ? (
              <p className="text-sm text-amber-700 dark:text-amber-200">
                {t.errors.traceDeTrailDuplicate.replace("{name}", traceDeTrailDuplicateRace.name)}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddTraceDeTrailOpen(false)}>
                {t.actions.cancel}
              </Button>
              {!traceDeTrailPreview ? (
                <Button
                  type="button"
                  disabled={!traceDeTrailUrl.trim() || traceDeTrailPreviewMutation.isPending}
                  onClick={() => traceDeTrailPreviewMutation.mutate(traceDeTrailUrl.trim())}
                >
                  {traceDeTrailPreviewMutation.isPending ? t.actions.loadingImport : t.actions.import}
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={Boolean(traceDeTrailDuplicateRace) || traceDeTrailImportMutation.isPending}
                  onClick={() => traceDeTrailImportMutation.mutate(traceDeTrailUrl.trim())}
                >
                  {traceDeTrailImportMutation.isPending ? t.actions.importing : t.actions.confirmImport}
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addUtmbOpen}
        onOpenChange={(open) => {
          setAddUtmbOpen(open);
          if (!open) resetUtmbDialog();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.utmbTitle}</DialogTitle>
            <DialogDescription>{t.utmbDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">{t.fields.utmbUrl}</Label>
              <Input
                className="h-9 text-sm"
                placeholder="https://saint-jacques.utmb.world/races/100K"
                value={utmbUrl}
                onChange={(event) => {
                  setUtmbUrl(event.target.value);
                  setUtmbPreview(null);
                  setUtmbDuplicateRace(null);
                  setUtmbError(null);
                }}
              />
            </div>

            {utmbError ? <p className="text-sm text-red-600 dark:text-red-300">{utmbError}</p> : null}

            {utmbPreview ? (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{t.utmbPreview.title}</p>
                <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                  <p className="font-medium">{utmbPreview.courseName}</p>
                  <p>{utmbPreview.eventName}</p>
                  <p>
                    {utmbPreview.distanceKm.toFixed(1)} km · D+ {Math.round(utmbPreview.elevationGainM)} m · D-{" "}
                    {Math.round(utmbPreview.elevationLossM)} m
                  </p>
                  <p>
                    {utmbPreview.location ?? "—"}
                    {utmbPreview.date ? ` · ${utmbPreview.date}` : ""}
                  </p>
                  <p>{t.utmbPreview.aidStations.replace("{count}", String(utmbPreview.aidStationCount))}</p>
                </div>
              </div>
            ) : null}

            {utmbDuplicateRace ? (
              <p className="text-sm text-amber-700 dark:text-amber-200">
                {t.errors.utmbDuplicate.replace("{name}", utmbDuplicateRace.name)}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddUtmbOpen(false)}>
                {t.actions.cancel}
              </Button>
              {!utmbPreview ? (
                <Button
                  type="button"
                  disabled={!utmbUrl.trim() || utmbPreviewMutation.isPending}
                  onClick={() => utmbPreviewMutation.mutate(utmbUrl.trim())}
                >
                  {utmbPreviewMutation.isPending ? t.actions.loadingImport : t.actions.import}
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={Boolean(utmbDuplicateRace) || utmbImportMutation.isPending}
                  onClick={() => utmbImportMutation.mutate(utmbUrl.trim())}
                >
                  {utmbImportMutation.isPending ? t.actions.importing : t.actions.confirmImport}
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            resetAddDialog();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
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
                <Label className="text-xs">{t.fields.raceDate}</Label>
                <Input type="date" className="h-9 text-sm" {...addForm.register("race_date")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.fields.elevationGain}</Label>
                <Input className="h-9 text-sm" inputMode="numeric" {...addForm.register("elevation_gain_m")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.fields.elevationLoss}</Label>
                <Input className="h-9 text-sm" inputMode="numeric" {...addForm.register("elevation_loss_m")} />
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
                <Label className="text-xs">{t.fields.thumbnailFile}</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="h-9 text-sm"
                  onChange={handleAddImageChange}
                />
                {addImagePreview ? (
                  <Image
                    src={addImagePreview}
                    alt="preview"
                    width={120}
                    height={80}
                    className="h-20 w-auto rounded border border-slate-200 object-cover dark:border-slate-700"
                    unoptimized
                  />
                ) : null}
                {addImageError ? <p className="text-xs text-red-500">{addImageError}</p> : null}
              </div>
              <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800 sm:col-span-2">
                <Label className="text-xs">{t.fields.eventMode}</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(["none", "existing", "new"] as EventMode[]).map((mode) => (
                    <label key={mode} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <input
                        type="radio"
                        name="add-event-mode"
                        checked={addEventMode === mode}
                        onChange={() => setAddEventMode(mode)}
                      />
                      {mode === "none" ? t.fields.noEvent : mode === "existing" ? t.fields.existingEvent : t.fields.newEvent}
                    </label>
                  ))}
                </div>
                {addEventMode === "existing" ? (
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    {...addForm.register("event_id")}
                  >
                    <option value="">{t.fields.event}</option>
                    {eventRows.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name}
                        {event.race_date ? ` - ${event.race_date}` : ""}
                      </option>
                    ))}
                  </select>
                ) : null}
                {addEventMode === "new" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">{t.fields.eventName}</Label>
                      <Input className="h-9 text-sm" {...addForm.register("event_name")} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t.fields.eventLocation}</Label>
                      <Input className="h-9 text-sm" {...addForm.register("event_location")} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t.fields.eventDate}</Label>
                      <Input type="date" className="h-9 text-sm" {...addForm.register("event_race_date")} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t.fields.eventThumbnailUrl}</Label>
                      <Input
                        className="h-9 text-sm"
                        placeholder="https://..."
                        {...addForm.register("event_thumbnail_url")}
                      />
                    </div>
                  </div>
                ) : null}
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
                    <span className="ml-2">
                      {t.gpxWaypoints.replace("{count}", String(addGpxPreview.waypointCount))}
                    </span>
                  </p>
                ) : null}
                {addGpxPreview?.waypointCount === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-300">{t.noGpxWaypoints}</p>
                ) : null}
                {addGpxError ? <p className="text-xs text-red-500">{addGpxError}</p> : null}
              </div>
              <div className="space-y-2 rounded-lg border border-dashed border-slate-200 p-3 dark:border-slate-800 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {t.aidStationsTitle}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.aidStationsDescription}</p>
                  </div>
                  <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={handleAddAidStation}>
                    {t.actions.addAidStation}
                  </Button>
                </div>
                {addAidStations.map((station, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_120px_auto_auto]">
                    <Input
                      className="h-9 text-sm"
                      placeholder={t.fields.aidStationName}
                      value={station.name}
                      onChange={(event) => updateAddAidStation(index, { name: event.target.value })}
                    />
                    <Input
                      className="h-9 text-sm"
                      inputMode="decimal"
                      placeholder={t.fields.aidStationDistance}
                      value={station.distanceKm}
                      onChange={(event) => updateAddAidStation(index, { distanceKm: event.target.value })}
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={station.waterRefill}
                        onChange={(event) => updateAddAidStation(index, { waterRefill: event.target.checked })}
                      />
                      {t.fields.aidStationWater}
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 text-xs text-red-600 hover:text-red-600"
                      onClick={() => removeAddAidStation(index)}
                    >
                      {t.actions.remove}
                    </Button>
                  </div>
                ))}
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
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">{t.fields.event}</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    {...editForm.register("event_id")}
                  >
                    <option value="">{t.fields.noEvent}</option>
                    {eventRows.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name}
                        {event.race_date ? ` - ${event.race_date}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t.fields.elevationGain}</Label>
                  <Input className="h-9 text-sm" inputMode="numeric" {...editForm.register("elevation_gain_m")} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t.fields.elevationLoss}</Label>
                  <Input className="h-9 text-sm" inputMode="numeric" {...editForm.register("elevation_loss_m")} />
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
                  <span className="ml-2">
                    {t.gpxWaypoints.replace("{count}", String(editGpxPreview.waypointCount))}
                  </span>
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

            {/* Aid stations */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {t.aidStationsEditTitle}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.aidStationsEditDescription}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={handleAddEditAidStation}
                >
                  {t.actions.addAidStation}
                </Button>
              </div>

              {editAidStationsQuery.isLoading ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.aidStationsLoading}</p>
              ) : null}
              {editAidStationsQuery.error ? (
                <p className="text-xs text-red-500">
                  {editAidStationsQuery.error instanceof Error ? editAidStationsQuery.error.message : t.errors.loadFailed}
                </p>
              ) : null}
              {!editAidStationsQuery.isLoading && editAidStations.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  {t.aidStationsEmpty}
                </p>
              ) : null}
              <div className="space-y-2">
                {editAidStations.map((station, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_120px_auto_auto]">
                    <Input
                      className="h-9 text-sm"
                      placeholder={t.fields.aidStationName}
                      value={station.name}
                      onChange={(event) => updateEditAidStation(index, { name: event.target.value })}
                    />
                    <Input
                      className="h-9 text-sm"
                      inputMode="decimal"
                      placeholder={t.fields.aidStationDistance}
                      value={station.distanceKm}
                      onChange={(event) => updateEditAidStation(index, { distanceKm: event.target.value })}
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={station.waterRefill}
                        onChange={(event) => updateEditAidStation(index, { waterRefill: event.target.checked })}
                      />
                      {t.fields.aidStationWater}
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 text-xs text-red-600 hover:text-red-600"
                      onClick={() => removeEditAidStation(index)}
                    >
                      {t.actions.remove}
                    </Button>
                  </div>
                ))}
              </div>
              {editAidStationsError ? <p className="text-xs text-red-500">{editAidStationsError}</p> : null}
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="h-8 px-4 text-xs"
                  disabled={isSavingAidStations || editAidStationsQuery.isLoading}
                  onClick={() => void handleSaveEditAidStations()}
                >
                  {isSavingAidStations ? t.actions.saving : t.actions.save}
                </Button>
              </div>
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

      <Dialog open={editEvent !== null} onOpenChange={(open) => { if (!open) handleCloseEditEvent(); }}>
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
                  <Label className="text-xs">Date de l'événement</Label>
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
                <Button type="button" variant="outline" onClick={handleCloseEditEvent}>
                  {t.actions.cancel}
                </Button>
                <Button type="submit" disabled={updateEventMutation.isPending}>
                  {updateEventMutation.isPending ? t.actions.saving : t.actions.save}
                </Button>
              </div>
            </form>

            <hr className="border-slate-200 dark:border-slate-800" />

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Image de l'événement</p>
              {editEvent?.thumbnail_url && !editEventImagePreview ? (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Image actuelle de l'événement</p>
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
                <Label className="text-xs">Remplacer l'image d'événement</Label>
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
    </Card>
  );
}
