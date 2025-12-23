export type Locale = "en" | "fr";

export const resourcePageSlugs = [
  "trail-nutrition-planner",
  "ultra-trail-fueling",
  "ravitaillement-trail",
  "hydration-trail-running",
] as const;

export type ResourcePageSlug = (typeof resourcePageSlugs)[number];

export type AuthSharedTranslations = {
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  passwordRequirement: string;
  emailInvalid: string;
  genericError: string;
};

export type SignUpTranslations = {
  title: string;
  description: string;
  fullNameLabel: string;
  fullNamePlaceholder: string;
  confirmPasswordLabel: string;
  confirmPasswordPlaceholder: string;
  submit: string;
  submitting: string;
  success: string;
  pendingEmail: string;
  error: string;
  mismatchError: string;
  fullNameRequirement: string;
};

export type SignInTranslations = {
  title: string;
  description: string;
  submit: string;
  submitting: string;
  success: string;
  error: string;
};

export type AuthTranslations = {
  shared: AuthSharedTranslations;
  signUp: SignUpTranslations;
  signIn: SignInTranslations;
};

export type HomeHeroTranslations = {
  heading: string;
  description: string;
  cta: string;
};

export type RacePlannerTranslations = {
  defaults: {
    aidStationName: string;
    finalBottles: string;
    start: string;
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
    alerts: {
      label: string;
      carbsLowTitle: string;
      carbsLowBody: string;
      waterLowTitle: string;
      waterLowBody: string;
      sodiumHighTitle: string;
      sodiumHighBody: string;
      resolvedTitle: string;
      resolvedBody: string;
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
      loading: string;
      loadError: string;
      favoritesTitle: string;
      allProductsTitle: string;
      empty: string;
      linkLabel: string;
      nutrition: string;
      countLabel: string;
      settingsHint: string;
      usingCustom: string;
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
      segmentDistanceBetween: string;
      segmentTimeLabel: string;
      segmentTimeHelp: string;
      rangeLabel: string;
      segmentConsumptionLabel: string;
      pointStockLabel: string;
      pointStockHelper: string;
      betweenStationsTitle: string;
      betweenStationsHelper: string;
      gelsBetweenLabel: string;
      collapsedScopeLabel: string;
      collapseLabel: string;
      expandLabel: string;
      plannedLabel: string;
      targetLabel: string;
      pickupTitle: string;
      pickupHelper: string;
      pickupGelsLabel: string;
      status: {
        belowTarget: string;
        atTarget: string;
        aboveTarget: string;
      };
      fuelLabel: string;
      waterLabel: string;
      sodiumLabel: string;
      printView: {
        title: string;
        description: string;
        columns: {
          from: string;
          checkpoint: string;
          distance: string;
          segment: string;
          eta: string;
          segmentTime: string;
          fuel: string;
          water: string;
          sodium: string;
          pickup: string;
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
      headerHint: string;
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
      delete: string;
      empty: string;
      updatedAt: string;
    };
    messages: {
      accountCreated: string;
      signedIn: string;
      savedPlan: string;
      loadedPlan: string;
      deletedPlan: string;
    };
    errors: {
      missingSession: string;
      saveFailed: string;
      loadFailed: string;
      deleteFailed: string;
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

export type AdminTranslations = {
  title: string;
  description: string;
  access: {
    checking: string;
    signIn: string;
    signInCta: string;
    forbidden: string;
  };
  products: {
    title: string;
    description: string;
    loadError: string;
    empty: string;
    messages: {
      updated: string;
      error: string;
    };
    status: {
      live: string;
      archived: string;
      draft: string;
    };
    table: {
      name: string;
      status: string;
      updated: string;
      actions: string;
    };
    actions: {
      setLive: string;
      setDraft: string;
      archive: string;
      restore: string;
    };
  };
  users: {
    title: string;
    description: string;
    loadError: string;
    empty: string;
    table: {
      email: string;
      role: string;
      createdAt: string;
      lastSignInAt: string;
    };
  };
  analytics: {
    title: string;
    description: string;
    loadError: string;
    empty: string;
    totals: {
      popupOpens: string;
      clicks: string;
    };
    statsTitle: string;
    eventsTitle: string;
    table: {
      product: string;
      eventType: string;
      country: string;
      merchant: string;
      timestamp: string;
    };
  };
};

export type Translations = {
  homeHero: HomeHeroTranslations;
  racePlanner: RacePlannerTranslations;
  landing: LandingPageTranslations;
  auth: AuthTranslations;
  resourcePages: Record<ResourcePageSlug, ResourcePageCopy>;
  navigation: {
    racePlanner: string;
    settings: string;
    admin: string;
    menuLabel: string;
  };
  admin: AdminTranslations;
  productSettings: ProductSettingsTranslations;
};

export type ProductSettingsTranslations = {
  title: string;
  description: string;
  authRequired: string;
  signInCta: string;
  listTitle: string;
  selectionHelp: string;
  selectionCount: string;
  empty: string;
  loading: string;
  errors: {
    loadFailed: string;
    createFailed: string;
    selectionLimit: string;
    missingSession: string;
  };
  actions: {
    refresh: string;
    select: string;
    deselect: string;
    openPlanner: string;
  };
  validation: {
    invalidUrl: string;
  };
  fields: {
    name: string;
    carbs: string;
    sodium: string;
    calories: string;
    protein: string;
    fat: string;
    productUrl: string;
  };
  formTitle: string;
  formDescription: string;
  submit: string;
  submitting: string;
  success: string;
};
