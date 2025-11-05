import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Users, UserCheck, UserX } from "lucide-react";
import Swal from "sweetalert2";
import { format } from "date-fns";
import { MALAYSIA_STATES } from "@/constants/malaysiaStates";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MasterAgentManagement = () => {
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: masterAgents, isLoading } = useQuery({
    queryKey: ["master_agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          user_roles!user_roles_user_id_fkey!inner(role)
        `)
        .eq("user_roles.role", "master_agent")
        .order("idstaff", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const stats = {
    total: masterAgents?.length || 0,
    active: masterAgents?.filter(u => u.is_active)?.length || 0,
    inactive: masterAgents?.filter(u => !u.is_active)?.length || 0,
  };

  const createUser = useMutation({
    mutationFn: async (userData: any) => {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: userData.email,
          password: userData.password,
          fullName: userData.fullName,
          role: 'master_agent',
          idstaff: userData.idstaff,
          state: userData.state,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master_agents"] });
      setIsAddOpen(false);
      resetForm();
      toast({ title: "Master Agent created successfully" });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: "error",
        title: "Error Creating Master Agent",
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
      queryClient.invalidateQueries({ queryKey: ["master_agents"] });
      toast({ title: "Master Agent updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating Master Agent",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createUser.mutate({ email, password, fullName, idstaff, state });
  };

  const handleToggleActive = (userId: string, currentStatus: boolean) => {
    updateUser.mutate({ id: userId, isActive: !currentStatus });
  };

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
      queryClient.invalidateQueries({ queryKey: ["master_agents"] });
      setIsEditOpen(false);
      resetForm();
      toast({ title: "Master Agent updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating Master Agent",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProfile = useMutation({
    mutationFn: async (userId: string) => {
      // First delete user_roles
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (roleError) throw roleError;

      // Then delete from auth
      const { error: authError } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      if (authError) throw authError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master_agents"] });
      setDeleteUserId(null);
      toast({ title: "Master Agent deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting Master Agent",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setFullName(user.full_name || "");
    setIdstaff(user.idstaff || "");
    setEmail(user.email);
    setState(user.state || "");
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
    setEditingUser(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Master Agents</CardTitle>
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
          <CardTitle>Master Agent Management</CardTitle>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Master Agent
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register New Master Agent</DialogTitle>
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
                <Button type="submit" className="w-full" disabled={createUser.isPending}>
                  Create Master Agent
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Master Agent</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-idstaff">ID Staff</Label>
                  <Input
                    id="edit-idstaff"
                    value={idstaff}
                    onChange={(e) => setIdstaff(e.target.value)}
                    required
                    placeholder="Unique staff ID"
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
                  Update Master Agent
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the master agent account.
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
            <p>Loading master agents...</p>
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
                {masterAgents?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.idstaff || "N/A"}</TableCell>
                    <TableCell>{user.full_name || "N/A"}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.state || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "secondary"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), "dd-MM-yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={user.is_active}
                          onCheckedChange={() => handleToggleActive(user.id, user.is_active)}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(user.id)}
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

export default MasterAgentManagement;
