import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import HQDashboard from "@/components/dashboard/HQDashboard";
import MasterAgentDashboard from "@/components/dashboard/MasterAgentDashboard";
import AgentDashboard from "@/components/dashboard/AgentDashboard";

const Dashboard = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

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
    </>
  );
};

export default Dashboard;
