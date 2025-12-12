export type Locale = "en" | "fr";

export type HomeHeroTranslations = {
  heading: string;
  description: string;
  cta: string;
};

export type RacePlannerTranslations = {
  defaults: {
    aidStationName: string;
    finalBottles: string;
    finish: string;
  };
  units: {
    hourShort: string;
    minuteShort: string;
    kilometer: string;
    meter: string;
    grams: string;
    milliliters: string;
    milligrams: string;
  };
  validation: {
    required: string;
    distancePositive: string;
    raceDistance: string;
    paceZero: string;
    speedPositive: string;
    targetIntake: string;
    aidStationMin: string;
    nonNegative: string;
    paceSecondsRange: string;
  };
  gpx: {
    errors: {
      noTrackPoints: string;
      invalidCoordinates: string;
      unableToImport: string;
    };
    fallbackAidStation: string;
  };
  sections: {
    courseProfile: {
      title: string;
      description: string;
      empty: string;
      axisLabel: string;
      ariaLabel: string;
    };
    raceInputs: {
      title: string;
      description: string;
      courseTitle: string;
      pacingTitle: string;
      fields: {
        raceDistance: string;
        elevationGain: string;
        paceType: string;
        paceMinutes: string;
        paceSeconds: string;
        speedKph: string;
        uphillEffort: string;
        uphillEffortHelp: string;
        targetIntakePerHour: string;
        waterIntakePerHour: string;
        sodiumIntakePerHour: string;
      };
      paceOptions: {
        pace: string;
        speed: string;
      };
    };
    summary: {
      title: string;
      description: string;
      items: {
        duration: string;
        carbs: string;
        water: string;
        sodium: string;
      };
      empty: string;
    };
    aidStations: {
      title: string;
      description: string;
      add: string;
      labels: {
        name: string;
        distance: string;
      };
      remove: string;
    };
    timeline: {
      title: string;
      description: string;
      empty: string;
      etaLabel: string;
      distanceWithUnit: string;
      segmentLabel: string;
      fuelLabel: string;
      waterLabel: string;
      sodiumLabel: string;
    };
  };
  buttons: {
    importGpx: string;
  };
};

export type Translations = {
  homeHero: HomeHeroTranslations;
  racePlanner: RacePlannerTranslations;
};
