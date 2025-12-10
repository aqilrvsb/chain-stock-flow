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
import { Users, Plus, Loader2, Eye, EyeOff } from "lucide-react";

const MarketerManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [idStaff, setIdStaff] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

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
                  <TableHead className="text-right">Active</TableHead>
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
                    <TableCell className="text-right">
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

export default MarketerManagement;
