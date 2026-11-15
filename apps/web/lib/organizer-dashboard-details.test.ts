import { describe, expect, it } from "vitest";

import { buildOrganizerLocation } from "./location-utils";
import {
  buildRunnerOrganizerDetails,
  defaultOrganizerEventDetails,
  defaultOrganizerRaceDetails,
  hasOrganizerEquipmentLabelPrefix,
  parseOrganizerEventDetails,
  parseOrganizerAidStationDetails,
  parseOrganizerRaceDetails,
} from "./organizer-dashboard-details";

describe("parseOrganizerRaceDetails", () => {
  it("defaults both RaceBook GPX visuals to visible and preserves organizer choices", () => {
    expect(parseOrganizerRaceDetails({}).gpxDisplay).toEqual({
      showRoute: true,
      showElevationProfile: true,
    });
    expect(parseOrganizerRaceDetails({ gpxDisplay: { showRoute: false, showElevationProfile: true } }).gpxDisplay).toEqual({
      showRoute: false,
      showElevationProfile: true,
    });
  });

  it("keeps legacy schedules compatible and normalizes structured finish cutoffs", () => {
    expect(parseOrganizerRaceDetails({ schedule: { finishCutoffTime: "9h" } }).schedule).toMatchObject({
      finishCutoffTime: "09:00",
      finishCutoffDayOffset: null,
    });
    expect(parseOrganizerRaceDetails({ schedule: { finishCutoffTime: "03:00", finishCutoffDayOffset: 2 } }).schedule).toMatchObject({
      finishCutoffTime: "03:00",
      finishCutoffDayOffset: 2,
    });
  });

  it("parses structured runner information alongside historical text", () => {
    const details = parseOrganizerRaceDetails({ runnerInfo: {
      startArea: "Ancienne zone",
      startAreaDetails: { location: { label: "Place du village" }, opensAt: "6h", note: "Entrée nord" },
      briefingDetails: { date: "2026-11-15", time: "06:30", mandatory: true },
      rulesDetails: { regulationUrl: "race.example/rules", keyRules: { polesAllowed: "partial", cupRequired: true } },
    }, mandatoryEquipment: { checkpoints: ["start", "course"], shortNote: "Contrôle aléatoire" } });
    expect(details.runnerInfo.startArea).toBe("Ancienne zone");
    expect(details.runnerInfo.startAreaDetails).toMatchObject({ opensAt: "06:00", location: { label: "Place du village" } });
    expect(details.runnerInfo.rulesDetails.keyRules).toMatchObject({ polesAllowed: "partial", cupRequired: true });
    expect(details.mandatoryEquipment.checkpoints).toEqual(["start", "course"]);
  });
});

describe("parseOrganizerAidStationDetails", () => {
  it("normalizes standalone legacy clocks without discarding rich text", () => {
    expect(parseOrganizerAidStationDetails({ cutoffTime: "9h" })).toMatchObject({ cutoffTime: "09:00", cutoffDayOffset: null });
    expect(parseOrganizerAidStationDetails({ cutoffTime: "dimanche vers 9h" }).cutoffTime).toBe("dimanche vers 9h");
    expect(parseOrganizerAidStationDetails({ cutoffTime: "03:00", cutoffDayOffset: 1 })).toMatchObject({ cutoffTime: "03:00", cutoffDayOffset: 1 });
  });

  it("defaults structured station rules for historical JSON and accepts complete data", () => {
    expect(parseOrganizerAidStationDetails({ organizerNote: "Ancien texte" })).toMatchObject({
      amenities: { toilets: false, shelter: false, medical: false, hotDrinks: false, hotFood: false },
      maxStopMinutes: null,
      supportersAccess: null,
      note: null,
      organizerNote: "Ancien texte",
    });
    expect(parseOrganizerAidStationDetails({ amenities: { toilets: true, shelter: true }, maxStopMinutes: 20, supportersAccess: "restricted", note: "Entrée côté nord" })).toMatchObject({
      amenities: { toilets: true, shelter: true, medical: false, hotDrinks: false, hotFood: false },
      maxStopMinutes: 20,
      supportersAccess: "restricted",
      note: "Entrée côté nord",
    });
  });
});

