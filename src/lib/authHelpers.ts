import { supabase } from "./supabase";

/**
 * Require AAL2 (Authenticator Assurance Level 2) for sensitive actions
 * Checks current assurance level and prompts for MFA verification if needed
 *
 * @param action - The action to execute after ensuring AAL2
 * @throws Error with message "AAL2 session required for this action" if MFA verification is needed
 */
export async function requireAAL2(action: () => Promise<void>): Promise<void> {
  try {
    // Check current authenticator assurance level
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    // If already at AAL2, proceed with action
    if (data?.currentLevel === "aal2") {
      await action();
      return;
    }

    // If at AAL1, we need to step up to AAL2
    // Throw an error that the calling code can catch to show the MFA modal
    throw new Error("AAL2 session required for this action");
  } catch (error) {
    // Re-throw so calling code can handle it appropriately
    throw error;
  }
}