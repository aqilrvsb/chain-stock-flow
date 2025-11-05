import { Home, Package, Users, BarChart3, Settings, LogOut, Gift, DollarSign, Award } from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface AppSidebarProps {
  userRole: string | null;
  activeView: string;
  onViewChange: (view: string) => void;
}

export function AppSidebar({ userRole, activeView, onViewChange }: AppSidebarProps) {
  const { open } = useSidebar();
  const { signOut, user } = useAuth();

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
        { title: "Reward Master Agent", icon: Award, value: "reward-ma" },
        { title: "Reward Agent", icon: Award, value: "reward-agent" },
      ];
    } else if (userRole === "master_agent") {
      return [
        { title: "Dashboard", icon: Home, value: "dashboard" },
        { title: "Purchase", icon: Package, value: "purchase" },
        { title: "Inventory", icon: Package, value: "inventory" },
        { title: "My Agents", icon: Users, value: "agents" },
        { title: "Transactions", icon: BarChart3, value: "transactions" },
        { title: "Transaction Agent", icon: DollarSign, value: "transaction-agent" },
      ];
    } else if (userRole === "agent") {
      return [
        { title: "Dashboard", icon: Home, value: "dashboard" },
        { title: "Purchase", icon: Package, value: "purchase" },
        { title: "Inventory", icon: Package, value: "inventory" },
        { title: "Transactions", icon: BarChart3, value: "transactions" },
      ];
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex items-center gap-3 mb-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {user?.email?.[0].toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          {open && (
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.email?.split("@")[0]}</p>
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
