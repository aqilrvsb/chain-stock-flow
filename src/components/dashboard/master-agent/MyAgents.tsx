import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

const MyAgents = () => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [idstaff, setIdstaff] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: agents, isLoading } = useQuery({
    queryKey: ["my-agents", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_agent_relationships")
        .select(`
          *,
          agent:profiles!master_agent_relationships_agent_id_fkey(*)
        `)
        .eq("master_agent_id", user?.id);
      
      if (error) throw error;
      return data;
    },
  });

  const createAgent = useMutation({
    mutationFn: async (agentData: any) => {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: agentData.email,
          password: agentData.password,
          fullName: agentData.fullName,
          role: "agent",
          masterAgentId: user?.id,
          idstaff: agentData.idstaff,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-agents"] });
      setIsAddOpen(false);
      resetForm();
      toast({ title: "Agent created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating agent",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAgent.mutate({ email, password, fullName, idstaff });
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setIdstaff("");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>My Agents</CardTitle>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Register Agent
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register New Agent</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="idstaff">ID Staff</Label>
                <Input
                  id="idstaff"
                  value={idstaff}
                  onChange={(e) => setIdstaff(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createAgent.isPending}>
                Create Agent
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Loading agents...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents?.map((relationship) => (
                <TableRow key={relationship.id}>
                  <TableCell>{relationship.agent?.full_name || "N/A"}</TableCell>
                  <TableCell>{relationship.agent?.email}</TableCell>
                  <TableCell>
                    {new Date(relationship.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default MyAgents;
