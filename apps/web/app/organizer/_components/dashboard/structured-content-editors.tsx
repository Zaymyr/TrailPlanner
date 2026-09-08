"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../../../../components/ui/button";
import type { OrganizerEventDetails, OrganizerLocation } from "../../../../lib/organizer-dashboard-details";
import type { EditionService, RaceAward, StartWave } from "../../../../lib/organizer-structured-content";
import { AddressAutocompleteField } from "./address-autocomplete-field";
import { NumberField, TextAreaField, TextField } from "./controls";

type Headers = Record<string, string>;

function useRemoteList<T>(url: string | null, key: string, headers: Headers, initial: T[] = []) {
  const [items, setItems] = useState<T[]>(initial);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const saving = useRef(false);
  const itemsRef = useRef(items);
  const dirtyRef = useRef(dirty);
  const headersRef = useRef(headers);
  itemsRef.current = items;
  dirtyRef.current = dirty;
  headersRef.current = headers;
  useEffect(() => {
    setLoaded(false); setDirty(false); setMessage(null); setItems(initial);
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { headers: headersRef.current, cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      const data = await response.json() as Record<string, T[]>;
      setItems(data[key] ?? []); setLoaded(true);
    }).catch(() => { if (!controller.signal.aborted) setMessage("Impossible de charger ces informations."); });
    return () => controller.abort();
  }, [url, key]);
  useEffect(() => () => {
    if (!url || !dirtyRef.current) return;
    void fetch(url, { method: "PUT", headers: { ...headersRef.current, "Content-Type": "application/json" }, body: JSON.stringify({ [key]: itemsRef.current }), keepalive: true });
  }, [url, key]);
  useEffect(() => {
    if (!url || !loaded || !dirty || saving.current) return;
    const timer = window.setTimeout(async () => {
      saving.current = true; setMessage("Enregistrement…");
      try {
        const response = await fetch(url, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ [key]: items }) });
        const data = await response.json().catch(() => null) as Record<string, T[]> | null;
        if (!response.ok) throw new Error();
        setItems(data?.[key] ?? items); setDirty(false); setMessage("Enregistré");
      } catch { setMessage("Certains champs sont incomplets ou invalides."); }
      finally { saving.current = false; }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [dirty, headers, items, key, loaded, url]);
  const update = (next: T[]) => { itemsRef.current=next; dirtyRef.current=true; setItems(next); setDirty(true); setMessage(null); };
  return { items, update, loaded, message };
}

const Select = ({ value, onChange, children }: { value:string; onChange:(value:string)=>void; children:ReactNode }) => (
  <select className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" value={value} onChange={(event)=>onChange(event.target.value)}>{children}</select>
);
const Status = ({ loaded, message }: { loaded:boolean; message:string|null }) => <p className="text-xs text-muted-foreground">{message ?? (loaded ? "Les modifications valides sont enregistrées automatiquement." : "Chargement…")}</p>;

