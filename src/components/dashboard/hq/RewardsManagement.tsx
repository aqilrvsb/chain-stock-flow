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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

const RewardsManagement = () => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedReward, setSelectedReward] = useState<any>(null);
  const [role, setRole] = useState<"master_agent" | "agent">("master_agent");
  const [minQuantity, setMinQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [month, setMonth] = useState("1");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [filterYear, setFilterYear] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rewards, isLoading } = useQuery({
    queryKey: ["rewards", filterYear],
    queryFn: async () => {
      let query = supabase
        .from("rewards_config")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: true });
      
      if (filterYear && filterYear !== "all") {
        query = query.eq("year", parseInt(filterYear));
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
  });

  const createReward = useMutation({
    mutationFn: async (rewardData: any) => {
      const { data, error } = await supabase
        .from("rewards_config")
        .insert(rewardData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      setIsAddOpen(false);
      resetForm();
      toast({ title: "Reward created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating reward",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateReward = useMutation({
    mutationFn: async (rewardData: any) => {
      const { data, error } = await supabase
        .from("rewards_config")
        .update(rewardData)
        .eq("id", selectedReward.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      setIsEditOpen(false);
      setSelectedReward(null);
      resetForm();
      toast({ title: "Reward updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating reward",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteReward = useMutation({
    mutationFn: async (rewardId: string) => {
      const { error } = await supabase
        .from("rewards_config")
        .delete()
        .eq("id", rewardId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      setIsDeleteOpen(false);
      setSelectedReward(null);
      toast({ title: "Reward deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting reward",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleRewardStatus = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("rewards_config")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      toast({ title: "Reward status updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating reward status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createReward.mutate({
      role,
      min_quantity: parseInt(minQuantity),
      reward_description: description,
      month: parseInt(month),
      year: parseInt(year),
    });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    updateReward.mutate({
      role,
      min_quantity: parseInt(minQuantity),
      reward_description: description,
      month: parseInt(month),
      year: parseInt(year),
    });
  };

  const handleDelete = () => {
    if (selectedReward) {
      deleteReward.mutate(selectedReward.id);
    }
  };

  const openEditDialog = (reward: any) => {
    setSelectedReward(reward);
    setRole(reward.role);
    setMinQuantity(reward.min_quantity.toString());
    setDescription(reward.reward_description);
    setMonth(reward.month.toString());
    setYear(reward.year.toString());
    setIsEditOpen(true);
  };

  const openDeleteDialog = (reward: any) => {
    setSelectedReward(reward);
    setIsDeleteOpen(true);
  };

  const resetForm = () => {
    setRole("master_agent");
    setMinQuantity("");
    setDescription("");
    setMonth("1");
    setYear(new Date().getFullYear().toString());
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          Rewards Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure monthly rewards for achieving sales targets
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Rewards Configuration</CardTitle>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <Label htmlFor="filterYear">Filter by Year:</Label>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Reward
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Reward</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Target Role</Label>
                    <Select value={role} onValueChange={(value: any) => setRole(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="master_agent">Master Agent</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minQuantity">Target Quantity Achieve</Label>
                    <Input
                      id="minQuantity"
                      type="number"
                      value={minQuantity}
                      onChange={(e) => setMinQuantity(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Reward Description</Label>
                    <Input
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="month">Month</Label>
                    <Select value={month} onValueChange={setMonth}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {monthNames.map((name, index) => (
                          <SelectItem key={index + 1} value={(index + 1).toString()}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year">Year</Label>
                    <Select value={year} onValueChange={setYear}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((y) => (
                          <SelectItem key={y} value={y.toString()}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={createReward.isPending}>
                    Create Reward
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Reward</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleEdit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-role">Target Role</Label>
                    <Select value={role} onValueChange={(value: any) => setRole(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="master_agent">Master Agent</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-minQuantity">Target Quantity Achieve</Label>
                    <Input
                      id="edit-minQuantity"
                      type="number"
                      value={minQuantity}
                      onChange={(e) => setMinQuantity(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-description">Reward Description</Label>
                    <Input
                      id="edit-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-month">Month</Label>
                    <Select value={month} onValueChange={setMonth}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {monthNames.map((name, index) => (
                          <SelectItem key={index + 1} value={(index + 1).toString()}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-year">Year</Label>
                    <Select value={year} onValueChange={setYear}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((y) => (
                          <SelectItem key={y} value={y.toString()}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={updateReward.isPending}>
                    Update Reward
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the reward configuration.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading rewards...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target Role</TableHead>
                  <TableHead>Target Quantity</TableHead>
                  <TableHead>Reward Description</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rewards?.map((reward) => (
                  <TableRow key={reward.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {reward.role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>{reward.min_quantity}</TableCell>
                    <TableCell>{reward.reward_description}</TableCell>
                    <TableCell>{monthNames[reward.month - 1]}</TableCell>
                    <TableCell>{reward.year}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={reward.is_active}
                          onCheckedChange={(checked) => 
                            toggleRewardStatus.mutate({ id: reward.id, isActive: checked })
                          }
                        />
                        <Badge variant={reward.is_active ? "default" : "secondary"}>
                          {reward.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(reward)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(reward)}
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

export default RewardsManagement;
