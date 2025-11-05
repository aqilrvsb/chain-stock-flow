import { useState } from "react";
import DashboardLayout from "./DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import PurchaseProducts from "./common/PurchaseProducts";
import MyInventory from "./common/MyInventory";
import AgentTransactions from "./agent/AgentTransactions";
import MyAnalytics from "./common/MyAnalytics";
import Settings from "./common/Settings";

const AgentDashboard = () => {
  const { user } = useAuth();
  const userName = user?.email?.split("@")[0] || "User";
  const [activeView, setActiveView] = useState("dashboard");

  const renderView = () => {
    switch (activeView) {
      case "purchase":
        return <PurchaseProducts userType="agent" onNavigateToSettings={() => setActiveView("settings")} onNavigateToTransactions={() => setActiveView("transactions")} />;
      case "inventory":
        return <MyInventory />;
      case "transactions":
        return <AgentTransactions />;
      case "analytics":
        return <MyAnalytics />;
      case "settings":
        return <Settings />;
      case "dashboard":
      default:
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Welcome back, {userName}!
              </h1>
              <p className="text-muted-foreground mt-2">
                Here's an overview of your purchases and performance.
              </p>
            </div>
            <MyAnalytics />
          </div>
        );
    }
  };

  return (
    <DashboardLayout activeView={activeView} onViewChange={setActiveView}>
      {renderView()}
    </DashboardLayout>
  );
};

export default AgentDashboard;
