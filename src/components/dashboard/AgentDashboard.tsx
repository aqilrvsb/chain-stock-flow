import { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerSegment } from "@/hooks/useCustomerSegment";
import PurchaseProducts from "./common/PurchaseProducts";
import AgentInventory from "./agent/AgentInventory";
import AgentTransactions from "./agent/AgentTransactions";
import MyAnalytics from "./common/MyAnalytics";
import Settings from "./common/Settings";
import Customers from "./common/Customers";

const AgentDashboard = () => {
  const { userProfile } = useAuth();
  const userName = userProfile?.idstaff || "User";
  const [activeView, setActiveView] = useState("dashboard");
  const { isCustomerSegmentEnabled } = useCustomerSegment();

  // Redirect to dashboard if customer segment is disabled and user is on customers view
  useEffect(() => {
    if (!isCustomerSegmentEnabled && activeView === "customers") {
      setActiveView("dashboard");
    }
  }, [isCustomerSegmentEnabled, activeView]);

  const renderView = () => {
    switch (activeView) {
      case "purchase":
        return <PurchaseProducts userType="agent" onNavigateToSettings={() => setActiveView("settings")} onNavigateToTransactions={() => setActiveView("transactions")} />;
      case "inventory":
        return <AgentInventory />;
      case "customers":
        return <Customers userType="agent" />;
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
