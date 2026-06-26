"use client";

import { useEffect, useRef, useState } from "react";

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
  const lastQueryRef = useRef("");

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (!isFocused) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const trimmedValue = inputValue.trim();
    if (trimmedValue.length < 3) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      lastQueryRef.current = trimmedValue;

      try {
        const params = new URLSearchParams({ q: trimmedValue });
        const preferredLocation = hasCoordinates(location) ? location : biasLocation;

        if (
          preferredLocation &&
          preferredLocation.lat !== null &&
          preferredLocation.lng !== null
        ) {
          params.set("biasLat", preferredLocation.lat.toString());
          params.set("biasLng", preferredLocation.lng.toString());
        }

        const response = await fetch(`/api/location-search?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as { suggestions?: AddressSuggestion[] } | null;
        if (controller.signal.aborted || lastQueryRef.current !== trimmedValue) return;
        setSuggestions(Array.isArray(payload?.suggestions) ? payload.suggestions : []);
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
  }, [inputValue, isFocused]);

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

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type="text"
          value={inputValue}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            syncManualLocation(inputValue);
            window.setTimeout(() => {
              setIsFocused(false);
              setSuggestions([]);
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
          className={cn(invalid && "border-amber-400 bg-amber-50/50 focus-visible:outline-amber-500")}
        />
        {isFocused && (suggestions.length > 0 || isLoading) ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 rounded-md border border-border bg-card shadow-lg">
            {isLoading ? <p className="px-3 py-2 text-sm text-muted-foreground">Recherche d&apos;adresse...</p> : null}
            {!isLoading
              ? suggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.label}-${suggestion.lat}-${suggestion.lng}`}
                    type="button"
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition hover:bg-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
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
                      setIsFocused(false);
                    }}
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
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
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
      {invalid ? <p className="text-xs font-medium text-amber-700">Champ manquant</p> : null}
    </div>
  );
}
