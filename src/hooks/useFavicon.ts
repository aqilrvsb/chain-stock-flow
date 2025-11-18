import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to dynamically load and update favicon from system settings
 */
export const useFavicon = () => {
  useEffect(() => {
    const loadFavicon = async () => {
      try {
        const { data } = await (supabase as any)
          .from("system_settings")
          .select("setting_value")
          .eq("setting_key", "favicon_url")
          .maybeSingle();

        if (data?.setting_value) {
          // Update favicon in document head
          let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;

          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }

          link.href = data.setting_value;
        }
      } catch (error) {
        console.error("Failed to load favicon:", error);
      }
    };

    loadFavicon();
  }, []);
};
