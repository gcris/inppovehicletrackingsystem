import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../components/AuthProvider";
import Footer from "../mobility/Footer";
import Navbar from "../mobility/Navbar";
import TeamSection from "../mobility/TeamSection";
import PersonnelFeaturesSection from "./PersonnelFeaturesSection";
import TrackingSection from "./TrackingSection";

export default function LandingPage() {
  // const { user } = useAuth();
  // const navigate = useNavigate();

  // if (user) {
  //   return navigate("/", { replace: true });
  // }

  return (
    <div className="bg-white dark:bg-slate-950">
      <Navbar />

      <PersonnelFeaturesSection />

      <TrackingSection />

      <TeamSection />

      <Footer />
    </div>
  );
}
