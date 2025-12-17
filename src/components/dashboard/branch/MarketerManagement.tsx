import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Users, Plus, Loader2, Eye, EyeOff, Trash2, Pencil } from "lucide-react";
import Swal from "sweetalert2";

const MarketerManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [idStaff, setIdStaff] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  // Edit state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMarketer, setEditingMarketer] = useState<any>(null);
  const [editFullName, setEditFullName] = useState("");

  // Fetch marketers under this branch - simple query by branch_id
  // Marketers have branch_id set to the Branch user who created them
  const { data: marketers = [], isLoading } = useQuery({
    queryKey: ["branch-marketers", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, idstaff, full_name, is_active, created_at")
        .eq("branch_id", user?.id)
        .not("idstaff", "is", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching marketers:", error);
        throw error;
      }
      console.log("Fetched marketers:", data);
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Register marketer mutation using edge function
  const registerMutation = useMutation({
    mutationFn: async ({
      idStaff,
      fullName,
      password,
    }: {
      idStaff: string;
      fullName: string;
      password: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("register-marketer", {
        body: { idStaff, fullName, password },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data.user;
    },
    onSuccess: () => {
      toast.success("Marketer registered successfully");
      queryClient.invalidateQueries({ queryKey: ["branch-marketers"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to register marketer");
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({
      marketerId,
      isActive,
    }: {
      marketerId: string;
      isActive: boolean;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: isActive })
        .eq("id", marketerId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["branch-marketers"] });
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  // Update marketer name mutation
  const updateMarketerMutation = useMutation({
    mutationFn: async ({
      marketerId,
      fullName,
    }: {
      marketerId: string;
      fullName: string;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", marketerId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marketer name updated successfully");
      queryClient.invalidateQueries({ queryKey: ["branch-marketers"] });
      setIsEditDialogOpen(false);
      setEditingMarketer(null);
      setEditFullName("");
    },
    onError: () => {
      toast.error("Failed to update marketer name");
    },
  });

  // Open edit dialog
  const openEditDialog = (marketer: any) => {
    setEditingMarketer(marketer);
    setEditFullName(marketer.full_name || "");
    setIsEditDialogOpen(true);
  };

  // Handle edit submit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFullName.trim()) {
      toast.error("Please enter a name");
      return;
    }
    if (!editingMarketer) return;
    updateMarketerMutation.mutate({
      marketerId: editingMarketer.id,
      fullName: editFullName.trim(),
    });
  };

  // Delete marketer and all transactions
  const deleteMarketer = async (marketerId: string, marketerName: string) => {
    const result = await Swal.fire({
      title: "Delete Marketer?",
      html: `
        <p>Are you sure you want to delete <strong>${marketerName}</strong>?</p>
        <p class="text-red-600 mt-2">This will also delete ALL their transactions (orders, customers, etc.)</p>
        <p class="text-sm text-gray-500 mt-2">This action cannot be undone.</p>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete everything",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      // Show loading
      Swal.fire({
        title: "Deleting...",
        text: "Please wait while we delete the marketer and all transactions",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      // 1. Delete customer_purchases (transactions) where marketer_id = marketerId
      const { error: purchasesError } = await supabase
        .from("customer_purchases")
        .delete()
        .eq("marketer_id", marketerId);

      if (purchasesError) {
        console.error("Error deleting purchases:", purchasesError);
        // Continue anyway - might not have any purchases
      }

      // 2. Delete customers created by this marketer
      const { error: customersError } = await supabase
        .from("customers")
        .delete()
        .eq("created_by", marketerId);

      if (customersError) {
        console.error("Error deleting customers:", customersError);
        // Continue anyway
      }

      // 3. Delete the marketer profile
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", marketerId);

      if (profileError) throw profileError;

      // 4. Delete the auth user using edge function
      const { error: authError } = await supabase.functions.invoke("delete-user", {
        body: { userId: marketerId },
      });

      if (authError) {
        console.error("Error deleting auth user:", authError);
        // Profile already deleted, so show partial success
      }

      await Swal.fire({
        title: "Deleted!",
        text: "Marketer and all transactions have been deleted.",
        icon: "success",
      });

      queryClient.invalidateQueries({ queryKey: ["branch-marketers"] });
    } catch (error: any) {
      console.error("Delete error:", error);
      Swal.fire({
        title: "Error",
        text: error.message || "Failed to delete marketer",
        icon: "error",
      });
    }
  };

  const resetForm = () => {
    setIdStaff("");
    setFullName("");
    setPassword("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idStaff || !fullName || !password) {
      toast.error("Please fill all fields");
      return;
    }
    registerMutation.mutate({ idStaff, fullName, password });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Marketer Management</h1>
          <p className="text-muted-foreground mt-2">
            Register and manage your marketers
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Register Marketer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register New Marketer</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="idStaff">Staff ID</Label>
                <Input
                  id="idStaff"
                  value={idStaff}
                  onChange={(e) => setIdStaff(e.target.value.toUpperCase())}
                  placeholder="e.g. MKT001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Password will be stored in uppercase
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={registerMutation.isPending}>
                  {registerMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    "Register"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{marketers.length}</p>
              <p className="text-sm text-muted-foreground">Total Marketers</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Marketers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Marketers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : marketers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No marketers registered yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {marketers.map((marketer: any) => (
                  <TableRow key={marketer.id}>
                    <TableCell className="font-medium">
                      {marketer.idstaff}
                    </TableCell>
                    <TableCell>{marketer.full_name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={marketer.is_active ? "default" : "secondary"}
                      >
                        {marketer.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(marketer.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={marketer.is_active}
                        onCheckedChange={(checked) =>
                          toggleActiveMutation.mutate({
                            marketerId: marketer.id,
                            isActive: checked,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(marketer)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMarketer(marketer.id, marketer.full_name || marketer.idstaff)}
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Edit Marketer Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Marketer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Staff ID</Label>
              <Input
                value={editingMarketer?.idstaff || ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editFullName">Full Name</Label>
              <Input
                id="editFullName"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="Enter full name"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMarketerMutation.isPending}>
                {updateMarketerMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketerManagement;
