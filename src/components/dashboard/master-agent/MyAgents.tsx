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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Users, UserCheck, UserX } from "lucide-react";
import { format } from "date-fns";
import Swal from "sweetalert2";
import { MALAYSIA_STATES } from "@/constants/malaysiaStates";

const MyAgents = () => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [idstaff, setIdstaff] = useState("");
  const [state, setState] = useState("");
  const [subRole, setSubRole] = useState<string>("platinum");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: agents, isLoading } = useQuery({
    queryKey: ["my-agents", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          user_roles!user_roles_user_id_fkey!inner(role),
          master_agent_relationships!master_agent_relationships_agent_id_fkey!inner(master_agent_id)
        `)
        .eq("user_roles.role", "agent")
        .eq("master_agent_relationships.master_agent_id", user?.id)
        .order("idstaff", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const stats = {
    total: agents?.length || 0,
    active: agents?.filter(u => u.is_active)?.length || 0,
    inactive: agents?.filter(u => !u.is_active)?.length || 0,
  };

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
          state: agentData.state,
          subRole: agentData.subRole,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-agents"] });
      setIsAddOpen(false);
      resetForm();
      toast({ title: "Agent created successfully" });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: "error",
        title: "Error Creating Agent",
        text: error.message,
        confirmButtonText: "OK",
      });
    },
  });

  const updateUser = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-agents"] });
      toast({ title: "Agent updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating Agent",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (userData: any) => {
      // Update profile information
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: userData.fullName,
          idstaff: userData.idstaff,
          state: userData.state,
        })
        .eq("id", userData.id);

      if (error) throw error;

      // Update password if provided
      if (userData.newPassword) {
        const { data, error: pwdError } = await supabase.functions.invoke('update-user-password', {
          body: {
            userId: userData.id,
            password: userData.newPassword,
          },
        });

        if (pwdError) throw pwdError;
        if (data?.error) throw new Error(data.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-agents"] });
      setIsEditOpen(false);
      resetForm();
      toast({ title: "Agent updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating Agent",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProfile = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-agents"] });
      setDeleteUserId(null);
      toast({ title: "Agent deleted successfully" });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: "error",
        title: "Error Deleting Agent",
        text: error.message || "Failed to delete agent",
        confirmButtonText: "OK",
      });
      setDeleteUserId(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAgent.mutate({ email, password, fullName, idstaff, state, subRole });
  };

  const handleToggleActive = (userId: string, currentStatus: boolean) => {
    updateUser.mutate({ id: userId, isActive: !currentStatus });
  };

  const handleEdit = (agent: any) => {
    setEditingUser(agent);
    setFullName(agent.full_name || "");
    setIdstaff(agent.idstaff || "");
    setEmail(agent.email);
    setState(agent.state || "");
    setNewPassword("");
    setIsEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({
      id: editingUser.id,
      fullName,
      idstaff,
      state,
      newPassword,
    });
  };

  const handleDelete = (userId: string) => {
    setDeleteUserId(userId);
  };

  const confirmDelete = () => {
    if (deleteUserId) {
      deleteProfile.mutate(deleteUserId);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setNewPassword("");
    setFullName("");
    setIdstaff("");
    setState("");
    setSubRole("platinum");
    setEditingUser(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <UserX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inactive}</div>
          </CardContent>
        </Card>
      </div>

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
                  <Label htmlFor="idstaff">ID Staff</Label>
                  <Input
                    id="idstaff"
                    value={idstaff}
                    onChange={(e) => setIdstaff(e.target.value)}
                    required
                    placeholder="Unique staff ID"
                  />
                </div>
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
                    minLength={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {MALAYSIA_STATES.map((stateName) => (
                        <SelectItem key={stateName} value={stateName}>
                          {stateName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subRole">Role Tier</Label>
                  <Select value={subRole} onValueChange={setSubRole} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="platinum">Platinum</SelectItem>
                      <SelectItem value="gold">Gold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createAgent.isPending}>
                  Create Agent
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Agent</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-idstaff">ID Staff</Label>
                  <Input
                    id="edit-idstaff"
                    value={idstaff}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-fullName">Full Name</Label>
                  <Input
                    id="edit-fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={email}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-state">State</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {MALAYSIA_STATES.map((stateName) => (
                        <SelectItem key={stateName} value={stateName}>
                          {stateName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-password">Change Password (Optional)</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leave blank to keep current password"
                    minLength={4}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={updateProfile.isPending}>
                  Update Agent
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the agent account.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading agents...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IDSTAFF</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents?.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.idstaff || "N/A"}</TableCell>
                    <TableCell>{agent.full_name || "N/A"}</TableCell>
                    <TableCell>{agent.email}</TableCell>
                    <TableCell>{agent.state || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={agent.is_active ? "default" : "secondary"}>
                        {agent.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(agent.created_at), "dd-MM-yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={agent.is_active}
                          onCheckedChange={() => handleToggleActive(agent.id, agent.is_active)}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(agent)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(agent.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyAgents;
