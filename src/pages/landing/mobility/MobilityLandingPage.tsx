import Navbar from "./Navbar";
import HeroSection from "./HeroSection";
import WorkflowTimeline from "./workflow/WorkflowTimeline";
import Footer from "./Footer";
import ScreenshotShowcase from "./showcase/ScreenshotShowcase";
import AboutSection from "./AboutSection";
import TeamSection from "./TeamSection";
import TrackingSection from "../tracking/TrackingSection";

export default function MobilityLandingPage() {
  return (
    <div className="bg-white dark:bg-slate-950">
      <Navbar />

      <HeroSection />

      <WorkflowTimeline />

      <ScreenshotShowcase />

      <AboutSection />

      <TeamSection />

      <Footer />
    </div>
  );
}
