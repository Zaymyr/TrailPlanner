"use client";

import React, { useState } from "react";

import { Button } from "../../../components/ui/button";
import { VOICE_POOL_NAME_MAX, type PoolVoice } from "../../../lib/video-voices";
import type { VoicePool } from "./useVoicePool";
import { getImportableVoices, OTHER_VOICE_CHOICE, RANDOM_VOICE_CHOICE, describeActiveVoices, type ChosenVoice } from "./voice-pool";
import { isPlausibleVoiceId, type SavedVoice } from "./voice-library";
import { VoiceIdPicker } from "./VoiceIdPicker";

type VoiceSectionProps = {
  choice: string;
  /** The voice the narration has (saved or just generated): shown as « Voix : … ». */
  currentVoice: ChosenVoice | null;
  changeRequested: boolean;
  disabled: boolean;
  library: SavedVoice[];
  onChangeVoice: () => void;
  onChoiceChange: (choice: string) => void;
  onForgetVoice: (id: string) => void;
  onSaveVoice: (id: string, name: string) => void;
  onVoiceIdChange: (voiceId: string) => void;
  pool: VoicePool;
  voiceId: string;
};

const message = (error: unknown) => error instanceof Error ? error.message : "Une erreur est survenue.";

function PoolRow({ voice, disabled, pool, onError }: { voice: PoolVoice; disabled: boolean; pool: VoicePool; onError: (message: string) => void }) {
  const [name, setName] = useState(voice.name);
  const run = (action: Promise<unknown>) => action.then(() => onError("")).catch((error: unknown) => onError(message(error)));
  return (
    <li className="flex items-center gap-1.5">
      <input
        type="checkbox"
        aria-label={`Voix active : ${voice.name}`}
        checked={voice.active}
        disabled={disabled}
        onChange={(event) => void run(pool.updateVoice(voice.id, { active: event.target.checked }))}
      />
      <input
        aria-label={`Nom de la voix ${voice.voiceId}`}
        className={`min-h-7 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-xs ${voice.active ? "" : "text-muted-foreground"}`}
        maxLength={VOICE_POOL_NAME_MAX}
        title={voice.voiceId}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      {name.trim() && name.trim() !== voice.name ? (
        <Button type="button" className="h-7 px-2 text-xs" disabled={disabled} onClick={() => void run(pool.updateVoice(voice.id, { name: name.trim() }))}>OK</Button>
      ) : null}
      <button
        type="button"
        aria-label={`Supprimer la voix ${voice.name}`}
        className="px-1.5 text-sm text-muted-foreground hover:text-red-700 disabled:opacity-50"
        disabled={disabled}
        onClick={() => void run(pool.removeVoice(voice.id))}
      >
        ×
      </button>
    </li>
  );
}

/**
 * Voice choice of the reel: « Au hasard » among the shared pool's active voices (default), one
 * pool voice, or a free ElevenLabs id; plus the pool itself (add, rename, activate, delete).
 */
