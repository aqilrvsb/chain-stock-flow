import { useState } from "react";
import DashboardLayout from "./DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import Analytics from "./hq/Analytics";
import ProductManagement from "./hq/ProductManagement";
import BundleManagement from "./hq/BundleManagement";
import UserManagement from "./hq/UserManagement";
import RewardsManagement from "./hq/RewardsManagement";
import StockOutHQ from "./hq/StockOutHQ";
import StockInHQ from "./hq/StockInHQ";
import RewardMasterAgent from "./hq/RewardMasterAgent";
import RewardAgent from "./hq/RewardAgent";
import TransactionManagement from "./hq/TransactionManagement";
import TransactionAgent from "./hq/TransactionAgent";
import ReportingMasterAgent from "./hq/ReportingMasterAgent";
import ReportingAgent from "./hq/ReportingAgent";
import Settings from "./common/Settings";

const HQDashboard = () => {
  const { userProfile } = useAuth();
  const userName = userProfile?.idstaff || "User";
  const [activeView, setActiveView] = useState("dashboard");

  const renderView = () => {
    switch (activeView) {
      case "products":
        return <ProductManagement />;
      case "pricing":
        return <BundleManagement />;
      case "users":
        return <UserManagement />;
      case "stock-out-hq":
        return <StockOutHQ />;
      case "stock-in-hq":
        return <StockInHQ />;
      case "rewards":
        return <RewardsManagement />;
      case "reward-ma":
        return <RewardMasterAgent />;
      case "reward-agent":
        return <RewardAgent />;
      case "transactions":
        return <TransactionManagement />;
      case "transaction-agent":
        return <TransactionAgent />;
      case "reporting-ma":
        return <ReportingMasterAgent />;
      case "reporting-agent":
        return <ReportingAgent />;
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
                Here's an overview of your system and performance.
              </p>
            </div>
            <Analytics />
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

export default HQDashboard;
