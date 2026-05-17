import { FeaturesSection } from './_components/features-section';
import { FinalCta } from './_components/final-cta';
import { HeroSection } from './_components/hero-section';
import { HowItWorks } from './_components/how-it-works';
import { PricingSection } from './_components/pricing-section';
import { ProductDemo } from './_components/product-demo';
import { ReliabilitySection } from './_components/reliability-section';
import { TrustedBy } from './_components/trusted-by';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <TrustedBy />
      <FeaturesSection />
      <ProductDemo />
      <HowItWorks />
      <PricingSection />
      <ReliabilitySection />
      <FinalCta />
    </>
  );
}
