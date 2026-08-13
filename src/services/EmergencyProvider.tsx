import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
} from "react";

import { PatrolLog, Personnel, supabase } from "../lib/supabase";
import EmergencyModal from "../services/EmergencyModal";

type EmergencyContextType = {
  emergency: PatrolLog | null;
  clearEmergency: () => void;
};

const playSosAlert = (
  alarmRef: React.MutableRefObject<HTMLAudioElement | null>,
) => {
  if (!alarmRef.current) return;

  alarmRef.current.currentTime = 0;
  alarmRef.current.volume = 1;
  alarmRef.current.play().catch(console.error);
};

const EmergencyContext = createContext<EmergencyContextType>({
  emergency: null,
  clearEmergency: () => {},
});

export const useEmergency = () => useContext(EmergencyContext);

interface Props {
  children: ReactNode;
}

export const EmergencyProvider = ({ children }: Props) => {
  const [emergency, setEmergency] = useState<PatrolLog | null>(null);
  const [personnel, setPersonnel] = useState<Personnel | null>(null);
  const alarmRef = useRef<HTMLAudioElement | null>(null);

  const clearEmergency = () => {
    if (alarmRef.current) {
      alarmRef.current.pause();
      alarmRef.current.currentTime = 0;

      // Remove event handlers if y ou added any
      alarmRef.current.onended = null;
      alarmRef.current.onerror = null;

      // Release the audio resource
      alarmRef.current.src = "";
      alarmRef.current.load();

      // Remove the reference
      alarmRef.current = null;
    }

    setEmergency(null);
  };

  const unlockAudio = () => {
    if (!alarmRef.current) return;

    alarmRef.current.volume = 0;

    alarmRef.current
      .play()
      .then(() => {
        alarmRef.current?.pause();
        alarmRef.current!.currentTime = 0;
        alarmRef.current!.volume = 1;
      })
      .catch(console.error);
  };

  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      window.removeEventListener("click", unlock);
    };

    window.addEventListener("click", unlock);

    return () => window.removeEventListener("click", unlock);
  }, []);

  useEffect(() => {
    alarmRef.current = new Audio("/assets/sos_alert.wav");
    alarmRef.current.preload = "auto";
    alarmRef.current.loop = true; // optional if you want continuous alarm

    return () => {
      if (alarmRef.current) {
        alarmRef.current.pause();
        alarmRef.current.src = "";
        alarmRef.current.load();
        alarmRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("global-sos")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "patrol_logs",
        },
        async (payload) => {
          const log = payload.new as PatrolLog;

          if (log.duty_type !== "EMERGENCY_SOS") return;

          const { data, error } = await supabase
            .from("personnel")
            .select("*, rank(*)")
            .eq("id", log.personnel_id)
            .single();
          if (error) throw error;

          setPersonnel(data);
          setEmergency(log);
          playSosAlert(alarmRef);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [personnel, emergency]);

  return (
    <EmergencyContext.Provider
      value={{
        emergency,
        clearEmergency,
      }}
    >
      {children}

      <EmergencyModal
        open={!!emergency && !!personnel}
        log={emergency}
        personnel={personnel}
        onClose={clearEmergency}
      />
    </EmergencyContext.Provider>
  );
};
