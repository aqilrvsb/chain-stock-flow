import { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerSegment } from "@/hooks/useCustomerSegment";
import PurchaseProducts from "./common/PurchaseProducts";
import TransactionHistory from "./common/TransactionHistory";
import MasterAgentInventory from "./master-agent/MasterAgentInventory";
import MyAgents from "./master-agent/MyAgents";
import TransactionAgent from "./master-agent/TransactionAgent";
import RewardAgentMA from "./master-agent/RewardAgentMA";
import RewardAgentPlatinum from "./master-agent/RewardAgentPlatinum";
import RewardAgentGold from "./master-agent/RewardAgentGold";
import ReportingAgent from "./master-agent/ReportingAgent";
import MyAnalytics from "./common/MyAnalytics";
import Settings from "./common/Settings";
import Customers from "./common/Customers";

const MasterAgentDashboard = () => {
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
        return <PurchaseProducts userType="master_agent" onNavigateToSettings={() => setActiveView("settings")} onNavigateToTransactions={() => setActiveView("transactions")} />;
      case "inventory":
        return <MasterAgentInventory />;
      case "agents":
        return <MyAgents />;
      case "customers":
        return <Customers userType="master_agent" />;
      case "transactions":
        return <TransactionHistory />;
      case "transaction-agent":
        return <TransactionAgent />;
      case "reward-agent":
        return <RewardAgentMA />;
      case "reward-agent-platinum":
        return <RewardAgentPlatinum />;
      case "reward-agent-gold":
        return <RewardAgentGold />;
      case "reporting-agent":
        return <ReportingAgent />;
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
                Here's an overview of your distribution network and performance.
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

export default MasterAgentDashboard;
