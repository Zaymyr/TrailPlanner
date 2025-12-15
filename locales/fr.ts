import type { Translations } from "./types";

export const fr: Translations = {
  homeHero: {
    heading: "Bienvenue sur TrailPlanner",
    description:
      "Rendez-vous dans le planificateur de course pour estimer vos passages aux ravitos, vos objectifs énergétiques et votre allure.",
    cta: "Ouvrir le planificateur de course",
  },
  landing: {
    heading: "Guides nutrition et hydratation trail",
    subheading:
      "Choisissez un guide pour affiner votre plan nutrition trail, hydratation et stratégie de ravitos, ou ouvrez directement l'outil.",
    plannerCta: "Lancer le planificateur",
    plannerDescription:
      "Estimez vos besoins en glucides, eau et sodium par heure, positionnez les ravitaillements et exportez un plan imprimable.",
    cardsHeading: "Explorer les guides détaillés",
    cardCta: "Ouvrir le guide",
    cards: [
      {
        slug: "trail-nutrition-planner",
        title: "Plan nutrition trail",
        description: "Construisez un plan nutrition trail avec des cibles en glucides, eau et sodium par ravito.",
      },
      {
        slug: "ultra-trail-fueling",
        title: "Nutrition ultra-trail",
        description: "Préparez votre checklist ultra avec gels, vrais aliments et changements de flasques.",
      },
      {
        slug: "ravitaillement-trail",
        title: "Ravitaillement trail",
        description: "Optimisez chaque ravito avec des volumes d'eau et d'électrolytes adaptés au profil.",
      },
      {
        slug: "hydration-trail-running",
        title: "Hydratation trail",
        description: "Équilibrez flasques, poches et sodium pour les longues sorties et la chaleur.",
      },
    ],
  },
  racePlanner: {
    defaults: {
      aidStationName: "Ravito {index}",
      finalBottles: "Dernières bouteilles",
      finish: "Arrivée",
    },
    units: {
      hourShort: "h",
      minuteShort: "min",
      kilometer: "km",
      meter: "m",
      grams: "g",
      milliliters: "ml",
      milligrams: "mg",
    },
    validation: {
      required: "Requis",
      distancePositive: "La distance doit être positive",
      raceDistance: "Saisissez une distance en km",
      paceZero: "L'allure ne peut pas être 0",
      speedPositive: "La vitesse doit être positive",
      targetIntake: "Indiquez les grammes par heure",
      aidStationMin: "Ajoutez au moins un ravitaillement",
      nonNegative: "La valeur ne peut pas être négative",
      paceSecondsRange: "Les secondes doivent être entre 0 et 59",
    },
    gpx: {
      errors: {
        noTrackPoints: "Aucun point de trace trouvé dans le fichier GPX.",
        invalidCoordinates: "Coordonnées invalides dans les points de trace.",
        unableToImport: "Import du fichier GPX impossible.",
        invalidPlannerState: "Impossible de lire les données enregistrées depuis ce GPX.",
      },
      fallbackAidStation: "Point de ravitaillement",
    },
    sections: {
      courseProfile: {
        title: "Profil de course",
        description:
          "Élévation par distance avec les ravitos mis en évidence. Importez un fichier GPX pour remplir le profil.",
        empty: "Importez un fichier GPX pour voir le profil d'élévation.",
        axisLabel: "Distance (km)",
        ariaLabel: "Profil d'élévation de la course",
        speedLabel: "Vitesse ajustée",
        speedUnit: "km/h",
      },
      raceInputs: {
        title: "Paramètres de course",
        description: "Ajustez la distance, l'allure, la nutrition et importez des données GPX.",
        courseTitle: "Parcours",
        pacingTitle: "Allure & nutrition",
        nutritionTitle: "Cibles nutritionnelles",
        fields: {
          raceDistance: "Distance de course (km)",
          elevationGain: "D+ (m)",
          paceType: "Type d'allure",
          paceMinutes: "Minutes",
          paceSeconds: "Secondes",
          speedKph: "Vitesse (km/h)",
          uphillEffort: "Effort en montée",
          downhillEffort: "Effort en descente",
          uphillEffortHelp: "Plus haut = vitesse accrue en montée ; plus bas = montée plus prudente.",
          downhillEffortHelp:
            "Plus haut = plus d'engagement en descente tout en levant le pied sur les sections très raides.",
          targetIntakePerHour: "Glucides (g/h)",
          waterIntakePerHour: "Eau (ml/h)",
          sodiumIntakePerHour: "Sodium (mg/h)",
        },
        paceOptions: {
          pace: "Allure (min/km)",
          speed: "Vitesse (km/h)",
        },
      },
      summary: {
        title: "Synthèse des besoins de course",
        description: "Totaux calculés selon votre allure, votre nutrition et la distance du parcours.",
        items: {
          duration: "Durée de course",
          carbs: "Glucides totaux",
          water: "Eau totale",
          sodium: "Sodium total",
        },
        empty: "Ajoutez la distance, l'allure et la nutrition pour voir les totaux nécessaires pour l'événement.",
        feedback: {
          title: "Envoyer un retour sur l'app",
          subject: "Titre",
          detail: "Détail",
          submit: "Envoyer le retour",
          open: "Suggestion",
          success: "Merci pour votre retour !",
          error: "Impossible d'enregistrer le retour. Réessayez plus tard.",
          required: "Ajoutez un titre et un détail pour enregistrer le retour.",
        },
      },
      gels: {
        title: "Gels énergétiques",
        description: "Comparez quelques gels populaires et estimez le nombre de portions pour couvrir vos glucides.",
        empty: "Renseignez votre allure et vos objectifs nutritionnels pour calculer les gels nécessaires.",
        linkLabel: "Voir le produit",
        nutrition: "{carbs} g de glucides · {sodium} mg de sodium par gel",
        countLabel: "{count} gels nécessaires",
      },
      aidStations: {
        title: "Ravitaillements",
        description: "Modifiez les points où vous prévoyez de vous réapprovisionner.",
        add: "Ajouter un ravito",
        labels: {
          name: "Nom",
          distance: "Distance (km)",
        },
        remove: "Supprimer",
      },
      timeline: {
        title: "Timeline",
        description: "Une vue compacte de vos positions prévues sur le parcours.",
        empty: "Ajoutez vos données d'allure pour prévisualiser la timeline du parcours.",
        etaLabel: "ETA",
        distanceWithUnit: "km",
        segmentLabel: "Segment de {distance} km",
        fuelLabel: "{amount} g de glucides",
        waterLabel: "{amount} ml d'eau",
        sodiumLabel: "{amount} mg de sodium",
        printView: {
          title: "Plan ravito imprimable",
          description: "Utilisez ce tableau pour imprimer les infos clés de chaque ravito.",
          columns: {
            checkpoint: "Point de ravito",
            distance: "Distance",
            segment: "Segment",
            eta: "ETA",
            segmentTime: "Temps de section",
            fuel: "Glucides",
            water: "Eau",
            sodium: "Sodium",
          },
        },
      },
    },
    buttons: {
      importGpx: "Importer un GPX",
      exportGpx: "Exporter le GPX",
      printPlan: "Imprimer le plan",
    },
    mobileNav: {
      importGpx: "Importer",
      timeline: "Timeline",
      pacing: "Allure & effort",
      intake: "Apports",
    },
  },
  resourcePages: {
    "trail-nutrition-planner": {
      title: "Plan nutrition trail",
      intro:
        "Planifiez votre nutrition trail avec des cibles en glucides, eau et sodium pour chaque ravitaillement.",
      benefitsHeading: "Ce que le plan vous apporte",
      benefits: [
        "Définissez vos glucides par heure et traduisez-les en gels, barres ou portions salées.",
        "Équilibrez volume des flasques, mélanges électrolytes et besoins entre chaque section.",
        "Importez un GPX pour adapter l'apport à la montée, la descente et votre allure prévue.",
        "Exportez une checklist ravito imprimable pour garder votre nutrition organisée.",
      ],
      ctaLabel: "Préparer mon plan nutrition trail",
      ctaNote: "Passez sur le planificateur pour saisir vos cibles et télécharger la fiche ravito.",
      relatedHeading: "Autres guides trail",
      plannerLabel: "Retour au planificateur",
    },
    "ultra-trail-fueling": {
      title: "Nutrition ultra-trail",
      intro:
        "Construisez une stratégie de nutrition ultra-trail pour rester constant sur les longues montées, les relances et la nuit.",
      benefitsHeading: "Pourquoi utiliser ce guide",
      benefits: [
        "Fixez glucides et sodium par heure pour éviter les coups de mou et l'inconfort digestif.",
        "Prévoyez les portions solides entre deux ravitos et ce que votre assistance doit passer.",
        "Ajustez l'hydratation sur les sections chaudes avec changements de flasques et électrolytes.",
        "Exportez une checklist ultra simple à suivre le jour J.",
      ],
      ctaLabel: "Construire mon plan ultra-trail",
      ctaNote: "Utilisez le planificateur pour transformer vos cibles horaires en plan de ravitaillement ultra.",
      relatedHeading: "Ressources nutrition trail",
      plannerLabel: "Retour au planificateur",
    },
    "ravitaillement-trail": {
      title: "Ravitaillement trail",
      intro:
        "Optimisez votre ravitaillement trail en listant volumes d'eau, sodium et apports pour chaque section du parcours.",
      benefitsHeading: "Pourquoi ce plan aide",
      benefits: [
        "Repérez combien d'eau et de glucides vous emportez entre deux points de ravito.",
        "Notez les mélanges d'électrolytes et les changements de bidons ou de poches.",
        "Alignez les besoins nutritionnels sur le dénivelé et la durée estimée grâce au profil.",
        "Générez une fiche ravito claire pour vous et votre équipe assistance.",
      ],
      ctaLabel: "Préparer mes ravitos",
      ctaNote: "Ouvrez le planificateur de course pour poser vos volumes et apports par section.",
      relatedHeading: "Guides nutrition trail liés",
      plannerLabel: "Retour au planificateur",
    },
    "hydration-trail-running": {
      title: "Hydratation trail",
      intro:
        "Établissez un plan d'hydratation trail qui équilibre eau, électrolytes et poches/flasques selon la météo.",
      benefitsHeading: "Checklist hydratation",
      benefits: [
        "Fixez vos besoins horaires en eau et sodium selon la distance, la température et le dénivelé.",
        "Planifiez les volumes de flasques et les points de remplissage sur le parcours.",
        "Coordonnez hydratation, caféine et gels pour garder un niveau d'énergie stable.",
        "Exportez une fiche axée hydratation à coller sur votre gilet ou dans vos sacs.",
      ],
      ctaLabel: "Planifier mon hydratation trail",
      ctaNote: "Rendez-vous sur le planificateur pour combiner hydratation, nutrition et allure au même endroit.",
      relatedHeading: "Continuer à affiner le plan",
      plannerLabel: "Retour au planificateur",
    },
  },
};
