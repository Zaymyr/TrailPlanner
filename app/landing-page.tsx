"use client";

import { DemoSection } from "../components/landing/DemoSection";
import { FaqSection } from "../components/landing/FaqSection";
import { GuideCards } from "../components/landing/GuideCards";
import { HeroSection } from "../components/landing/HeroSection";
import { HowItWorksSection } from "../components/landing/HowItWorksSection";
import { useI18n } from "./i18n-provider";

type FeaturedGuideCard = {
  slug: string;
  title: string;
  excerpt: string;
};

type LandingPageProps = {
  featuredGuides: FeaturedGuideCard[];
};

export function LandingPage({ featuredGuides }: LandingPageProps) {
  const { t } = useI18n();
  const landing = t.landing;

  return (
    <div className="space-y-12 pb-16">
      <HeroSection hero={landing.hero} />
      <HowItWorksSection copy={landing.howItWorks} />
      <DemoSection
        demo={landing.demo}
        heroImageAlt={landing.hero.heroImageAlt}
        secondaryImageAlt={landing.hero.secondaryImageAlt}
        ctaLabel={landing.hero.primaryCta}
      />
      <FaqSection faq={landing.faq} />
      <GuideCards cardsHeading={landing.cardsHeading} cardCta={landing.cardCta} guides={featuredGuides} />
    </div>
  );
}
