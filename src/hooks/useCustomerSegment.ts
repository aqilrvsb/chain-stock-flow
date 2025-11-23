import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to check if customer segment features are enabled
 * Returns true if enabled, false if disabled
 * Defaults to true if setting doesn't exist
 */
export const useCustomerSegment = () => {
  const { data: isEnabled, isLoading } = useQuery({
    queryKey: ["customer-segment-enabled"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "customer_segment_enabled")
        .maybeSingle();

      // Default to true if setting doesn't exist
      return data?.setting_value === 'true' || data?.setting_value === null;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return {
    isCustomerSegmentEnabled: isEnabled ?? true,
    isLoading,
  };
};
