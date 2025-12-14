import { Home, Package, Users, BarChart3, Settings, LogOut, Gift, DollarSign, Award, FileText, UserCheck, BookOpen, ChevronDown, Warehouse, ArrowRightFromLine, ArrowLeftToLine, Truck, Megaphone, ShoppingCart, Target, TrendingUp, Calculator, User } from "lucide-react";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerSegment } from "@/hooks/useCustomerSegment";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
    if (userRole === "master_agent") {
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
        { title: "Reward Agent Platinum", icon: Award, value: "reward-agent-platinum" },
        { title: "Reward Agent Gold", icon: Award, value: "reward-agent-gold" },
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
    } else if (userRole === "branch") {
      // Branch has its own dedicated sidebar with collapsible Agent menu
      return [];
    }
    return [{ title: "Dashboard", icon: Home, value: "dashboard" }];
  };

  const items = getNavigationItems();

  // HQ Sidebar with collapsible groups
  if (userRole === "hq") {
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
                {/* Dashboard */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("dashboard")}
                    isActive={activeView === "dashboard"}
                    className="cursor-pointer"
                  >
                    <Home className="h-4 w-4" />
                    {open && <span>Dashboard</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Inventory Group */}
                <Collapsible defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="cursor-pointer">
                        <Package className="h-4 w-4" />
                        {open && <span>Inventory</span>}
                        {open && <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("products")}
                            isActive={activeView === "products"}
                            className="cursor-pointer"
                          >
                            <span>Product</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("pricing")}
                            isActive={activeView === "pricing"}
                            className="cursor-pointer"
                          >
                            <span>Bundle</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>

                {/* Master Agents, Branches & Agents */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("users")}
                    isActive={activeView === "users"}
                    className="cursor-pointer"
                  >
                    <Users className="h-4 w-4" />
                    {open && <span>Master, Branch & Agent</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Stock Group */}
                <Collapsible defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="cursor-pointer">
                        <Warehouse className="h-4 w-4" />
                        {open && <span>Stock</span>}
                        {open && <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("stock-in-hq")}
                            isActive={activeView === "stock-in-hq"}
                            className="cursor-pointer"
                          >
                            <span>Stock In HQ</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("stock-out-hq")}
                            isActive={activeView === "stock-out-hq"}
                            className="cursor-pointer"
                          >
                            <span>Stock Out HQ</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("raw-material")}
                            isActive={activeView === "raw-material"}
                            className="cursor-pointer"
                          >
                            <span>Raw Material</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>

                {/* Rewards */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("rewards")}
                    isActive={activeView === "rewards"}
                    className="cursor-pointer"
                  >
                    <Gift className="h-4 w-4" />
                    {open && <span>Rewards</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Master Agent Group */}
                <Collapsible defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="cursor-pointer">
                        <Users className="h-4 w-4" />
                        {open && <span>Master Agent</span>}
                        {open && <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("reporting-ma")}
                            isActive={activeView === "reporting-ma"}
                            className="cursor-pointer"
                          >
                            <span>Reporting</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("transactions")}
                            isActive={activeView === "transactions"}
                            className="cursor-pointer"
                          >
                            <span>Transaction</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("reward-ma-dealer1")}
                            isActive={activeView === "reward-ma-dealer1"}
                            className="cursor-pointer"
                          >
                            <span>Reward Dealer 1</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("reward-ma-dealer2")}
                            isActive={activeView === "reward-ma-dealer2"}
                            className="cursor-pointer"
                          >
                            <span>Reward Dealer 2</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>

                {/* Agent Group */}
                <Collapsible defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="cursor-pointer">
                        <UserCheck className="h-4 w-4" />
                        {open && <span>Agent</span>}
                        {open && <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("reporting-agent")}
                            isActive={activeView === "reporting-agent"}
                            className="cursor-pointer"
                          >
                            <span>Reporting</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("transaction-agent")}
                            isActive={activeView === "transaction-agent"}
                            className="cursor-pointer"
                          >
                            <span>Transaction</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("reward-agent-platinum")}
                            isActive={activeView === "reward-agent-platinum"}
                            className="cursor-pointer"
                          >
                            <span>Reward Platinum</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("reward-agent-gold")}
                            isActive={activeView === "reward-agent-gold"}
                            className="cursor-pointer"
                          >
                            <span>Reward Gold</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>

                {/* Logistic */}
                <Collapsible className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="cursor-pointer">
                        <Package className="h-4 w-4" />
                        {open && <span>Logistic</span>}
                        {open && <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton onClick={() => onViewChange("logistic")} isActive={activeView === "logistic"}>
                            <span>Dashboard</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton onClick={() => onViewChange("processed-stock-view")} isActive={activeView === "processed-stock-view"}>
                            <span>Processed</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
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

  // Logistic Sidebar
  if (userRole === "logistic") {
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
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("dashboard")}
                    isActive={activeView === "dashboard"}
                    className="cursor-pointer"
                  >
                    <Home className="h-4 w-4" />
                    {open && <span>Dashboard</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("processed")}
                    isActive={activeView === "processed"}
                    className="cursor-pointer"
                  >
                    <Package className="h-4 w-4" />
                    {open && <span>Processed</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("raw-material-view")}
                    isActive={activeView === "raw-material-view"}
                    className="cursor-pointer"
                  >
                    <Package className="h-4 w-4" />
                    {open && <span>Raw Material</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
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

  // Branch Sidebar with collapsible Agent menu
  if (userRole === "branch") {
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
                {/* Dashboard */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("dashboard")}
                    isActive={activeView === "dashboard"}
                    className="cursor-pointer"
                  >
                    <Home className="h-4 w-4" />
                    {open && <span>Dashboard</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Inventory Group - Collapsible */}
                <Collapsible defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="cursor-pointer">
                        <Package className="h-4 w-4" />
                        {open && <span>Inventory</span>}
                        {open && <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("inventory")}
                            isActive={activeView === "inventory"}
                            className="cursor-pointer"
                          >
                            <span>Product</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("stock-in")}
                            isActive={activeView === "stock-in"}
                            className="cursor-pointer"
                          >
                            <span>Stock In</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("stock-out")}
                            isActive={activeView === "stock-out"}
                            className="cursor-pointer"
                          >
                            <span>Stock Out</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>

                {/* Customer HQ */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("customers")}
                    isActive={activeView === "customers"}
                    className="cursor-pointer"
                  >
                    <UserCheck className="h-4 w-4" />
                    {open && <span>Customer HQ</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Customer Marketer */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("customer-marketer")}
                    isActive={activeView === "customer-marketer"}
                    className="cursor-pointer"
                  >
                    <UserCheck className="h-4 w-4" />
                    {open && <span>Customer Marketer</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Logistics Group - Collapsible */}
                <Collapsible defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="cursor-pointer">
                        <Truck className="h-4 w-4" />
                        {open && <span>Logistic</span>}
                        {open && <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("logistics-order")}
                            isActive={activeView === "logistics-order"}
                            className="cursor-pointer"
                          >
                            <span>Order</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("logistics-processed")}
                            isActive={activeView === "logistics-processed"}
                            className="cursor-pointer"
                          >
                            <span>Processed</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("logistics-return")}
                            isActive={activeView === "logistics-return"}
                            className="cursor-pointer"
                          >
                            <span>Return</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("logistics-pending-tracking")}
                            isActive={activeView === "logistics-pending-tracking"}
                            className="cursor-pointer"
                          >
                            <span>Pending Tracking</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>

                {/* Marketer Group - Collapsible */}
                <Collapsible defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="cursor-pointer">
                        <Megaphone className="h-4 w-4" />
                        {open && <span>Marketer</span>}
                        {open && <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("marketer-management")}
                            isActive={activeView === "marketer-management"}
                            className="cursor-pointer"
                          >
                            <span>My Marketers</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("marketer-reporting")}
                            isActive={activeView === "marketer-reporting"}
                            className="cursor-pointer"
                          >
                            <span>Reporting</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("marketer-top10")}
                            isActive={activeView === "marketer-top10"}
                            className="cursor-pointer"
                          >
                            <span>Top 10</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>

                {/* Agent Group - Collapsible */}
                <Collapsible defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="cursor-pointer">
                        <Users className="h-4 w-4" />
                        {open && <span>Agent</span>}
                        {open && <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("agents")}
                            isActive={activeView === "agents"}
                            className="cursor-pointer"
                          >
                            <span>My Agents</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("transaction-agent")}
                            isActive={activeView === "transaction-agent"}
                            className="cursor-pointer"
                          >
                            <span>Transaction Agent</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("reward-agent-platinum")}
                            isActive={activeView === "reward-agent-platinum"}
                            className="cursor-pointer"
                          >
                            <span>Reward Agent Platinum</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("reward-agent-gold")}
                            isActive={activeView === "reward-agent-gold"}
                            className="cursor-pointer"
                          >
                            <span>Reward Agent Gold</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => onViewChange("reporting-agent")}
                            isActive={activeView === "reporting-agent"}
                            className="cursor-pointer"
                          >
                            <span>Reporting Agent</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
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

  // Marketer Sidebar - separate dashboard for marketers
  if (userRole === "marketer") {
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
                {/* Dashboard */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("dashboard")}
                    isActive={activeView === "dashboard"}
                    className="cursor-pointer"
                  >
                    <Home className="h-4 w-4" />
                    {open && <span>Dashboard</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Order */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("order")}
                    isActive={activeView === "order"}
                    className="cursor-pointer"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {open && <span>Order</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* History */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("history")}
                    isActive={activeView === "history"}
                    className="cursor-pointer"
                  >
                    <FileText className="h-4 w-4" />
                    {open && <span>History</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Leads */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("leads")}
                    isActive={activeView === "leads"}
                    className="cursor-pointer"
                  >
                    <Target className="h-4 w-4" />
                    {open && <span>Leads</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Spend */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("spend")}
                    isActive={activeView === "spend"}
                    className="cursor-pointer"
                  >
                    <DollarSign className="h-4 w-4" />
                    {open && <span>Spend</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Reporting Spend */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("reporting-spend")}
                    isActive={activeView === "reporting-spend"}
                    className="cursor-pointer"
                  >
                    <TrendingUp className="h-4 w-4" />
                    {open && <span>Reporting Spend</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Top 10 */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("top10")}
                    isActive={activeView === "top10"}
                    className="cursor-pointer"
                  >
                    <Award className="h-4 w-4" />
                    {open && <span>Top 10</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* PNL */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("pnl")}
                    isActive={activeView === "pnl"}
                    className="cursor-pointer"
                  >
                    <Calculator className="h-4 w-4" />
                    {open && <span>PNL</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Profile */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("profile")}
                    isActive={activeView === "profile"}
                    className="cursor-pointer"
                  >
                    <User className="h-4 w-4" />
                    {open && <span>Profile</span>}
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
      </Sidebar>
    );
  }

  // Default sidebar for other roles
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