describe("parseOrganizerEventDetails", () => {
  it("keeps legacy access text and parses structured parking and shuttle lines", () => {
    const details = parseOrganizerEventDetails({ access: {
      officialParkings: "Ancien parking mairie",
      shuttles: "Ancienne navette",
      parkings: [{ id: "p1", name: "Parking Nord", location: { label: "1 rue du Col" }, capacity: 120, paid: false, note: "Ouverture 5h" }],
      shuttleLines: [{ id: "s1", from: { label: "Gare" }, to: { label: "Départ" }, days: ["2026-11-15"], startTime: "6h", endTime: "09:30", frequencyMinutes: 15, bookingUrl: "booking.example/shuttle", free: true, note: null }],
    } });

    expect(details.access.officialParkings).toBe("Ancien parking mairie");
    expect(details.access.parkings[0]).toMatchObject({ name: "Parking Nord", capacity: 120, paid: false });
    expect(details.access.shuttleLines[0]).toMatchObject({ startTime: "06:00", frequencyMinutes: 15, free: true, bookingUrl: "https://booking.example/shuttle" });
  });

  it("normalizes the event links and emergency contact", () => {
    const details = parseOrganizerEventDetails({
      officialWebsiteUrl: "https://grand-trail.example",
      instagramUrl: "https://www.instagram.com/grandtrail",
      facebookUrl: "https://www.facebook.com/grandtrail",
      emergencyContact: { name: "PC course", phone: "06 12 34 56 78" },
    });

    expect(details.officialWebsiteUrl).toBe("https://grand-trail.example");
    expect(details.instagramUrl).toBe("https://www.instagram.com/grandtrail");
    expect(details.facebookUrl).toBe("https://www.facebook.com/grandtrail");
    expect(details.emergencyContact).toEqual({ name: "PC course", phone: "+33 6 12 34 56 78" });
  });

  it("adds HTTPS to social links copied without a protocol", () => {
    const details = parseOrganizerEventDetails({
      instagramUrl: "www.instagram.com/grandtrail/",
      facebookUrl: "facebook.com/grandtrail?locale=fr_FR",
    });

    expect(details.instagramUrl).toBe("https://www.instagram.com/grandtrail/");
    expect(details.facebookUrl).toBe("https://facebook.com/grandtrail?locale=fr_FR");
  });

  it("normalizes French international emergency numbers", () => {
    const details = parseOrganizerEventDetails({
      emergencyContact: { name: null, phone: "0033 (0)6.12.34.56.78" },
    });

    expect(details.emergencyContact.phone).toBe("+33 6 12 34 56 78");
  });

  it("keeps short emergency numbers intact", () => {
    const details = parseOrganizerEventDetails({ emergencyContact: { phone: "112" } });

    expect(details.emergencyContact.phone).toBe("112");
  });

  it("preserves explicit third-party pickup conditions", () => {
    const details = parseOrganizerEventDetails({
      bibPickup: {
        thirdPartyPickupAllowed: true,
        thirdPartyPickupConditions: "Présenter la pièce d’identité du coureur.",
      },
    });

    expect(details.bibPickup.thirdPartyPickupConditions).toBe("Présenter la pièce d’identité du coureur.");
  });

  it("parses structured bib documents while preserving historical text", () => {
    const details = parseOrganizerEventDetails({ bibPickup: {
      requiredDocuments: "Ancienne liste",
      requiredDocumentKinds: ["id_card", "registration_qr"],
      thirdPartyPickupAllowed: true,
      thirdPartyPickupConditions: "Anciennes conditions",
      thirdPartyDocumentKinds: ["id_copy", "proxy_letter"],
    } });
    expect(details.bibPickup.requiredDocumentKinds).toEqual(["id_card", "registration_qr"]);
    expect(details.bibPickup.thirdPartyDocumentKinds).toEqual(["id_copy", "proxy_letter"]);
    expect(details.bibPickup.requiredDocuments).toBe("Ancienne liste");
  });

  it("matches equipment suggestions against accent-insensitive label prefixes", () => {
    const items = [
      { label: "Téléphone chargé avec numéro du PC course" },
      { label: "Réserve d’eau de 1 litre" },
    ];

    expect(hasOrganizerEquipmentLabelPrefix(items, "Telephone charge")).toBe(true);
    expect(hasOrganizerEquipmentLabelPrefix(items, "Réserve d'eau")).toBe(true);
    expect(hasOrganizerEquipmentLabelPrefix(items, "Lampe frontale")).toBe(false);
  });
});

