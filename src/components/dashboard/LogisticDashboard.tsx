import { useState } from "react";
import DashboardLayout from "./DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import LogisticAnalytics from "./logistic/LogisticAnalytics";
import ProcessedStock from "./logistic/ProcessedStock";
import Settings from "./common/Settings";

const LogisticDashboard = () => {
  const { userProfile } = useAuth();
  const userName = userProfile?.idstaff || "User";
  const [activeView, setActiveView] = useState("dashboard");

  const renderView = () => {
    switch (activeView) {
      case "processed":
        return <ProcessedStock />;
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
                Here's an overview of your logistic operations.
              </p>
            </div>
            <LogisticAnalytics />
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

export default LogisticDashboard;
