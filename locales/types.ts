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
  forgotPassword: string;
  submit: string;
  submitting: string;
  success: string;
  error: string;
};

export type PasswordResetRequestTranslations = {
  title: string;
  description: string;
  submit: string;
  submitting: string;
  success: string;
  error: string;
  backToSignIn: string;
};

export type PasswordResetTranslations = {
  title: string;
  description: string;
  submit: string;
  submitting: string;
  success: string;
  error: string;
  confirmPasswordLabel: string;
  confirmPasswordPlaceholder: string;
  mismatchError: string;
  invalidLink: string;
  backToSignIn: string;
};

export type SessionExpiredTranslations = {
  title: string;
  description: string;
  reconnect: string;
};

export type AuthTranslations = {
  shared: AuthSharedTranslations;
  signUp: SignUpTranslations;
  signIn: SignInTranslations;
  passwordResetRequest: PasswordResetRequestTranslations;
  passwordReset: PasswordResetTranslations;
  sessionExpired: SessionExpiredTranslations;
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
      tooltip: {
        distance: string;
        elevation: string;
        segmentGain: string;
        segmentLoss: string;
        cumulativeGain: string;
        cumulativeLoss: string;
        time: string;
        pace: string;
        speed: string;
        ravitoTitle: string;
        waterRefill: string;
        waterRefillYes: string;
        waterRefillNo: string;
        plannedGels: string;
        plannedCarbs: string;
        plannedCalories: string;
        plannedSodium: string;
        plannedWater: string;
      };
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
        targetIntakePerHour: string;
        waterIntakePerHour: string;
        sodiumIntakePerHour: string;
        waterBagLiters: string;
        waterBagHelper: string;
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
        waterRefill: string;
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
      paceAdjustmentLabel: string;
      paceAdjustmentHelp: string;
      pauseLabel: string;
      pauseHelp: string;
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
      waterCapacityLabel: string;
      waterCapacityWarning: string;
      status: {
        belowTarget: string;
        atTarget: string;
        aboveTarget: string;
      };
      fuelLabel: string;
      waterLabel: string;
      sodiumLabel: string;
      finishSummary: {
        title: string;
        totalTimeLabel: string;
        pauseNote: string;
        avgPaceLabel: string;
        avgSpeedLabel: string;
        totalCarbsLabel: string;
        totalFluidsLabel: string;
        totalSodiumLabel: string;
        totalGelsLabel: string;
        totalCaloriesLabel: string;
        elevationGainLabel: string;
        elevationLossLabel: string;
        detailsLabel: string;
        groups: {
          performance: string;
          energy: string;
          hydration: string;
        };
      };
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
    chooseRace: string;
    printPlan: string;
    autoFill: string;
    autoFillHint: string;
  };
  raceCatalog: {
    title: string;
    description: string;
    close: string;
    searchPlaceholder: string;
    loading: string;
    loadError: string;
    empty: string;
    useAction: string;
    using: string;
    table: {
      image: string;
      name: string;
      distance: string;
      elevation: string;
      location: string;
      action: string;
      openTrace: string;
      noGpx: string;
      noImage: string;
    };
    admin: {
      title: string;
      subtitle: string;
      addAction: string;
      close: string;
      submit: string;
      creating: string;
      updateAction: string;
      updating: string;
      preview: string;
      fields: {
        name: string;
        location: string;
        traceId: string;
        externalUrl: string;
        thumbnailUrl: string;
      };
      messages: {
        created: string;
        updated: string;
      };
      errors: {
        authRequired: string;
        createFailed: string;
        updateFailed: string;
        missingGpx: string;
        invalidGpx: string;
      };
    };
    errors: {
      authRequired: string;
      createFailed: string;
    };
    messages: {
      created: string;
    };
    units: {
      kilometer: string;
      meter: string;
    };
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
      searchLabel: string;
      searchPlaceholder: string;
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
    premium: {
      badge: string;
      title: string;
      description: string;
      cta: string;
      opening: string;
      checkoutError: string;
      planLimitReached: string;
      exportLocked: string;
      printLocked: string;
      autoFillLocked: string;
      limits: {
        plans: string;
        favorites: string;
        customProducts: string;
        export: string;
        autoFill: string;
      };
      premiumModal: {
        title: string;
        description: string;
        priceLabel: string;
        priceValue: string;
        featuresTitle: string;
        features: string[];
        subscribe: string;
        cancel: string;
        popupBlocked: string;
      };
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
  hero: {
    eyebrow: string;
    heading: string;
    subheading: string;
    bullets: string[];
    socialProof: string;
    primaryCta: string;
    secondaryCta: string;
    heroImageAlt: string;
    secondaryImageAlt: string;
  };
  howItWorks: {
    title: string;
    steps: Array<{
      title: string;
      description: string;
    }>;
  };
  demo: {
    title: string;
    subtitle: string;
    cards: Array<{
      title: string;
      description: string;
    }>;
  };
  faq: {
    title: string;
    subtitle: string;
    items: Array<{
      question: string;
      answer: string;
    }>;
    cta: string;
  };
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

export type ProfileTranslations = {
  title: string;
  description: string;
  authRequired: string;
  save: string;
  saving: string;
  success: string;
  error: string;
  basics: {
    title: string;
    subtitle: string;
    nameLabel: string;
    namePlaceholder: string;
    ageLabel: string;
    agePlaceholder: string;
    waterBagLabel: string;
    waterBagHelper: string;
  };
  favorites: {
    title: string;
    subtitle: string;
    add: string;
    empty: string;
    selectedLabel: string;
    remove: string;
    dialog: {
      title: string;
      searchPlaceholder: string;
      close: string;
    };
    table: {
      name: string;
      carbs: string;
      sodium: string;
      calories: string;
      select: string;
      selected: string;
    };
  };
  subscription: {
    title: string;
    premiumStatus: string;
    freeStatus: string;
    refresh: string;
    loading: string;
    error: string;
    subscribeCta: string;
    unsubscribeCta: string;
    checkoutError: string;
    portalError: string;
    unsubscribeConfirm: {
      title: string;
      description: string;
      lossesTitle: string;
      confirm: string;
      cancel: string;
    };
  };
  premiumModal: {
    title: string;
    description: string;
    priceLabel: string;
    priceValue: string;
    featuresTitle: string;
    features: string[];
    subscribe: string;
    cancel: string;
    popupBlocked: string;
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
    blog: string;
    settings: string;
    admin: string;
    menuLabel: string;
    profile: string;
  };
  admin: AdminTranslations;
  productSettings: ProductSettingsTranslations;
  profile: ProfileTranslations;
};

export type ProductSettingsTranslations = {
  title: string;
  description: string;
  authRequired: string;
  localNotice: string;
  signInCta: string;
  listTitle: string;
  selectionHelp: string;
  selectionCount: string;
  empty: string;
  loading: string;
  filters: {
    searchPlaceholder: string;
  };
  errors: {
    loadFailed: string;
    createFailed: string;
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
    nonNegative: string;
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
  warning: {
    title: string;
    description: string;
    back: string;
    confirm: string;
  };
};
