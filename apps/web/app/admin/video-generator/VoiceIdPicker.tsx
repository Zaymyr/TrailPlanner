"use client";

import React, { useState } from "react";

import { Button } from "../../../components/ui/button";
import { isPlausibleVoiceId, sortVoices, type SavedVoice } from "./voice-library";

type VoiceIdPickerProps = {
  disabled: boolean;
  onForget: (id: string) => void;
  onSave: (id: string, name: string) => void;
  onVoiceIdChange: (voiceId: string) => void;
  voiceId: string;
  voices: SavedVoice[];
};

const shortId = (id: string) => `${id.slice(0, 6)}…`;

/** Voice id field with the saved voices and the recent ones as one-click chips. */
export function VoiceIdPicker({ disabled, onForget, onSave, onVoiceIdChange, voiceId, voices }: VoiceIdPickerProps) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const current = voices.find((voice) => voice.id === voiceId);
  const canSave = isPlausibleVoiceId(voiceId);

  return (
    <div className="flex-1 space-y-1.5 text-xs">
      <label className="block space-y-1">
        <span className="font-medium">Voix ElevenLabs (identifiant)</span>
        <input
          aria-label="Identifiant de la voix ElevenLabs"
          className="min-h-8 w-full rounded-md border border-input bg-card px-2 font-mono text-xs"
          placeholder="Voix par défaut"
          value={voiceId}
          onChange={(event) => onVoiceIdChange(event.target.value.trim())}
        />
      </label>

      {naming ? (
        <form
          className="flex gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(voiceId, name);
            setNaming(false);
          }}
        >
          <input
            aria-label="Nom de la voix"
            autoFocus
            className="min-h-7 flex-1 rounded-md border border-input bg-card px-2 text-xs"
            maxLength={40}
            placeholder="Ex. Thomas, posé"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" className="h-7 px-2 text-xs" disabled={!name.trim()}>OK</Button>
          <Button type="button" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setNaming(false)}>Annuler</Button>
        </form>
      ) : canSave ? (
        <button
          type="button"
          className="text-[11px] font-medium text-foreground underline underline-offset-2 disabled:opacity-50"
          disabled={disabled}
          onClick={() => {
            setName(current?.name ?? "");
            setNaming(true);
          }}
        >
          {current?.name ? `Renommer « ${current.name} »` : "Enregistrer cette voix"}
        </button>
      ) : null}

      {voices.length > 0 ? (
        <ul className="flex flex-wrap gap-1" aria-label="Voix enregistrées et récentes">
          {sortVoices(voices).map((voice) => (
            <li key={voice.id} className="flex items-center">
              <button
                type="button"
                title={voice.id}
                aria-pressed={voice.id === voiceId}
                className={`rounded-l-full border px-2 py-0.5 text-[11px] ${voice.id === voiceId ? "border-brand bg-brand-surface font-semibold" : "border-border bg-card"} ${voice.name ? "" : "font-mono text-muted-foreground"}`}
                onClick={() => onVoiceIdChange(voice.id)}
              >
                {voice.name ?? shortId(voice.id)}
              </button>
              <button
                type="button"
                aria-label={`Oublier la voix ${voice.name ?? voice.id}`}
                className="rounded-r-full border border-l-0 border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-red-700"
                onClick={() => onForget(voice.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