describe("buildRunnerOrganizerDetails", () => {
  it("keeps event access locations when the race override is empty", () => {
    const eventDetails = {
      ...defaultOrganizerEventDetails,
      access: {
        ...defaultOrganizerEventDetails.access,
        startAddress: "Parking de la mairie",
        startLocation: buildOrganizerLocation({
          label: "Parking de la mairie, Annecy",
          lat: 45.899247,
          lng: 6.129384,
          source: "autocomplete",
        }),
      },
    };

    const runnerDetails = buildRunnerOrganizerDetails(eventDetails, defaultOrganizerRaceDetails);

    expect(runnerDetails.access.startAddress).toBe("Parking de la mairie");
    expect(runnerDetails.access.startLocation.label).toBe("Parking de la mairie, Annecy");
    expect(runnerDetails.access.startLocation.lat).toBe(45.899247);
  });

  it("lets a race override event access locations with its own geocoded point", () => {
    const eventDetails = {
      ...defaultOrganizerEventDetails,
      access: {
        ...defaultOrganizerEventDetails.access,
        finishAddress: "Centre ville",
        finishLocation: buildOrganizerLocation({
          label: "Centre ville, Annecy",
          lat: 45.900688,
          lng: 6.129289,
          source: "autocomplete",
        }),
      },
    };

    const raceDetails = {
      ...defaultOrganizerRaceDetails,
      access: {
        ...defaultOrganizerRaceDetails.access,
        overrideEnabled: true,
        finishAddress: "Ligne d'arrivée format 80K",
        finishLocation: buildOrganizerLocation({
          label: "Ligne d'arrivée format 80K, Annecy",
          lat: 45.901111,
          lng: 6.130222,
          source: "autocomplete",
        }),
      },
    };

    const runnerDetails = buildRunnerOrganizerDetails(eventDetails, raceDetails);

    expect(runnerDetails.access.finishAddress).toBe("Ligne d'arrivée format 80K");
    expect(runnerDetails.access.finishLocation.label).toBe("Ligne d'arrivée format 80K, Annecy");
    expect(runnerDetails.access.finishLocation.lng).toBe(6.130222);
  });

  it("inherits event access until the format override is explicitly enabled", () => {
    const eventDetails = {
      ...defaultOrganizerEventDetails,
      access: { ...defaultOrganizerEventDetails.access, startAddress: "Départ commun" },
    };
    const raceDetails = {
      ...defaultOrganizerRaceDetails,
      access: { ...defaultOrganizerRaceDetails.access, overrideEnabled: false, startAddress: "Départ format" },
    };

    expect(buildRunnerOrganizerDetails(eventDetails, raceDetails).access.startAddress).toBe("Départ commun");
    expect(
      buildRunnerOrganizerDetails(eventDetails, {
        ...raceDetails,
        access: { ...raceDetails.access, overrideEnabled: true },
      }).access.startAddress
    ).toBe("Départ format");
  });

  it("preserves legacy format access values without an override flag", () => {
    const eventDetails = {
      ...defaultOrganizerEventDetails,
      access: { ...defaultOrganizerEventDetails.access, startAddress: "Départ commun", officialParkings: "Parking commun" },
    };
    const raceDetails = {
      ...defaultOrganizerRaceDetails,
      access: { ...defaultOrganizerRaceDetails.access, overrideEnabled: undefined, startAddress: "Départ historique" },
    };

    const access = buildRunnerOrganizerDetails(eventDetails, raceDetails).access;

    expect(access.startAddress).toBe("Départ historique");
    expect(access.officialParkings).toBe("Parking commun");
  });

  it("uses format equipment only when its explicit override is enabled", () => {
    const eventDetails = {
      ...defaultOrganizerEventDetails,
      mandatoryEquipment: {
        ...defaultOrganizerEventDetails.mandatoryEquipment,
        items: [{ id: "event-item", label: "Couverture", required: true, cold: false, heat: false, note: null }],
      },
    };
    const formatEquipment = {
      ...defaultOrganizerRaceDetails,
      mandatoryEquipment: {
        ...defaultOrganizerRaceDetails.mandatoryEquipment,
        items: [{ id: "format-item", label: "Lampe", required: true, cold: false, heat: false, note: null }],
      },
    };

    expect(buildRunnerOrganizerDetails(eventDetails, formatEquipment).equipment.items.map((item) => item.label)).toEqual(["Couverture"]);
    expect(
      buildRunnerOrganizerDetails(eventDetails, {
        ...formatEquipment,
        mandatoryEquipment: { ...formatEquipment.mandatoryEquipment, overrideEnabled: true },
      }).equipment.items.map((item) => item.label)
    ).toEqual(["Lampe"]);
  });
});
