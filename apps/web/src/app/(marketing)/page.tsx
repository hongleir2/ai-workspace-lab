import { FeaturesSection } from './_components/features-section';
import { FinalCta } from './_components/final-cta';
import { HeroSection } from './_components/hero-section';
import { HowItWorks } from './_components/how-it-works';
import { PricingSection } from './_components/pricing-section';
import { ProblemStrip } from './_components/problem-strip';
import { TestimonialsSection } from './_components/testimonials-section';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ProblemStrip />
      <HowItWorks />
      <FeaturesSection />
      <TestimonialsSection />
      <PricingSection />
      <FinalCta />
    </>
  );
}
