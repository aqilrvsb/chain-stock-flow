import { useState, useMemo } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Search, DollarSign, Pencil, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

const PLATFORMS = ["Facebook", "Database", "Shopee", "Tiktok", "Google"];

const MarketerSpend = () => {
  const { user, userProfile } = useAuth();
  const queryClient = useQueryClient();
  const userIdStaff = userProfile?.idstaff;

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSpend, setEditingSpend] = useState<any>(null);

  // Form state
  const [product, setProduct] = useState("");
  const [platform, setPlatform] = useState("");
  const [totalSpend, setTotalSpend] = useState("");
  const [tarikhSpend, setTarikhSpend] = useState(format(new Date(), "yyyy-MM-dd"));

  // Filter state
  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));

  // Fetch spends
  const { data: spends = [], isLoading } = useQuery({
    queryKey: ["marketer-spends-list", userIdStaff, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("spends")
        .select("*")
        .eq("marketer_id_staff", userIdStaff)
        .order("tarikh_spend", { ascending: false });

      if (startDate) {
        query = query.gte("tarikh_spend", startDate);
      }
      if (endDate) {
        query = query.lte("tarikh_spend", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!userIdStaff,
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("name")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingSpend) {
        const { error } = await supabase
          .from("spends")
          .update({
            product: data.product,
            jenis_platform: data.platform,
            total_spend: parseFloat(data.totalSpend),
            tarikh_spend: data.tarikhSpend,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingSpend.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("spends").insert({
          product: data.product,
          jenis_platform: data.platform,
          total_spend: parseFloat(data.totalSpend),
          tarikh_spend: data.tarikhSpend,
          marketer_id_staff: userIdStaff,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingSpend ? "Spend updated" : "Spend added");
      queryClient.invalidateQueries({ queryKey: ["marketer-spends"] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save spend");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("spends").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Spend deleted");
      queryClient.invalidateQueries({ queryKey: ["marketer-spends"] });
    },
    onError: () => {
      toast.error("Failed to delete spend");
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSpend(null);
    setProduct("");
    setPlatform("");
    setTotalSpend("");
    setTarikhSpend(format(new Date(), "yyyy-MM-dd"));
  };

  const handleEdit = (spend: any) => {
    setEditingSpend(spend);
    setProduct(spend.product || "");
    setPlatform(spend.jenis_platform || "");
    setTotalSpend(spend.total_spend?.toString() || "");
    setTarikhSpend(spend.tarikh_spend || format(new Date(), "yyyy-MM-dd"));
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !platform || !totalSpend || !tarikhSpend) {
      toast.error("Please fill all required fields");
      return;
    }
    saveMutation.mutate({ product, platform, totalSpend, tarikhSpend });
  };

  // Stats
  const stats = useMemo(() => {
    const total = spends.reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0);
    const byPlatform: Record<string, number> = {};
    spends.forEach((s: any) => {
      const platform = s.jenis_platform || "Other";
      byPlatform[platform] = (byPlatform[platform] || 0) + (Number(s.total_spend) || 0);
    });
    return { total, byPlatform };
  }, [spends]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Spend Management</h1>
          <p className="text-muted-foreground mt-2">Track your marketing spend</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleCloseDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Spend
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSpend ? "Edit Spend" : "Add Spend"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Product *</Label>
                <Select value={product} onValueChange={setProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Platform *</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount (RM) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={totalSpend}
                  onChange={(e) => setTotalSpend(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={tarikhSpend}
                  onChange={(e) => setTarikhSpend(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingSpend ? (
                    "Update"
                  ) : (
                    "Add"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-red-500" />
              <div>
                <p className="text-lg font-bold">RM {stats.total.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Total Spend</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {PLATFORMS.map((platform) => (
          <Card key={platform}>
            <CardContent className="p-4">
              <p className="text-lg font-bold">
                RM {(stats.byPlatform[platform] || 0).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">{platform}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spends.length > 0 ? (
                  spends.map((spend: any, idx: number) => (
                    <TableRow key={spend.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{spend.tarikh_spend}</TableCell>
                      <TableCell>{spend.product}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{spend.jenis_platform}</Badge>
                      </TableCell>
                      <TableCell>RM {Number(spend.total_spend || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(spend)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(spend.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No spend records found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketerSpend;
