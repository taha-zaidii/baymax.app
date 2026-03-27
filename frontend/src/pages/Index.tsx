import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import HowItWorks from "@/components/HowItWorks";
import Dashboard from "@/components/Dashboard";
import FeaturesOverview from "@/components/FeaturesOverview";
import Stats from "@/components/Stats";
import Testimonials from "@/components/Testimonials";
import Pricing from "@/components/Pricing";
import CTABanner from "@/components/CTABanner";
import Footer from "@/components/Footer";
import FloatingBaymax from "@/components/FloatingBaymax";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <HowItWorks />
      <Dashboard />
      <FeaturesOverview />
      <Stats />
      <Testimonials />
      <Pricing />
      <CTABanner />
      <Footer />
      <FloatingBaymax />
    </div>
  );
};

export default Index;