export function EditionServicesEditor({ editionId, headers, enabled, legacy, onLegacyChange }: { editionId:string|null; headers:Headers; enabled:boolean; legacy:OrganizerEventDetails["services"]; onLegacyChange:(details:OrganizerEventDetails["services"])=>void }) {
  const remote=useRemoteList<EditionService>(enabled&&editionId?`/api/organizer/editions/${editionId}/services`:null,"services",headers);
  if(!enabled)return <Locked label="Les services structurés sont inclus dans RaceBook."/>;
  const add=(serviceType:EditionService["serviceType"],description:string|null=null)=>remote.update([...remote.items,{serviceType,name:"",description,address:null,latitude:null,longitude:null,googleMapsUrl:null,websiteUrl:null,phone:null}]);
  const labels={restaurant:"Restaurant",accommodation:"Hébergement",recovery:"Récupération",other:"Autre service"};
  return <div className="space-y-5">
    <div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">Services & alentours</p><p className="text-sm text-muted-foreground">Une fiche par lieu, utilisable dans le RaceBook et sur la carte.</p></div><div className="flex flex-wrap gap-2">{Object.entries(labels).map(([type,label])=><Button key={type} type="button" variant="outline" onClick={()=>add(type as EditionService["serviceType"])}>+ {label}</Button>)}</div></div>
    {remote.items.length===0?<Empty text="Aucun service structuré pour cette édition."/>:<div className="grid gap-4 xl:grid-cols-2">{remote.items.map((item,index)=><article key={item.id??index} className="space-y-3 rounded-xl border border-border bg-background p-4">
      <div className="flex gap-2"><Select value={item.serviceType} onChange={(value)=>remote.update(remote.items.map((x,i)=>i===index?{...x,serviceType:value as EditionService["serviceType"]}:x))}>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select><Button type="button" variant="ghost" onClick={()=>remote.update(remote.items.filter((_,i)=>i!==index))}>Supprimer</Button></div>
      <TextField label="Nom" value={item.name} invalid={!item.name.trim()} onChange={(name)=>remote.update(remote.items.map((x,i)=>i===index?{...x,name}:x))}/>
      <AddressAutocompleteField label="Adresse" value={item.address??""} location={{label:item.address??null,lat:item.latitude??null,lng:item.longitude??null,googleMapsUrl:item.googleMapsUrl??null,source:item.latitude!=null?"autocomplete":null}} onChange={(address)=>remote.update(remote.items.map((x,i)=>i===index?{...x,address}:x))} onLocationChange={(location:OrganizerLocation)=>remote.update(remote.items.map((x,i)=>i===index?{...x,address:location.label,latitude:location.lat,longitude:location.lng,googleMapsUrl:location.googleMapsUrl}:x))} invalid={(item.serviceType==="restaurant"||item.serviceType==="accommodation")&&(!item.address?.trim()||item.latitude==null||item.longitude==null)}/>
      <div className="grid gap-3 md:grid-cols-2"><TextField label="Site web" type="url" value={item.websiteUrl??""} onChange={(websiteUrl)=>remote.update(remote.items.map((x,i)=>i===index?{...x,websiteUrl:websiteUrl||null}:x))}/><TextField label="Téléphone" type="tel" value={item.phone??""} onChange={(phone)=>remote.update(remote.items.map((x,i)=>i===index?{...x,phone:phone||null}:x))}/></div>
      <TextAreaField label="Description" value={item.description??""} onChange={(description)=>remote.update(remote.items.map((x,i)=>i===index?{...x,description:description||null}:x))}/>
    </article>)}</div>}
    <details className="rounded-xl border border-dashed border-border p-4"><summary className="cursor-pointer font-semibold">Contenu historique</summary><p className="my-3 text-sm text-muted-foreground">Le texte reste conservé. Une conversion crée un brouillon sans effacer la source.</p>{([['accommodations','Hébergements','accommodation'],['restaurants','Restaurants','restaurant'],['recovery','Récupération','recovery']] as const).map(([key,label,type])=><div key={key} className="mb-3"><TextAreaField label={label} value={legacy[key]??""} onChange={(value)=>onLegacyChange({...legacy,[key]:value||null})}/>{legacy[key]?<Button type="button" variant="outline" onClick={()=>add(type,legacy[key])}>Préremplir une fiche</Button>:null}</div>)}<TextAreaField label="Informations accompagnants" value={legacy.supporters??""} onChange={(value)=>onLegacyChange({...legacy,supporters:value||null})}/><TextAreaField label="Note générale" value={legacy.note??""} onChange={(value)=>onLegacyChange({...legacy,note:value||null})}/>{legacy.partners?<p className="text-xs text-muted-foreground">Partenaires historiques : {legacy.partners}</p>:null}{legacy.lastMinuteMessage?<p className="text-xs text-muted-foreground">Ancien message dernière minute : {legacy.lastMinuteMessage}</p>:null}</details>
    <Status loaded={remote.loaded} message={remote.message}/>
  </div>;
}

export function StartWavesEditor({
  raceId,
  headers,
  enabled,
  onSummaryChange,
}: {
  raceId: string | null;
  headers: Headers;
  enabled: boolean;
  onSummaryChange?: (summary: { raceId: string; count: number; referenceStartTime: string | null }) => void;
}) {
  const remote=useRemoteList<StartWave>(enabled&&raceId?`/api/organizer/races/${raceId}/start-waves`:null,"startWaves",headers);
  const referenceStartTime = remote.items.map((item) => item.startTime).filter(Boolean).sort()[0] ?? null;
  useEffect(() => {
    if (!raceId || !remote.loaded) return;
    onSummaryChange?.({ raceId, count: remote.items.length, referenceStartTime });
  }, [onSummaryChange, raceId, referenceStartTime, remote.items.length, remote.loaded]);
  if(!enabled)return <Locked label="Les SAS de départ sont inclus dans RaceBook."/>;
  const patch=(index:number,next:Partial<StartWave>)=>remote.update(remote.items.map((x,i)=>i===index?{...x,...next}:x));
  return <div className="space-y-4"><div className="flex justify-between"><div><p className="font-semibold">SAS de départ</p><p className="text-sm text-muted-foreground">Le premier horaire devient l’heure de départ de référence.</p></div><Button type="button" variant="outline" onClick={()=>remote.update([...remote.items,{name:`SAS ${remote.items.length+1}`,startTime:"08:00",eligibilityType:"all",eligibilityNote:null}])}>Ajouter un SAS</Button></div>
    {remote.items.length===0?<Empty text="Aucun SAS."/>:remote.items.map((item,index)=><article key={item.id??index} className="space-y-3 rounded-xl border border-border p-4"><div className="grid gap-3 md:grid-cols-[2fr_1fr_2fr_auto]"><TextField label="Nom" value={item.name} onChange={(name)=>patch(index,{name})}/><TextField label="Départ" type="time" value={item.startTime} onChange={(startTime)=>patch(index,{startTime})}/><div><p className="mb-1 text-sm font-medium">Critère</p><Select value={item.eligibilityType} onChange={(value)=>patch(index,{eligibilityType:value as StartWave["eligibilityType"]})}><option value="all">Tous</option><option value="bib_range">Dossards</option><option value="estimated_finish_time">Temps objectif</option><option value="pace">Allure</option><option value="custom">Règle libre</option></Select></div><Button type="button" variant="ghost" onClick={()=>remote.update(remote.items.filter((_,i)=>i!==index))}>Supprimer</Button></div><WaveCriterion item={item} patch={(next)=>patch(index,next)}/></article>)}<Status loaded={remote.loaded} message={remote.message}/></div>;
}
function WaveCriterion({item,patch}:{item:StartWave;patch:(next:Partial<StartWave>)=>void}){if(item.eligibilityType==="all")return null;if(item.eligibilityType==="custom")return <TextAreaField label="Règle d’accès" value={item.eligibilityNote??""} onChange={(eligibilityNote)=>patch({eligibilityNote})}/>;const finish=item.eligibilityType==="estimated_finish_time",pace=item.eligibilityType==="pace";const min=finish?item.finishMinutesMin:pace?item.paceSecondsMin:item.bibNumberMin;const max=finish?item.finishMinutesMax:pace?item.paceSecondsMax:item.bibNumberMax;const label=finish?"Minutes de course":pace?"Secondes par km":"Numéro de dossard";return <div className="grid gap-3 md:grid-cols-2"><NumberField label={`${label} minimum`} value={min??0} onChange={(value)=>patch(finish?{finishMinutesMin:value}:pace?{paceSecondsMin:value}:{bibNumberMin:value})}/><NumberField label={`${label} maximum`} value={max??0} onChange={(value)=>patch(finish?{finishMinutesMax:value}:pace?{paceSecondsMax:value}:{bibNumberMax:value})}/></div>}

