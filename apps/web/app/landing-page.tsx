"use client";

import { DemoSection } from "../components/landing/DemoSection";
import { FaqSection } from "../components/landing/FaqSection";
import { GuideCards } from "../components/landing/GuideCards";
import { HeroSection } from "../components/landing/HeroSection";
import { HomeProofStrip } from "../components/landing/HomeProofStrip";
import { HowItWorksSection } from "../components/landing/HowItWorksSection";
import { getHomeLandingCopy } from "../components/landing/home-copy";
import type { OrganizerSocialProof } from "../lib/organizer-social-proof";
import { useI18n } from "./i18n-provider";

type FeaturedGuideCard = {
  slug: string;
  title: string;
  excerpt: string;
  canonicalPath: string;
};

type LandingPageProps = {
  featuredGuides: FeaturedGuideCard[];
  socialProofs?: OrganizerSocialProof[];
};

export function LandingPage({ featuredGuides, socialProofs = [] }: LandingPageProps) {
  const { locale, t } = useI18n();
  const landing = getHomeLandingCopy(locale, t.landing);

  return (
    <div className="space-y-12 pb-16">
      <div className="space-y-4">
        <HeroSection hero={landing.hero} />
        <HomeProofStrip proofs={socialProofs} copy={landing.proofStrip} />
      </div>
      <HowItWorksSection copy={landing.howItWorks} />
      <DemoSection
        demo={landing.demo}
        secondaryImageAlt={landing.hero.secondaryImageAlt}
        ctaLabel={landing.hero.primaryCta}
      />
      <FaqSection faq={landing.faq} />
      <GuideCards cardsHeading={landing.cardsHeading} cardCta={landing.cardCta} guides={featuredGuides} />
    </div>
  );
}
