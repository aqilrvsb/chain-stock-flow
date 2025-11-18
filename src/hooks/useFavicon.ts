import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to dynamically load and update favicon from system settings
 * Includes cache busting to ensure users always see the latest favicon
 */
export const useFavicon = () => {
  useEffect(() => {
    const loadFavicon = async () => {
      try {
        const { data } = await (supabase as any)
          .from("system_settings")
          .select("setting_value, updated_at")
          .eq("setting_key", "favicon_url")
          .maybeSingle();

        if (data?.setting_value) {
          // Add cache busting parameter using updated_at timestamp
          const timestamp = data.updated_at ? new Date(data.updated_at).getTime() : Date.now();
          const faviconUrl = `${data.setting_value}?v=${timestamp}`;

          // Update favicon in document head
          let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;

          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }

          link.href = faviconUrl;
        }
      } catch (error) {
        console.error("Failed to load favicon:", error);
      }
    };

    loadFavicon();
  }, []);
};
