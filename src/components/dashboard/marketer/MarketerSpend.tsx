import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Plus, DollarSign, RotateCcw, Pencil, Trash2 } from "lucide-react";

const PLATFORM_OPTIONS = ["Facebook", "Tiktok", "Shopee", "Database", "Google"];
const JENIS_CLOSING_OPTIONS = ["Website", "WhatsappBot", "Manual", "Call", "Live", "Shop"];

const MarketerSpend = () => {
  const { user, userProfile } = useAuth();
  const queryClient = useQueryClient();
  const userIdStaff = userProfile?.idstaff;

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSpend, setEditingSpend] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [spendToDelete, setSpendToDelete] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    product: "",
    jenisPlatform: "",
    jenisClosing: "",
    totalSpend: "",
    tarikhSpend: "",
  });

  // Filter state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Fetch spends
  const { data: spends = [], isLoading } = useQuery({
    queryKey: ["marketer-spends", userIdStaff],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spends")
        .select("*")
        .eq("marketer_id_staff", userIdStaff)
        .order("created_at", { ascending: false });
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
        .select("id, name")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  // Filter spends based on date range
  const filteredSpends = useMemo(() => {
    return spends.filter((spend: any) => {
      const spendDate = spend.tarikh_spend;
      const matchesStartDate = !startDate || (spendDate && spendDate >= startDate);
      const matchesEndDate = !endDate || (spendDate && spendDate <= endDate);
      return matchesStartDate && matchesEndDate;
    });
  }, [spends, startDate, endDate]);

  // Calculate stats - Total Spend and dynamic platform totals
  const stats = useMemo(() => {
    const totalSpend = filteredSpends.reduce((sum: number, s: any) => sum + (Number(s.total_spend) || 0), 0);

    // Calculate spend by platform dynamically
    const platformSpends: Record<string, number> = {};
    filteredSpends.forEach((spend: any) => {
      const platform = spend.jenis_platform;
      if (platform) {
        platformSpends[platform] = (platformSpends[platform] || 0) + (Number(spend.total_spend) || 0);
      }
    });

    return { totalSpend, platformSpends };
  }, [filteredSpends]);

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingSpend) {
        const { error } = await supabase
          .from("spends")
          .update({
            product: data.product,
            jenis_platform: data.jenisPlatform,
            jenis_closing: data.jenisClosing,
            total_spend: parseFloat(data.totalSpend),
            tarikh_spend: data.tarikhSpend,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingSpend.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("spends").insert({
          product: data.product,
          jenis_platform: data.jenisPlatform,
          jenis_closing: data.jenisClosing,
          total_spend: parseFloat(data.totalSpend),
          tarikh_spend: data.tarikhSpend,
          marketer_id_staff: userIdStaff,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingSpend ? "Spend Dikemaskini" : "Spend Ditambah");
      queryClient.invalidateQueries({ queryKey: ["marketer-spends"] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "Gagal menyimpan spend");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("spends").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Spend Dipadam");
      queryClient.invalidateQueries({ queryKey: ["marketer-spends"] });
    },
    onError: () => {
      toast.error("Gagal memadam spend");
    },
  });

  const resetFilters = () => {
    setStartDate("");
    setEndDate("");
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSpend(null);
    setFormData({
      product: "",
      jenisPlatform: "",
      jenisClosing: "",
      totalSpend: "",
      tarikhSpend: "",
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditClick = (spend: any) => {
    setEditingSpend(spend);
    setFormData({
      product: spend.product || "",
      jenisPlatform: spend.jenis_platform || "",
      jenisClosing: spend.jenis_closing || "",
      totalSpend: spend.total_spend?.toString() || "",
      tarikhSpend: spend.tarikh_spend || "",
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setSpendToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!spendToDelete) return;
    try {
      await deleteMutation.mutateAsync(spendToDelete);
    } finally {
      setDeleteDialogOpen(false);
      setSpendToDelete(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.product || !formData.jenisPlatform || !formData.jenisClosing || !formData.totalSpend || !formData.tarikhSpend) {
      toast.error("Sila lengkapkan semua medan yang diperlukan.");
      return;
    }

    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Spend</h1>
          <p className="text-muted-foreground">Urus perbelanjaan marketing</p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) handleCloseDialog();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Spend
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingSpend ? "Edit Spend" : "Add New Spend"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product">Product *</Label>
                <Select value={formData.product} onValueChange={(value) => handleChange("product", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product: any) => (
                      <SelectItem key={product.id} value={product.name}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="jenisPlatform">Jenis Platform *</Label>
                <Select value={formData.jenisPlatform} onValueChange={(value) => handleChange("jenisPlatform", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="jenisClosing">Jenis Closing *</Label>
                <Select value={formData.jenisClosing} onValueChange={(value) => handleChange("jenisClosing", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jenis closing" />
                  </SelectTrigger>
                  <SelectContent>
                    {JENIS_CLOSING_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalSpend">Total Spend (RM) *</Label>
                <Input
                  id="totalSpend"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.totalSpend}
                  onChange={(e) => handleChange("totalSpend", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tarikhSpend">Tarikh Spend *</Label>
                <Input
                  id="tarikhSpend"
                  type="date"
                  value={formData.tarikhSpend}
                  onChange={(e) => handleChange("tarikhSpend", e.target.value)}
                />
              </div>
              <DialogFooter className="gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    handleCloseDialog();
                  }}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingSpend ? "Kemaskini" : "Tambah"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards - Total Spend + Platform Totals */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="w-4 h-4 text-green-500" />
            <span className="text-xs uppercase font-medium">Total Spend</span>
          </div>
          <p className="text-xl font-bold text-foreground">RM {stats.totalSpend.toFixed(2)}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="w-4 h-4 text-blue-500" />
            <span className="text-xs uppercase font-medium">Total Spend FB</span>
          </div>
          <p className="text-xl font-bold text-foreground">RM {(stats.platformSpends["Facebook"] || 0).toFixed(2)}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="w-4 h-4 text-purple-500" />
            <span className="text-xs uppercase font-medium">Total Spend Database</span>
          </div>
          <p className="text-xl font-bold text-foreground">RM {(stats.platformSpends["Database"] || 0).toFixed(2)}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="w-4 h-4 text-orange-500" />
            <span className="text-xs uppercase font-medium">Total Spend Google</span>
          </div>
          <p className="text-xl font-bold text-foreground">RM {(stats.platformSpends["Google"] || 0).toFixed(2)}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="w-4 h-4 text-pink-500" />
            <span className="text-xs uppercase font-medium">Total Spend Tiktok</span>
          </div>
          <p className="text-xl font-bold text-foreground">RM {(stats.platformSpends["Tiktok"] || 0).toFixed(2)}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="w-4 h-4 text-red-500" />
            <span className="text-xs uppercase font-medium">Total Spend Shopee</span>
          </div>
          <p className="text-xl font-bold text-foreground">RM {(stats.platformSpends["Shopee"] || 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-muted-foreground mb-1">Start Date</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-background" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-muted-foreground mb-1">End Date</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-background" />
          </div>
          <Button variant="outline" onClick={resetFilters}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-16">No</TableHead>
              <TableHead>Tarikh Spend</TableHead>
              <TableHead className="text-right">Total Spend</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Jenis Closing</TableHead>
              <TableHead className="w-24">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSpends.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Tiada data spend
                </TableCell>
              </TableRow>
            ) : (
              filteredSpends.map((spend: any, idx: number) => (
                <TableRow key={spend.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{idx + 1}</TableCell>
                  <TableCell>{spend.tarikh_spend}</TableCell>
                  <TableCell className="text-right">RM {Number(spend.total_spend || 0).toFixed(2)}</TableCell>
                  <TableCell>{spend.product}</TableCell>
                  <TableCell>{spend.jenis_platform}</TableCell>
                  <TableCell>{spend.jenis_closing || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditClick(spend)}
                        className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(spend.id)}
                        className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Padam Spend?</AlertDialogTitle>
            <AlertDialogDescription>
              Adakah anda pasti mahu memadam spend ini? Tindakan ini tidak boleh dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
              Padam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MarketerSpend;
