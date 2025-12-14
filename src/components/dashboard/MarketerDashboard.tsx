import { useState } from "react";
import DashboardLayout from "./DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import MarketerStats from "./marketer/MarketerStats";
import MarketerOrders from "./marketer/MarketerOrders";
import MarketerHistory from "./marketer/MarketerHistory";
import MarketerLeads from "./marketer/MarketerLeads";
import MarketerSpend from "./marketer/MarketerSpend";
import MarketerReportingSpend from "./marketer/MarketerReportingSpend";
import MarketerTop10 from "./marketer/MarketerTop10";
import MarketerPNL from "./marketer/MarketerPNL";
import MarketerProfile from "./marketer/MarketerProfile";

const MarketerDashboard = () => {
  const { userProfile } = useAuth();
  const userName = userProfile?.idstaff || userProfile?.full_name || "Marketer";
  const [activeView, setActiveView] = useState("dashboard");

  const renderView = () => {
    switch (activeView) {
      case "order":
        return <MarketerOrders onNavigate={setActiveView} />;
      case "history":
        return <MarketerHistory />;
      case "leads":
        return <MarketerLeads />;
      case "spend":
        return <MarketerSpend />;
      case "reporting-spend":
        return <MarketerReportingSpend />;
      case "top10":
        return <MarketerTop10 />;
      case "pnl":
        return <MarketerPNL />;
      case "profile":
        return <MarketerProfile />;
      case "dashboard":
      default:
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Welcome back, {userName}!
              </h1>
              <p className="text-muted-foreground mt-2">
                Here's an overview of your marketing performance.
              </p>
            </div>
            <MarketerStats />
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

export default MarketerDashboard;
