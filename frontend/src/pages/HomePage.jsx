import HeroSection from '../components/HeroSection.jsx'
import FeatureSection from '../components/FeatureSection.jsx'
import WorkSection from '../components/WorkSection.jsx'
import AboutSection from '../components/AboutSection.jsx'
import Footer from '../components/Footer.jsx'
import Navbar from '../components/Navbar.jsx'

export default function HomePage() {
  return (
    <div>
      <Navbar />
      <HeroSection />
      <FeatureSection />
      <WorkSection />
      <AboutSection />
      <Footer />
    </div>
  )
}
