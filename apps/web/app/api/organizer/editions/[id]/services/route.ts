import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withSecurityHeaders } from "../../../../../../lib/http";
import { jsonError, requireEventOrganizer, requireOrganizerAuth, serviceHeaders, uuidParamSchema } from "../../../../../../lib/organizer";
import { isOrganizerEditionModuleSelected } from "../../../../../../lib/organizer-module-settings";
import { editionServicesPayloadSchema, mapEditionServicePayload } from "../../../../../../lib/organizer-structured-content";
import { invalidateRacebookCache } from "../../../../../../lib/racebook-cache";

const rowSchema = z.object({ id:z.string().uuid(), service_type:z.string(), name:z.string(), description:z.string().nullable(), address:z.string().nullable(), latitude:z.number().nullable(), longitude:z.number().nullable(), google_maps_url:z.string().nullable(), website_url:z.string().nullable(), phone:z.string().nullable(), order_index:z.number() });
const mapRow = (r:z.infer<typeof rowSchema>) => ({ id:r.id, serviceType:r.service_type, name:r.name, description:r.description, address:r.address, latitude:r.latitude, longitude:r.longitude, googleMapsUrl:r.google_maps_url, websiteUrl:r.website_url, phone:r.phone });

async function authorize(request: NextRequest, id: string) {
  const auth=await requireOrganizerAuth(request); if("error" in auth) return auth;
  const response=await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${id}&select=event_id&limit=1`,{headers:serviceHeaders(auth.serviceConfig,""),cache:"no-store"});
  if(!response.ok) return {error:jsonError("Unable to load edition.",502)};
  const edition=z.array(z.object({event_id:z.string().uuid()})).parse(await response.json())[0]; if(!edition) return {error:jsonError("Edition not found.",404)};
  const organizer=await requireEventOrganizer(auth.serviceConfig,auth.user,edition.event_id); if(organizer!==true) return {error:organizer.error};
  if(!(await isOrganizerEditionModuleSelected(auth.serviceConfig,id,"services"))) return {error:jsonError("Activez la section Services pour modifier son brouillon.",403)};
  return auth;
}
async function load(config: Parameters<typeof serviceHeaders>[0], id:string){const r=await fetch(`${config.supabaseUrl}/rest/v1/race_edition_services?edition_id=eq.${id}&select=id,service_type,name,description,address,latitude,longitude,google_maps_url,website_url,phone,order_index&order=service_type.asc,order_index.asc`,{headers:serviceHeaders(config,""),cache:"no-store"});if(!r.ok)throw new Error(await r.text());return z.array(rowSchema).parse(await r.json()).map(mapRow)}
export async function GET(request:NextRequest,{params}:{params:{id?:string}}){const p=uuidParamSchema.safeParse(params);if(!p.success)return jsonError("Invalid edition id.",400);const auth=await authorize(request,p.data.id);if("error" in auth)return auth.error;try{return withSecurityHeaders(NextResponse.json({services:await load(auth.serviceConfig,p.data.id)}))}catch{return jsonError("Unable to load services.",502)}}
export async function PUT(request:NextRequest,{params}:{params:{id?:string}}){const p=uuidParamSchema.safeParse(params);if(!p.success)return jsonError("Invalid edition id.",400);const auth=await authorize(request,p.data.id);if("error" in auth)return auth.error;const body=editionServicesPayloadSchema.safeParse(await request.json().catch(()=>null));if(!body.success)return jsonError(body.error.issues[0]?.message??"Invalid services.",400);const response=await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/rpc/replace_race_edition_services`,{method:"POST",headers:serviceHeaders(auth.serviceConfig),body:JSON.stringify({p_edition_id:p.data.id,p_items:body.data.services.map(mapEditionServicePayload)}),cache:"no-store"});if(!response.ok)return jsonError("Unable to save services.",502);const services=z.array(rowSchema).parse(await response.json()).map(mapRow);await invalidateRacebookCache({editionId:p.data.id});return withSecurityHeaders(NextResponse.json({services}))}
