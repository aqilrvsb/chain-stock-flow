import { Home, Package, Users, BarChart3, Settings, LogOut, Gift, DollarSign, Award, FileText, UserCheck, BookOpen } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerSegment } from "@/hooks/useCustomerSegment";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import SOPModal from "./SOPModal";

interface AppSidebarProps {
  userRole: string | null;
  activeView: string;
  onViewChange: (view: string) => void;
}

export function AppSidebar({ userRole, activeView, onViewChange }: AppSidebarProps) {
  const { open } = useSidebar();
  const { signOut, user } = useAuth();
  const [isSOPOpen, setIsSOPOpen] = useState(false);
  const { isCustomerSegmentEnabled } = useCustomerSegment();

  // Fetch user profile to get idstaff
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("idstaff")
        .eq("id", user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const getNavigationItems = () => {
    if (userRole === "hq") {
      return [
        { title: "Dashboard", icon: Home, value: "dashboard" },
        { title: "Inventory", icon: Package, value: "products" },
        { title: "Product", icon: DollarSign, value: "pricing" },
        { title: "Master Agents & Agents", icon: Users, value: "users" },
        { title: "Stock In HQ", icon: Package, value: "stock-in-hq" },
        { title: "Stock Out HQ", icon: Package, value: "stock-out-hq" },
        { title: "Transaction Master Agent", icon: BarChart3, value: "transactions" },
        { title: "Transaction Agent", icon: DollarSign, value: "transaction-agent" },
        { title: "Rewards", icon: Gift, value: "rewards" },
        { title: "Reward MA Dealer 1", icon: Award, value: "reward-ma-dealer1" },
        { title: "Reward MA Dealer 2", icon: Award, value: "reward-ma-dealer2" },
        { title: "Reward Agent Platinum", icon: Award, value: "reward-agent-platinum" },
        { title: "Reward Agent Gold", icon: Award, value: "reward-agent-gold" },
        { title: "Reporting Master Agent", icon: FileText, value: "reporting-ma" },
        { title: "Reporting Agent", icon: FileText, value: "reporting-agent" },
      ];
    } else if (userRole === "master_agent") {
      const items = [
        { title: "Dashboard", icon: Home, value: "dashboard" },
        { title: "Purchase", icon: Package, value: "purchase" },
        { title: "Inventory", icon: Package, value: "inventory" },
        { title: "My Agents", icon: Users, value: "agents" },
      ];

      // Only add Customers if customer segment is enabled
      if (isCustomerSegmentEnabled) {
        items.push({ title: "Customers", icon: UserCheck, value: "customers" });
      }

      items.push(
        { title: "Transactions", icon: BarChart3, value: "transactions" },
        { title: "Transaction Agent", icon: DollarSign, value: "transaction-agent" },
        { title: "Reward Agent", icon: Award, value: "reward-agent" },
        { title: "Reporting Agent", icon: FileText, value: "reporting-agent" },
      );

      return items;
    } else if (userRole === "agent") {
      const items = [
        { title: "Dashboard", icon: Home, value: "dashboard" },
        { title: "Purchase", icon: Package, value: "purchase" },
        { title: "Inventory", icon: Package, value: "inventory" },
      ];

      // Only add Customers if customer segment is enabled
      if (isCustomerSegmentEnabled) {
        items.push({ title: "Customers", icon: UserCheck, value: "customers" });
      }

      items.push({ title: "Transactions", icon: BarChart3, value: "transactions" });

      return items;
    }
    return [{ title: "Dashboard", icon: Home, value: "dashboard" }];
  };

  const items = getNavigationItems();

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="border-b p-4">
        <h1 className="text-xl font-bold text-primary">
          {open ? "OliveJardin Hub" : "OJ"}
        </h1>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.value}>
                  <SidebarMenuButton 
                    onClick={() => onViewChange(item.value)}
                    isActive={activeView === item.value}
                    className="cursor-pointer"
                  >
                    <item.icon className="h-4 w-4" />
                    {open && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onViewChange("settings")}
                  isActive={activeView === "settings"}
                  className="cursor-pointer"
                >
                  <Settings className="h-4 w-4" />
                  {open && <span>Settings</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setIsSOPOpen(true)}
                  className="cursor-pointer"
                >
                  <BookOpen className="h-4 w-4" />
                  {open && <span>SOP</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex items-center gap-3 mb-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {profile?.idstaff?.[0]?.toUpperCase() || user?.email?.[0].toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          {open && (
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{profile?.idstaff || user?.email?.split("@")[0]}</p>
            </div>
          )}
        </div>
        {open && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        )}
      </SidebarFooter>

      <SOPModal
        isOpen={isSOPOpen}
        onClose={() => setIsSOPOpen(false)}
        userRole={userRole || ""}
      />
    </Sidebar>
  );
}
