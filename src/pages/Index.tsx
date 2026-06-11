import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import CoachesSection from "@/components/CoachesSection";
import AboutSection from "@/components/AboutSection";
import ServicesSection from "@/components/ServicesSection";
import WhyChooseIntroSection from "@/components/WhyChooseIntroSection";
import WhyChooseSection from "@/components/WhyChooseSection";
import ConsultationPackagesSection from "@/components/ConsultationPackagesSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import Footer from "@/components/Footer";
import ScrollProgress from "@/components/ScrollProgress";
import HomeBackgroundMusic from "@/components/HomeBackgroundMusic";

const HOME_BG_IMAGE = "/home-background.jpeg";

const Index = () => {
  return (
    <div className="relative min-h-screen">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${HOME_BG_IMAGE}")` }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-transparent via-white/22 to-white/34"
      />
      <div className="relative z-10">
      <ScrollProgress />
      <HomeBackgroundMusic />
      <Navbar />
      <HeroSection />
      <CoachesSection />
      <AboutSection />
      <ServicesSection />
      <WhyChooseIntroSection />
      <WhyChooseSection />
      <ConsultationPackagesSection />
      <TestimonialsSection />
      <Footer />
      </div>
    </div>
  );
};

export default Index;
