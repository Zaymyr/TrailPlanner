import { describe, expect, it } from "vitest";
import { countVisiblePrimaryTabs, formatRacebookDateRange, getRacebookAction, getRacebookActionContext, reconcileTab, resolveServicePresentation, visibleSponsorIndexes } from "./presentation";

describe("shared RaceBook presentation helpers",()=>{
  it("formats a multi-day event range",()=>expect(formatRacebookDateRange("2026-09-04","2026-09-06","fr")).toContain("–"));
  it("resolves service distance and directions fallback",()=>{const result=resolveServicePresentation({id:"s",serviceType:"restaurant",name:"Refuge",description:null,address:"Col",latitude:45.1,longitude:6.1,googleMapsUrl:null,websiteUrl:null,phone:null,orderIndex:0},{lat:45,lng:6});expect(result.distanceKm).toBeGreaterThan(0);expect(result.directionsUrl).toBe("https://www.google.com/maps/dir/?api=1&destination=45.1,6.1")});
  it("keeps the historical analytics action categories",()=>{expect(getRacebookAction("official")).toBe("official_website_opened");expect(getRacebookAction("service_directions_s")).toBe("service_directions");expect(getRacebookAction("service_website_s")).toBe("service_website");expect(getRacebookAction("service_phone_s")).toBeUndefined();expect(getRacebookAction("emergency")).toBe("emergency_call_started")});
  it("keeps service analytics context bounded to its type",()=>expect(getRacebookActionContext("service_directions_uuid-1",[{id:"uuid-1",serviceType:"restaurant"}])).toBe("restaurant"));
  it("reconciles unavailable tabs",()=>expect(reconcileTab("gear",["course","access"] as const,"course")).toBe("course"));
  it("rotates one sponsor but exposes every sponsor with reduced motion",()=>{expect(visibleSponsorIndexes(3,4,false)).toEqual([1]);expect(visibleSponsorIndexes(3,4,true)).toEqual([0,1,2])});
  it("counts only visible primary tabs",()=>{expect(countVisiblePrimaryTabs({modules:{equipment:true,bibPickup:true,access:true,services:true,branding:true,sponsors:true,aidStations:true,startWaves:true,awards:true,relay:true,officialProducts:true},data:{editionServices:[],legacyServices:{supporters:null,accommodations:null,restaurants:null,recovery:null,partners:null,lastMinuteMessage:null,note:null}}} as never)).toBe(4)});
});
