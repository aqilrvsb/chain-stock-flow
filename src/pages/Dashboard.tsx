import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveStatusCheck } from "@/hooks/useActiveStatusCheck";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import HQDashboard from "@/components/dashboard/HQDashboard";
import MasterAgentDashboard from "@/components/dashboard/MasterAgentDashboard";
import AgentDashboard from "@/components/dashboard/AgentDashboard";
import LogisticDashboard from "@/components/dashboard/LogisticDashboard";
import BranchDashboard from "@/components/dashboard/BranchDashboard";
import MarketerDashboard from "@/components/dashboard/MarketerDashboard";

const Dashboard = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  // Check if user is still active when dashboard loads
  useActiveStatusCheck();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !userRole) {
    return null;
  }

  return (
    <>
      {userRole === "hq" && <HQDashboard />}
      {userRole === "master_agent" && <MasterAgentDashboard />}
      {userRole === "agent" && <AgentDashboard />}
      {userRole === "logistic" && <LogisticDashboard />}
      {userRole === "branch" && <BranchDashboard />}
      {userRole === "marketer" && <MarketerDashboard />}
    </>
  );
};

export default Dashboard;
