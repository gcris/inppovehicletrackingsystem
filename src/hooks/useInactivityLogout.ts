import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../components/AuthProvider";

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

export function useInactivityLogout(enabled = true) {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { user } = useAuth();

    useEffect(() => {
        if (!enabled) return;

        const logout = async () => {
            await supabase
                .from("personnel")
                .update({
                    mfa_enabled: true,
                    is_online: false,
                })
                .eq("id", user?.id);
            
            await supabase.auth.signOut();
        };

        const resetTimer = () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(logout, INACTIVITY_TIMEOUT);
        };

        const events = [
            "mousedown",
            "mousemove",
            "keydown",
            "scroll",
            "touchstart",
            "click",
        ];

        events.forEach((event) => {
            window.addEventListener(event, resetTimer);
        });

        // Start the timer when the hook is mounted
        resetTimer();

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            events.forEach((event) => {
                window.removeEventListener(event, resetTimer);
            });
        };
    }, [enabled]);
}
