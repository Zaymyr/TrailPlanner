import type { Locale } from "../../locales/types";

export const supportEmail = "faustin@pace-yourself.com";

export const supportCopy = {
  en: {
    meta: {
      title: "Support | Pace Yourself",
      description:
        "Get help with Pace Yourself accounts, race plans, GPX imports, subscriptions, and mobile app issues.",
    },
    eyebrow: "Support",
    title: "How can we help?",
    intro:
      "For account access, race plan issues, GPX imports, subscriptions, or anything that feels off in the app, contact Pace Yourself support directly.",
    email: {
      title: "Email support",
      body:
        "Send a message with the device you use, the screen where the issue happened, and the steps that led to it. Screenshots are welcome when they help explain the problem.",
      subject: "Pace Yourself support",
    },
    response: {
      title: "Response time",
      body: "We usually reply within two business days. Urgent account or payment issues are handled first.",
      mobileFeedback: "You can also send feedback from the mobile app when you are signed in.",
    },
    links: {
      title: "Useful links",
      signIn: "Sign in to your account",
      privacy: "Privacy policy",
      terms: "Terms of use",
      home: "Back to Pace Yourself",
    },
  },
  fr: {
    meta: {
      title: "Support | Pace Yourself",
      description:
        "Obtenez de l'aide pour votre compte Pace Yourself, vos plans de course, vos imports GPX, vos abonnements et l'application mobile.",
    },
    eyebrow: "Support",
    title: "Comment pouvons-nous vous aider ?",
    intro:
      "Pour l'accès au compte, les soucis de plan de course, les imports GPX, les abonnements ou toute anomalie dans l'app, contactez directement le support Pace Yourself.",
    email: {
      title: "Support par e-mail",
      body:
        "Envoyez un message avec l'appareil utilisé, l'écran concerné et les étapes qui ont mené au problème. Les captures d'écran sont utiles quand elles clarifient la situation.",
      subject: "Support Pace Yourself",
    },
    response: {
      title: "Délai de réponse",
      body:
        "Nous répondons généralement sous deux jours ouvrés. Les urgences de compte ou de paiement sont traitées en priorité.",
      mobileFeedback: "Vous pouvez aussi envoyer un retour depuis l'application mobile lorsque vous êtes connecté.",
    },
    links: {
      title: "Liens utiles",
      signIn: "Se connecter à son compte",
      privacy: "Politique de confidentialité",
      terms: "Conditions d'utilisation",
      home: "Retour à Pace Yourself",
    },
  },
} satisfies Record<
  Locale,
  {
    meta: {
      title: string;
      description: string;
    };
    eyebrow: string;
    title: string;
    intro: string;
    email: {
      title: string;
      body: string;
      subject: string;
    };
    response: {
      title: string;
      body: string;
      mobileFeedback: string;
    };
    links: {
      title: string;
      signIn: string;
      privacy: string;
      terms: string;
      home: string;
    };
  }
>;
