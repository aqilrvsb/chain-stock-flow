import { useState } from "react";
import DashboardLayout from "./DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import MasterAgentInventory from "./master-agent/MasterAgentInventory";
import MyAgents from "./master-agent/MyAgents";
import TransactionAgent from "./master-agent/TransactionAgent";
import RewardAgentPlatinum from "./master-agent/RewardAgentPlatinum";
import RewardAgentGold from "./master-agent/RewardAgentGold";
import ReportingAgent from "./master-agent/ReportingAgent";
import MyAnalytics from "./common/MyAnalytics";
import Settings from "./common/Settings";
import Customers from "./common/Customers";
import StockInBranch from "./branch/StockInBranch";
import StockOutBranch from "./branch/StockOutBranch";
import BranchLogistics from "./branch/BranchLogistics";

const BranchDashboard = () => {
  const { userProfile } = useAuth();
  const userName = userProfile?.idstaff || "User";
  const [activeView, setActiveView] = useState("dashboard");
  // Branch always has Customers enabled - no dependency on HQ settings

  const renderView = () => {
    switch (activeView) {
      case "inventory":
        return <MasterAgentInventory />;
      case "stock-in":
        return <StockInBranch />;
      case "stock-out":
        return <StockOutBranch />;
      case "agents":
        return <MyAgents />;
      case "customers":
        return <Customers userType="branch" />;
      case "logistics":
        return <BranchLogistics />;
      case "transaction-agent":
        return <TransactionAgent />;
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
                Here's an overview of your branch operations and agent network.
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

export default BranchDashboard;