export function AwardsEditor({raceId,headers,enabled}:{raceId:string|null;headers:Headers;enabled:boolean}){const remote=useRemoteList<RaceAward>(enabled&&raceId?`/api/organizer/races/${raceId}/awards`:null,"awards",headers);if(!enabled)return <Locked label="Les podiums sont inclus dans RaceBook."/>;const patch=(index:number,next:Partial<RaceAward>)=>remote.update(remote.items.map((x,i)=>i===index?{...x,...next}:x));const labels:{[key:string]:string}={scratch:"Scratch",u18:"U18",u20:"U20",u23:"U23",senior:"Senior",master:"Master",custom:"Personnalisée"};return <div className="space-y-4"><div className="flex justify-between"><div><p className="font-semibold">Podiums & récompenses</p><p className="text-sm text-muted-foreground">Définis qui est récompensé et à quelle heure.</p></div><Button type="button" variant="outline" onClick={()=>remote.update([...remote.items,{categoryKey:"scratch",categoryLabel:"Scratch",audience:"mixed",placeFrom:1,placeTo:3,podiumTime:"15:00",podiumLocation:null,rewardNote:null}])}>Ajouter une catégorie</Button></div>{remote.items.length===0?<Empty text="Aucun podium programmé."/>:remote.items.map((item,index)=><article key={item.id??index} className="space-y-3 rounded-xl border border-border p-4"><div className="grid gap-3 lg:grid-cols-[1.2fr_1.5fr_1fr_.7fr_.7fr_1fr_auto]"><Select value={item.categoryKey} onChange={(value)=>patch(index,{categoryKey:value as RaceAward["categoryKey"],categoryLabel:labels[value]})}>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select><TextField label="Libellé" value={item.categoryLabel} onChange={(categoryLabel)=>patch(index,{categoryLabel})}/><Select value={item.audience} onChange={(value)=>patch(index,{audience:value as RaceAward["audience"]})}><option value="mixed">Mixte</option><option value="women">Femmes</option><option value="men">Hommes</option></Select><NumberField label="Place de" value={item.placeFrom} onChange={(placeFrom)=>patch(index,{placeFrom})}/><NumberField label="Place à" value={item.placeTo} onChange={(placeTo)=>patch(index,{placeTo})}/><TextField label="Podium" type="time" value={item.podiumTime} onChange={(podiumTime)=>patch(index,{podiumTime})}/><Button type="button" variant="ghost" onClick={()=>remote.update(remote.items.filter((_,i)=>i!==index))}>Supprimer</Button></div><div className="grid gap-3 md:grid-cols-2"><TextField label="Lieu du podium" value={item.podiumLocation??""} onChange={(podiumLocation)=>patch(index,{podiumLocation:podiumLocation||null})}/><TextField label="Récompense / note" value={item.rewardNote??""} onChange={(rewardNote)=>patch(index,{rewardNote:rewardNote||null})}/></div></article>)}<Status loaded={remote.loaded} message={remote.message}/></div>}

const Empty=({text}:{text:string})=><p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{text}</p>;
const Locked=({label}:{label:string})=><div className="rounded-lg border border-brand/40 bg-brand/5 p-5"><p className="font-semibold">{label}</p><p className="mt-2 text-sm text-muted-foreground">Active RaceBook sur cette édition pour compléter ces informations.</p></div>;
