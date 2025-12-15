export type Locale = "en" | "fr";

export const resourcePageSlugs = [
  "trail-nutrition-planner",
  "ultra-trail-fueling",
  "ravitaillement-trail",
  "hydration-trail-running",
] as const;

export type ResourcePageSlug = (typeof resourcePageSlugs)[number];

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
      invalidPlannerState: string;
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
      speedLabel: string;
      speedUnit: string;
    };
    raceInputs: {
      title: string;
      description: string;
      courseTitle: string;
      pacingTitle: string;
      nutritionTitle: string;
      fields: {
        raceDistance: string;
        elevationGain: string;
        paceType: string;
        paceMinutes: string;
        paceSeconds: string;
        speedKph: string;
        uphillEffort: string;
        uphillEffortHelp: string;
        downhillEffort: string;
        downhillEffortHelp: string;
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
      feedback: {
        title: string;
        subject: string;
        detail: string;
        submit: string;
        open: string;
        success: string;
        error: string;
        required: string;
      };
    };
    gels: {
      title: string;
      description: string;
      empty: string;
      linkLabel: string;
      nutrition: string;
      countLabel: string;
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
      printView: {
        title: string;
        description: string;
        columns: {
          checkpoint: string;
          distance: string;
          segment: string;
          eta: string;
          segmentTime: string;
          fuel: string;
          water: string;
          sodium: string;
        };
      };
    };
  };
  buttons: {
    importGpx: string;
    exportGpx: string;
    printPlan: string;
  };
  account: {
    title: string;
    description: string;
    auth: {
      email: string;
      password: string;
      create: string;
      signIn: string;
      signOut: string;
      status: string;
      signedInAs: string;
    };
    plans: {
      title: string;
      nameLabel: string;
      defaultName: string;
      save: string;
      saving: string;
      refresh: string;
      load: string;
      empty: string;
      updatedAt: string;
    };
    messages: {
      accountCreated: string;
      signedIn: string;
      savedPlan: string;
      loadedPlan: string;
    };
    errors: {
      missingSession: string;
      saveFailed: string;
      loadFailed: string;
      authFailed: string;
      fetchFailed: string;
    };
  };
  mobileNav: {
    importGpx: string;
    timeline: string;
    pacing: string;
    intake: string;
  };
};

export type LandingPageTranslations = {
  heading: string;
  subheading: string;
  plannerCta: string;
  plannerDescription: string;
  cardsHeading: string;
  cardCta: string;
  cards: Array<{
    slug: ResourcePageSlug;
    title: string;
    description: string;
  }>;
};

export type ResourcePageCopy = {
  title: string;
  intro: string;
  benefitsHeading: string;
  benefits: string[];
  ctaLabel: string;
  ctaNote: string;
  relatedHeading: string;
  plannerLabel: string;
};

export type Translations = {
  homeHero: HomeHeroTranslations;
  racePlanner: RacePlannerTranslations;
  landing: LandingPageTranslations;
  resourcePages: Record<ResourcePageSlug, ResourcePageCopy>;
};

