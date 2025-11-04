import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MasterAgentManagement from "./MasterAgentManagement";
import AgentManagement from "./AgentManagement";

const UserManagement = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">User Management</h1>
      <Tabs defaultValue="master_agents" className="w-full">
        <TabsList>
          <TabsTrigger value="master_agents">Master Agents</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
        </TabsList>
        <TabsContent value="master_agents">
          <MasterAgentManagement />
        </TabsContent>
        <TabsContent value="agents">
          <AgentManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserManagement;
