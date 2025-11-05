import { useEffect } from "react";
import { useAuth } from "./useAuth";

/**
 * Custom hook to check user active status on critical pages
 * Use this hook on pages where you want to verify user is still active
 * Currently used on: Dashboard and Purchase pages
 */
export const useActiveStatusCheck = () => {
  const { user, checkUserActiveStatus, signOut } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const checkAndLogoutIfInactive = async () => {
      const isActive = await checkUserActiveStatus(user.id);
      if (!isActive) {
        // User has been deactivated, logout immediately
        await signOut();
      }
    };

    // Check active status when component mounts (page loads)
    checkAndLogoutIfInactive();
  }, [user?.id]);
};
