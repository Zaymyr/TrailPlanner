"use client";

import { useMemo, useState } from "react";

import type { AidStationView, TraceDetailView, TracePointView } from "../../lib/trace/traceRepo";
import { traceSaveSchema, type TraceSavePayload } from "../../lib/trace/traceSchemas";

type EditorState = {
  traceId?: string;
  name: string;
  isPublic: boolean;
  points: TracePointView[];
  aidStations: AidStationView[];
};

const emptyState: EditorState = {
  traceId: undefined,
  name: "",
  isPublic: false,
  points: [],
  aidStations: [],
};

export const useTraceEditor = () => {
  const [state, setState] = useState<EditorState>(emptyState);
  const [selectedAidStationId, setSelectedAidStationId] = useState<string | null>(null);

  const isValid = useMemo(() => traceSaveSchema.safeParse(toPayload(state)).success, [state]);

  const loadTrace = (detail: TraceDetailView) => {
    setState({
      traceId: detail.trace.id,
      name: detail.trace.name,
      isPublic: detail.trace.isPublic,
      points: detail.points.map((point) => ({
        ...point,
        idx: point.idx,
      })),
      aidStations: detail.aidStations,
    });
  };

  const updateName = (name: string) => setState((prev) => ({ ...prev, name }));
  const updateVisibility = (isPublic: boolean) => setState((prev) => ({ ...prev, isPublic }));

  const addPoint = (point: Omit<TracePointView, "idx">) =>
    setState((prev) => {
      const idx = prev.points.length;
      return { ...prev, points: [...prev.points, { ...point, idx }] };
    });

  const undoPoint = () =>
    setState((prev) => ({
      ...prev,
      points: prev.points.slice(0, -1).map((point, idx) => ({ ...point, idx })),
    }));

  const clearPoints = () => setState((prev) => ({ ...prev, points: [], aidStations: [] }));

  const addAidStation = (station: AidStationView) =>
    setState((prev) => ({
      ...prev,
      aidStations: [...prev.aidStations, station],
    }));

  const replaceAidStations = (aidStations: AidStationView[]) => setState((prev) => ({ ...prev, aidStations }));

  const reset = () => setState(emptyState);

  const payload = toPayload(state);

  return {
    state,
    isValid,
    payload,
    selectedAidStationId,
    setSelectedAidStationId,
    loadTrace,
    updateName,
    updateVisibility,
    addPoint,
    undoPoint,
    clearPoints,
    addAidStation,
    replaceAidStations,
    reset,
  };
};

const toPayload = (state: EditorState): TraceSavePayload => ({
  id: state.traceId,
  name: state.name,
  isPublic: state.isPublic,
  points: state.points.map((point, idx) => ({
    idx,
    lat: point.lat,
    lng: point.lng,
    elevation: point.elevation ?? undefined,
  })),
  aidStations: state.aidStations.map((station) => ({
    id: station.id,
    name: station.name,
    lat: station.lat,
    lng: station.lng,
    type: station.type,
    notes: station.notes,
  })),
});
