import { useState } from "react";
import DashboardLayout from "./DashboardLayout";
import BranchProductManagement from "./branch/BranchProductManagement";
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
import LogisticsOrder from "./branch/LogisticsOrder";
import LogisticsProcessed from "./branch/LogisticsProcessed";
import LogisticsReturn from "./branch/LogisticsReturn";
import LogisticsPendingTracking from "./branch/LogisticsPendingTracking";
import MarketerManagement from "./branch/MarketerManagement";
import CustomerMarketer from "./branch/CustomerMarketer";
import BranchDashboardView from "./branch/BranchDashboardView";
import MarketerTop10 from "./marketer/MarketerTop10";
import BranchSpend from "./branch/BranchSpend";
import BranchReportingSpend from "./branch/BranchReportingSpend";
import BranchLeads from "./branch/BranchLeads";

const BranchDashboard = () => {
  const [activeView, setActiveView] = useState("dashboard");

  const renderView = () => {
    switch (activeView) {
      case "inventory":
        return <BranchProductManagement />;
      case "stock-in":
        return <StockInBranch />;
      case "stock-out":
        return <StockOutBranch />;
      case "agents":
        return <MyAgents />;
      case "customers":
        return <Customers userType="branch" />;
      case "customer-marketer":
        return <CustomerMarketer />;
      case "logistics-order":
        return <LogisticsOrder />;
      case "logistics-processed":
        return <LogisticsProcessed />;
      case "logistics-return":
        return <LogisticsReturn />;
      case "logistics-pending-tracking":
        return <LogisticsPendingTracking />;
      case "marketer-management":
        return <MarketerManagement />;
      case "marketer-top10":
        return <MarketerTop10 />;
      case "transaction-agent":
        return <TransactionAgent />;
      case "reward-agent-platinum":
        return <RewardAgentPlatinum />;
      case "reward-agent-gold":
        return <RewardAgentGold />;
      case "reporting-agent":
        return <ReportingAgent />;
      case "branch-spend":
        return <BranchSpend />;
      case "branch-reporting-spend":
        return <BranchReportingSpend />;
      case "branch-leads":
        return <BranchLeads />;
      case "analytics":
        return <MyAnalytics />;
      case "settings":
        return <Settings />;
      case "profile":
        return <Settings />; // Reuse Settings for profile for now
      case "dashboard":
      default:
        return <BranchDashboardView />;
    }
  };

  return (
    <DashboardLayout activeView={activeView} onViewChange={setActiveView}>
      {renderView()}
    </DashboardLayout>
  );
};

export default BranchDashboard;
