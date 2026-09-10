"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { cn } from "../../../../components/utils";
import type { OrganizerLocation } from "../../../../lib/organizer-dashboard-details";
import { buildOrganizerLocation, formatCoordinates, hasCoordinates } from "../../../../lib/location-utils";

type AddressSuggestion = {
  label: string;
  lat: number;
  lng: number;
  googleMapsUrl: string | null;
  subtitle?: string | null;
};

export function AddressAutocompleteField({
  label,
  value,
  location,
  biasLocation,
  onChange,
  onLocationChange,
  required,
  placeholder,
  invalid,
}: {
  label: string;
  value: string;
  location: OrganizerLocation;
  biasLocation?: OrganizerLocation;
  onChange: (value: string) => void;
  onLocationChange: (location: OrganizerLocation) => void;
  required?: boolean;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const lastQueryRef = useRef("");
  const blurTimerRef = useRef<number | null>(null);
  const generatedId = useId();
  const inputId = `${generatedId}-input`;
  const listboxId = `${generatedId}-suggestions`;
  const helperId = `${generatedId}-helper`;
  const errorId = `${generatedId}-error`;
  const preferredLat = hasCoordinates(location) ? location.lat : biasLocation?.lat ?? null;
  const preferredLng = hasCoordinates(location) ? location.lng : biasLocation?.lng ?? null;

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => () => {
    if (blurTimerRef.current !== null) window.clearTimeout(blurTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isFocused) {
      setSuggestions([]);
      setIsLoading(false);
      setActiveIndex(-1);
      return;
    }

    const trimmedValue = inputValue.trim();
    if (trimmedValue.length < 3) {
      setSuggestions([]);
      setIsLoading(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      lastQueryRef.current = trimmedValue;

      try {
        const params = new URLSearchParams({ q: trimmedValue });
        if (preferredLat !== null && preferredLng !== null) {
          params.set("biasLat", preferredLat.toString());
          params.set("biasLng", preferredLng.toString());
        }

        const response = await fetch(`/api/location-search?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as { suggestions?: AddressSuggestion[] } | null;
        if (controller.signal.aborted || lastQueryRef.current !== trimmedValue) return;
        const nextSuggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
        setSuggestions(nextSuggestions);
        setActiveIndex(nextSuggestions.length > 0 ? 0 : -1);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Unable to fetch address suggestions", error);
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted && lastQueryRef.current === trimmedValue) {
          setIsLoading(false);
        }
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [inputValue, isFocused, preferredLat, preferredLng]);

  const helperCoordinates = hasCoordinates(location) ? formatCoordinates(location.lat, location.lng) : null;
  const syncManualLocation = (nextValue: string) => {
    const trimmedValue = nextValue.trim();
    const currentLabel = location.label?.trim() ?? "";

    if (trimmedValue.length === 0) {
      onLocationChange(buildOrganizerLocation({ label: null, source: "manual" }));
      return;
    }

    if (trimmedValue === currentLabel) return;

    onLocationChange(buildOrganizerLocation({ label: trimmedValue, source: "manual" }));
  };

  const selectSuggestion = (suggestion: AddressSuggestion) => {
    setInputValue(suggestion.label);
    onChange(suggestion.label);
    onLocationChange(
      buildOrganizerLocation({
        label: suggestion.label,
        lat: suggestion.lat,
        lng: suggestion.lng,
        source: "autocomplete",
      })
    );
    setSuggestions([]);
    setActiveIndex(-1);
    setIsFocused(false);
  };

  const showSuggestions = isFocused && (suggestions.length > 0 || isLoading);

  return (
    <div className="space-y-1">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Input
          id={inputId}
          type="text"
          value={inputValue}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            syncManualLocation(inputValue);
            blurTimerRef.current = window.setTimeout(() => {
              setIsFocused(false);
              setSuggestions([]);
              setActiveIndex(-1);
            }, 120);
          }}
          onChange={(event) => {
            const nextValue = event.target.value;
            setInputValue(nextValue);
            onChange(nextValue);
          }}
          required={required}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? listboxId : undefined}
          aria-activedescendant={activeIndex >= 0 ? `${generatedId}-option-${activeIndex}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : location.label ? helperId : undefined}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && suggestions.length > 0) {
              event.preventDefault();
              setActiveIndex((current) => (current + 1) % suggestions.length);
            } else if (event.key === "ArrowUp" && suggestions.length > 0) {
              event.preventDefault();
              setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
            } else if (event.key === "Enter" && activeIndex >= 0 && suggestions[activeIndex]) {
              event.preventDefault();
              selectSuggestion(suggestions[activeIndex]);
            } else if (event.key === "Escape") {
              setSuggestions([]);
              setActiveIndex(-1);
            }
          }}
          className={cn(invalid && "border-amber-400 bg-amber-50/50 focus-visible:outline-amber-500")}
        />
        {showSuggestions ? (
          <div id={listboxId} role="listbox" aria-label={`Suggestions pour ${label}`} className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 rounded-md border border-border bg-card shadow-lg">
            {isLoading ? <p role="status" className="px-3 py-2 text-sm text-muted-foreground">Recherche d&apos;adresse...</p> : null}
            {!isLoading
              ? suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.label}-${suggestion.lat}-${suggestion.lng}`}
                    id={`${generatedId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={cn("flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition hover:bg-muted", index === activeIndex && "bg-muted")}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectSuggestion(suggestion)}
                  >
                    <span className="font-medium text-foreground">{suggestion.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {[suggestion.subtitle, formatCoordinates(suggestion.lat, suggestion.lng)].filter(Boolean).join(" • ")}
                    </span>
                  </button>
                ))
              : null}
          </div>
        ) : null}
      </div>
      {location.label ? (
        <div id={helperId} className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {helperCoordinates ? <span>GPS {helperCoordinates}</span> : <span>Adresse libre</span>}
          {location.googleMapsUrl ? (
            <a
              href={location.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline underline-offset-2"
            >
              Ouvrir dans Google Maps
            </a>
          ) : null}
        </div>
      ) : null}
      {invalid ? <p id={errorId} className="text-xs font-medium text-amber-700">Champ manquant</p> : null}
    </div>
  );
}
