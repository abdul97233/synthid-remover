import { Hero } from '../components/landing/Hero'
import { Features } from '../components/landing/Features'
import { HowItWorks } from '../components/landing/HowItWorks'
import { PrivacySection } from '../components/landing/PrivacySection'
import { HonestySection } from '../components/landing/HonestySection'
import { Faq } from '../components/landing/Faq'
import { CtaBand } from '../components/landing/CtaBand'

export function HomePage() {
  return (
    <div className="overflow-x-clip">
      <Hero />
      <Features />
      <HowItWorks />
      <HonestySection />
      <PrivacySection />
      <Faq />
      <CtaBand />
    </div>
  )
}
