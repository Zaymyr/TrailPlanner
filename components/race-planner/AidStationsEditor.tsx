"use client";

import type { FieldArrayWithId, UseFormRegister } from "react-hook-form";
import type { RacePlannerTranslations } from "../../locales/types";
import type { FormValues } from "../../app/(coach)/race-planner/types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";

export type AidStationsEditorProps = {
  copy: RacePlannerTranslations["sections"]["aidStations"];
  fields: FieldArrayWithId<FormValues, "aidStations", "id">[];
  register: UseFormRegister<FormValues>;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

export function AidStationsEditor({ copy, fields, register, onAdd, onRemove }: AidStationsEditorProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{copy.title}</CardTitle>
          <p className="text-sm text-slate-400">{copy.description}</p>
        </div>
        <Button type="button" variant="outline" onClick={onAdd}>
          {copy.add}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="grid grid-cols-[1.2fr,0.8fr,auto] items-end gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor={`aidStations.${index}.name`}>{copy.labels.name}</Label>
              <Input id={`aidStations.${index}.name`} type="text" {...register(`aidStations.${index}.name` as const)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`aidStations.${index}.distanceKm`}>{copy.labels.distance}</Label>
              <Input
                id={`aidStations.${index}.distanceKm`}
                type="number"
                step="0.5"
                className="max-w-[140px]"
                {...register(`aidStations.${index}.distanceKm` as const, { valueAsNumber: true })}
              />
            </div>
            <Button type="button" variant="ghost" onClick={() => onRemove(index)}>
              {copy.remove}
            </Button>
          </div>
        ))}
        <Button type="button" className="w-full" onClick={onAdd}>
          {copy.add}
        </Button>
      </CardContent>
    </Card>
  );
}
