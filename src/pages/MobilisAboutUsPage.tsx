import AboutSection from "./landing/mobility/AboutSection";
import Footer from "./landing/mobility/Footer";
import TeamSection from "./landing/mobility/TeamSection";

export default function MobilisAboutUsPage() {
  return (
    <div className="bg-white dark:bg-slate-950">
      <AboutSection />

      <TeamSection />
    </div>
  );
}