export function VoiceSection({
  choice, currentVoice, changeRequested, disabled, library, onChangeVoice, onChoiceChange, onForgetVoice, onSaveVoice, onVoiceIdChange, pool, voiceId,
}: VoiceSectionProps) {
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const importable = getImportableVoices(library, pool.voices);
  const chosenPoolVoice = pool.voices.find((voice) => voice.voiceId === choice);
  const locked = disabled || busy;

  const guard = async (action: () => Promise<string | null | void>) => {
    setBusy(true);
    try {
      const text = await action();
      setFeedback(text ? { tone: "info", text } : null);
    } catch (error) {
      setFeedback({ tone: "error", text: message(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 space-y-2 text-xs">
      <label className="block space-y-1">
        <span className="font-medium">Voix</span>
        <select
          aria-label="Choix de la voix"
          className="min-h-8 w-full rounded-md border border-input bg-card px-2 text-xs"
          disabled={disabled}
          value={choice}
          onChange={(event) => onChoiceChange(event.target.value)}
        >
          <option value={RANDOM_VOICE_CHOICE}>{describeActiveVoices(pool.voices)}</option>
          {pool.voices.filter((voice) => voice.active || voice.voiceId === choice).map((voice) => (
            <option key={voice.id} value={voice.voiceId}>{voice.name}</option>
          ))}
          <option value={OTHER_VOICE_CHOICE}>Autre ID</option>
        </select>
      </label>

      {choice === RANDOM_VOICE_CHOICE ? (
        <div className="flex items-center justify-between gap-2">
          <p data-testid="current-voice">
            {pool.voices.some((voice) => voice.active)
              ? <>Voix : <span className="font-semibold">{currentVoice?.name ?? currentVoice?.voiceId ?? "tirée à la génération"}</span></>
              : "Pool vide : voix par défaut du serveur (ou « Autre ID »)."}
          </p>
          {currentVoice?.voiceId && pool.voices.filter((voice) => voice.active).length > 1 ? (
            <Button type="button" variant="outline" className="h-7 shrink-0 px-2 text-xs" disabled={disabled || changeRequested} onClick={onChangeVoice}>
              {changeRequested ? "Nouvelle voix à la prochaine génération" : "Changer de voix"}
            </Button>
          ) : null}
        </div>
      ) : null}
      {chosenPoolVoice ? <p>Voix : <span className="font-semibold">{chosenPoolVoice.name}</span></p> : null}

      {choice === OTHER_VOICE_CHOICE ? (
        <VoiceIdPicker
          disabled={disabled}
          onForget={onForgetVoice}
          onSave={onSaveVoice}
          onVoiceIdChange={onVoiceIdChange}
          voiceId={voiceId}
          voices={library}
        />
      ) : null}

      <details className="rounded-md border border-border p-2">
        <summary className="cursor-pointer font-medium">Voix (pool) · {pool.voices.length}</summary>
        <div className="mt-2 space-y-2">
          {pool.error ? <p role="alert" className="text-amber-800">{pool.error}</p> : null}
          {pool.voices.length ? (
            <ul aria-label="Voix du pool" className="space-y-1">
              {pool.voices.map((voice) => <PoolRow key={`${voice.id}:${voice.name}:${voice.active}`} voice={voice} disabled={locked} pool={pool} onError={(text) => setFeedback(text ? { tone: "error", text } : null)} />)}
            </ul>
          ) : (
            <p className="text-muted-foreground">Aucune voix : ajoute 4 ou 5 voix, chaque nouveau reel en tire une au hasard.</p>
          )}
          <form
            className="flex flex-wrap gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              void guard(async () => {
                const warning = await pool.addVoice(newId.trim(), newName);
                setNewId("");
                setNewName("");
                return warning;
              });
            }}
          >
            <input
              aria-label="Identifiant ElevenLabs de la voix à ajouter"
              className="min-h-7 min-w-0 flex-[2] rounded-md border border-input bg-card px-2 font-mono text-xs"
              placeholder="Identifiant ElevenLabs"
              value={newId}
              onChange={(event) => setNewId(event.target.value.trim())}
            />
            <input
              aria-label="Nom de la voix à ajouter"
              className="min-h-7 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-xs"
              maxLength={VOICE_POOL_NAME_MAX}
              placeholder="Nom (facultatif)"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
            <Button type="submit" className="h-7 px-2 text-xs" disabled={locked || !isPlausibleVoiceId(newId)}>Ajouter</Button>
          </form>
          {importable.length ? (
            <Button
              type="button"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={locked}
              onClick={() => void guard(async () => {
                const added = await pool.importLibrary(library);
                return `${added} voix importée${added > 1 ? "s" : ""}.`;
              })}
            >
              Importer mes voix enregistrées ({importable.length})
            </Button>
          ) : null}
          {feedback ? <p role={feedback.tone === "error" ? "alert" : "status"} className={feedback.tone === "error" ? "text-red-700" : "text-amber-800"}>{feedback.text}</p> : null}
        </div>
      </details>
    </div>
  );
}
