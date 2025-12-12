import type { Translations } from "./types";

export const en: Translations = {
  homeHero: {
    heading: "Welcome to TrailPlanner",
    description:
      "Head to the race planner to estimate aid-station timing, fueling targets, and pace for your next race.",
    cta: "Open race planner",
  },
  racePlanner: {
    defaults: {
      aidStationName: "Aid {index}",
      finalBottles: "Final Bottles",
      finish: "Finish",
    },
    units: {
      hourShort: "h",
      minuteShort: "m",
      kilometer: "km",
      meter: "m",
      grams: "g",
      milliliters: "ml",
      milligrams: "mg",
    },
    validation: {
      required: "Required",
      distancePositive: "Distance must be positive",
      raceDistance: "Enter a distance in km",
      paceZero: "Pace cannot be 0",
      speedPositive: "Speed must be positive",
      targetIntake: "Enter grams per hour",
      aidStationMin: "Add at least one aid station",
      nonNegative: "Value cannot be negative",
      paceSecondsRange: "Seconds must be between 0 and 59",
    },
    gpx: {
      errors: {
        noTrackPoints: "No track points found in the GPX file.",
        invalidCoordinates: "Invalid coordinates in track points.",
        unableToImport: "Unable to import GPX file.",
      },
      fallbackAidStation: "Aid station",
    },
    sections: {
      courseProfile: {
        title: "Course profile",
        description: "Elevation by distance with aid stations highlighted. Import a GPX file to populate the profile.",
        empty: "Import a GPX file to see the elevation profile.",
        axisLabel: "Distance (km)",
        ariaLabel: "Course elevation profile",
        speedLabel: "Adjusted speed",
        speedUnit: "km/h",
      },
      raceInputs: {
        title: "Race inputs",
        description: "Adjust distance, pacing, fueling and import GPX data.",
        courseTitle: "Course",
        pacingTitle: "Pacing & fueling",
        fields: {
          raceDistance: "Race distance (km)",
          elevationGain: "D+ (m)",
          paceType: "Pacing input",
          paceMinutes: "Minutes",
          paceSeconds: "Seconds",
          speedKph: "Speed (km/h)",
          uphillEffort: "Uphill effort",
          downhillEffort: "Downhill effort",
          uphillEffortHelp: "Higher effort slows steep climbs more while rewarding smoother grades.",
          downhillEffortHelp: "Higher effort lets you push descents harder while easing off on very steep drops.",
          targetIntakePerHour: "Carbs (g/hr)",
          waterIntakePerHour: "Water (ml/hr)",
          sodiumIntakePerHour: "Sodium (mg/hr)",
        },
        paceOptions: {
          pace: "Pace (min/km)",
          speed: "Speed (km/h)",
        },
      },
      summary: {
        title: "Race needs summary",
        description: "Totals based on your pacing, fueling and course distance.",
        items: {
          duration: "Race duration",
          carbs: "Total carbs",
          water: "Total water",
          sodium: "Total sodium",
        },
        empty: "Add your race distance, pacing and fueling to see the totals you need for the event.",
      },
      aidStations: {
        title: "Aid stations",
        description: "Edit the checkpoints where you plan to refuel.",
        add: "Add station",
        labels: {
          name: "Name",
          distance: "Distance (km)",
        },
        remove: "Remove",
      },
      timeline: {
        title: "Timeline",
        description: "A compact view of where you expect to be on course.",
        empty: "Add your pacing details to preview the course timeline.",
        etaLabel: "ETA",
        distanceWithUnit: "km",
        segmentLabel: "{distance} km segment",
        fuelLabel: "{amount} g fuel",
        waterLabel: "{amount} ml water",
        sodiumLabel: "{amount} mg sodium",
      },
    },
    buttons: {
      importGpx: "Import GPX",
    },
  },
};
