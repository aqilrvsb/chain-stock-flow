import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import * as XLSX from "xlsx";
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
import { toast } from "sonner";
import {
  Loader2,
  Search,
  Users,
  User,
  UserCheck,
  Calendar,
  RotateCcw,
  Download,
  Upload,
  Pencil,
  Trash2,
  FileSpreadsheet,
  DollarSign,
  Target,
  XCircle,
  ShoppingCart,
  UserPlus,
  UserCircle,
} from "lucide-react";

const BranchLeads = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialog/modal state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [prospectToDelete, setProspectToDelete] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showFormatDialog, setShowFormatDialog] = useState(false);
  const [ordersModalOpen, setOrdersModalOpen] = useState(false);
  const [selectedProspectOrders, setSelectedProspectOrders] = useState<any[]>([]);
  const [selectedProspectName, setSelectedProspectName] = useState("");
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    namaProspek: "",
    noTelefon: "",
    niche: "",
    tarikhPhoneNumber: "",
  });

  // Filter state
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Quick search state (search without date filter)
  const [quickSearch, setQuickSearch] = useState("");
  const [isQuickSearchActive, setIsQuickSearchActive] = useState(false);

  // Fetch prospects for this branch (branch_id = user.id)
  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ["branch-prospects", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospects")
        .select("*")
        .eq("created_by", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch products for niche dropdown
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

  // Filter prospects based on search and date range
  const filteredProspects = useMemo(() => {
    return prospects.filter((prospect: any) => {
      // If quick search is active, only filter by name/phone (ignore date filters)
      if (isQuickSearchActive && quickSearch) {
        const searchTerm = quickSearch.toLowerCase();
        return (
          prospect.nama_prospek?.toLowerCase().includes(searchTerm) ||
          prospect.no_telefon?.includes(quickSearch)
        );
      }

      // Normal filter with date range
      const matchesSearch =
        prospect.nama_prospek?.toLowerCase().includes(search.toLowerCase()) ||
        prospect.no_telefon?.includes(search) ||
        prospect.niche?.toLowerCase().includes(search.toLowerCase());

      const prospectDate = prospect.tarikh_phone_number;
      const matchesStartDate = !startDate || (prospectDate && prospectDate >= startDate);
      const matchesEndDate = !endDate || (prospectDate && prospectDate <= endDate);

      return matchesSearch && matchesStartDate && matchesEndDate;
    });
  }, [prospects, search, startDate, endDate, quickSearch, isQuickSearchActive]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalLead = filteredProspects.length;
    const totalNP = filteredProspects.filter((p: any) => p.jenis_prospek === "NP").length;
    const totalEP = filteredProspects.filter((p: any) => p.jenis_prospek === "EP").length;
    const totalSales = filteredProspects
      .filter((p: any) => p.status_closed === "closed")
      .reduce((sum: number, p: any) => sum + (Number(p.price_closed) || 0), 0);
    const leadClose = filteredProspects.filter((p: any) => p.status_closed === "closed").length;
    const leadXClose = filteredProspects.filter((p: any) => !p.status_closed || p.status_closed !== "closed").length;

    // Profile, Proses, X Process stats
    const profileCount = filteredProspects.filter((p: any) => p.profile && p.profile.trim() !== "").length;
    const prosesCount = filteredProspects.filter((p: any) => p.status_closed && p.status_closed.trim() !== "").length;
    const xProsesCount = filteredProspects.filter((p: any) => !p.status_closed || p.status_closed.trim() === "").length;

    const profilePercent = totalLead > 0 ? ((profileCount / totalLead) * 100).toFixed(1) : "0";
    const prosesPercent = totalLead > 0 ? ((prosesCount / totalLead) * 100).toFixed(1) : "0";
    const xProsesPercent = totalLead > 0 ? ((xProsesCount / totalLead) * 100).toFixed(1) : "0";

    return {
      totalLead,
      totalNP,
      totalEP,
      totalSales,
      leadClose,
      leadXClose,
      profileCount,
      prosesCount,
      xProsesCount,
      profilePercent,
      prosesPercent,
      xProsesPercent,
    };
  }, [filteredProspects]);

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingProspect) {
        const { error } = await supabase
          .from("prospects")
          .update({
            nama_prospek: data.namaProspek,
            no_telefon: data.noTelefon,
            niche: data.niche,
            tarikh_phone_number: data.tarikhPhoneNumber,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingProspect.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("prospects").insert({
          nama_prospek: data.namaProspek,
          no_telefon: data.noTelefon,
          niche: data.niche,
          jenis_prospek: "",
          tarikh_phone_number: data.tarikhPhoneNumber,
          created_by: user?.id,
          status_closed: "",
          price_closed: 0,
          count_order: 0,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingProspect ? "Prospect Updated" : "Prospect Added");
      queryClient.invalidateQueries({ queryKey: ["branch-prospects"] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save prospect");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prospects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prospect Deleted");
      queryClient.invalidateQueries({ queryKey: ["branch-prospects"] });
    },
    onError: () => {
      toast.error("Failed to delete prospect");
    },
  });

  const resetFilters = () => {
    setSearch("");
    setStartDate("");
    setEndDate("");
    setQuickSearch("");
    setIsQuickSearchActive(false);
  };

  // Handle quick search button click
  const handleQuickSearch = () => {
    if (quickSearch.trim()) {
      setIsQuickSearchActive(true);
      // Clear date filters when quick search is activated
      setStartDate("");
      setEndDate("");
      setSearch("");
    }
  };

  // Clear quick search
  const clearQuickSearch = () => {
    setQuickSearch("");
    setIsQuickSearchActive(false);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProspect(null);
    setFormData({
      namaProspek: "",
      noTelefon: "",
      niche: "",
      tarikhPhoneNumber: "",
    });
  };

  const handleChange = (field: string, value: string) => {
    let processedValue = value;
    if (field === "namaProspek") {
      processedValue = value.toUpperCase();
    }
    setFormData((prev) => ({ ...prev, [field]: processedValue }));
  };

  const handleEditClick = (prospect: any) => {
    setEditingProspect(prospect);
    setFormData({
      namaProspek: prospect.nama_prospek || "",
      noTelefon: prospect.no_telefon || "",
      niche: prospect.niche || "",
      tarikhPhoneNumber: prospect.tarikh_phone_number || "",
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setProspectToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!prospectToDelete) return;
    try {
      await deleteMutation.mutateAsync(prospectToDelete);
    } finally {
      setDeleteDialogOpen(false);
      setProspectToDelete(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.namaProspek || !formData.noTelefon || !formData.niche || !formData.tarikhPhoneNumber) {
      toast.error("Please fill in all required fields.");
      return;
    }

    // Validate phone starts with 6
    if (!formData.noTelefon.startsWith("6")) {
      toast.error("Phone number must start with 6.");
      return;
    }

    saveMutation.mutate(formData);
  };

  const handleViewOrders = async (prospect: any) => {
    if (!prospect.count_order || prospect.count_order === 0) return;

    setSelectedProspectName(prospect.nama_prospek);
    setIsLoadingOrders(true);
    setOrdersModalOpen(true);

    try {
      const { data: orders, error } = await supabase
        .from("customer_purchases")
        .select("date_order, total_price, produk, quantity")
        .eq("no_phone", prospect.no_telefon)
        .eq("seller_id", user?.id)
        .order("date_order", { ascending: false });

      if (error) throw error;
      setSelectedProspectOrders(orders || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to fetch order list.");
      setSelectedProspectOrders([]);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    if (!validTypes.includes(file.type) && !file.name.endsWith(".csv") && !file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Please upload an Excel (.xlsx, .xls) or CSV file.");
      return;
    }

    setIsImporting(true);
    try {
      // Read file as ArrayBuffer for XLSX parsing
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });

      // Get first sheet
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert to JSON with header row
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        toast.error("File contains no data.");
        setIsImporting(false);
        return;
      }

      // Get header row and find column indices
      const header = jsonData[0].map((h: any) => String(h || "").trim().toLowerCase());
      const namaIdx = header.findIndex((h) => h.includes("nama"));
      const phoneIdx = header.findIndex((h) => h.includes("telefon") || h.includes("phone"));
      const nicheIdx = header.findIndex((h) => h.includes("niche") || h.includes("product"));
      const tarikhIdx = header.findIndex((h) => h.includes("tarikh") || h.includes("date"));

      console.log("Header found:", header);
      console.log("Column indices:", { namaIdx, phoneIdx, nicheIdx, tarikhIdx });

      let successCount = 0;
      let errorCount = 0;

      // Process data rows (skip header)
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const nama = namaIdx >= 0 ? String(row[namaIdx] || "").trim().toUpperCase() : "";
        let phone = phoneIdx >= 0 ? String(row[phoneIdx] || "").trim() : "";
        const nicheValue = nicheIdx >= 0 ? String(row[nicheIdx] || "").trim().toUpperCase() : "";
        let tarikh = tarikhIdx >= 0 ? row[tarikhIdx] : "";

        // Handle Excel date serial number (Excel stores dates as numbers)
        if (typeof tarikh === "number") {
          // Convert Excel date serial to JS date
          const excelDate = XLSX.SSF.parse_date_code(tarikh);
          if (excelDate) {
            tarikh = `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(excelDate.d).padStart(2, "0")}`;
          }
        } else {
          tarikh = String(tarikh || "").trim();
        }

        // Normalize phone number - remove any non-digit characters
        phone = phone.replace(/\D/g, "");

        // Match product from list
        const product = products.find((p: any) => p.name.toUpperCase() === nicheValue);
        const niche = product ? product.name : nicheValue;

        console.log(`Row ${i}:`, { nama, phone, niche, tarikh });

        if (!nama || !phone || !niche || !tarikh) {
          console.log(`Row ${i} skipped: missing required field`);
          errorCount++;
          continue;
        }

        if (!phone.startsWith("6")) {
          console.log(`Row ${i} skipped: phone doesn't start with 6`);
          errorCount++;
          continue;
        }

        try {
          const { error } = await supabase.from("prospects").insert({
            nama_prospek: nama,
            no_telefon: phone,
            niche: niche,
            jenis_prospek: "",
            tarikh_phone_number: tarikh,
            created_by: user?.id,
            status_closed: "",
            price_closed: 0,
            count_order: 0,
          });
          if (error) {
            console.error(`Row ${i} insert error:`, error);
            throw error;
          }
          successCount++;
        } catch (err) {
          console.error(`Row ${i} failed:`, err);
          errorCount++;
        }
      }

      toast.success(`${successCount} prospects imported successfully. ${errorCount} failed.`);
      queryClient.invalidateQueries({ queryKey: ["branch-prospects"] });
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import file.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const exportCSV = () => {
    const headers = ["No", "Date", "Name", "Phone", "Niche", "Profile", "Jenis Prospek", "Count Order", "Status", "Price"];
    const rows = filteredProspects.map((prospect: any, idx: number) => [
      idx + 1,
      prospect.tarikh_phone_number || "-",
      prospect.nama_prospek,
      prospect.no_telefon,
      prospect.niche,
      prospect.profile || "-",
      prospect.jenis_prospek || "-",
      prospect.count_order || 0,
      prospect.status_closed || "-",
      prospect.price_closed > 0 ? Number(prospect.price_closed).toFixed(2) : "-",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `branch_prospects.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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
          <h1 className="text-2xl font-bold text-primary">Leads</h1>
          <p className="text-muted-foreground">Manage prospects and leads</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileImport}
            className="hidden"
          />
          <Button variant="outline" onClick={() => setShowFormatDialog(true)}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Import Format
          </Button>
          <Button variant="outline" onClick={handleImportClick} disabled={isImporting}>
            {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Import Excel
          </Button>
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) handleCloseDialog();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Add Prospect
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingProspect ? "Edit Prospect" : "Add New Prospect"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="namaProspek">Prospect Name *</Label>
                  <Input
                    id="namaProspek"
                    placeholder="Prospect name"
                    value={formData.namaProspek}
                    onChange={(e) => handleChange("namaProspek", e.target.value)}
                    className="uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="noTelefon">Phone Number * (Start with 6)</Label>
                  <Input
                    id="noTelefon"
                    placeholder="60123456789"
                    value={formData.noTelefon}
                    onChange={(e) => handleChange("noTelefon", e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="niche">Niche (Product) *</Label>
                  <Select value={formData.niche} onValueChange={(value) => handleChange("niche", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product">{formData.niche || "Select product"}</SelectValue>
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
                  <Label htmlFor="tarikhPhoneNumber">Date *</Label>
                  <Input
                    id="tarikhPhoneNumber"
                    type="date"
                    value={formData.tarikhPhoneNumber}
                    onChange={(e) => handleChange("tarikhPhoneNumber", e.target.value)}
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
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingProspect ? "Update" : "Add"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-xs uppercase font-medium">Total Lead</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.totalLead}</p>
        </div>

        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
            <User className="w-4 h-4" />
            <span className="text-xs uppercase font-medium">Total NP Lead</span>
          </div>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.totalNP}</p>
        </div>

        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
            <UserCheck className="w-4 h-4" />
            <span className="text-xs uppercase font-medium">Total EP Lead</span>
          </div>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{stats.totalEP}</p>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs uppercase font-medium">Total Sales</span>
          </div>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">RM {stats.totalSales.toFixed(2)}</p>
        </div>

        <div className="bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 mb-1">
            <Target className="w-4 h-4" />
            <span className="text-xs uppercase font-medium">Lead Close</span>
          </div>
          <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{stats.leadClose}</p>
        </div>

        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
            <XCircle className="w-4 h-4" />
            <span className="text-xs uppercase font-medium">Lead XClose</span>
          </div>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{stats.leadXClose}</p>
        </div>
      </div>

      {/* Profile, Proses, X Process Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <UserCircle className="w-4 h-4" />
              <span className="text-xs uppercase font-medium">Profile</span>
            </div>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{stats.profilePercent}%</span>
          </div>
          <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{stats.profileCount}</p>
        </div>

        <div className="bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
              <Target className="w-4 h-4" />
              <span className="text-xs uppercase font-medium">Proses</span>
            </div>
            <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">{stats.prosesPercent}%</span>
          </div>
          <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{stats.prosesCount}</p>
        </div>

        <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <XCircle className="w-4 h-4" />
              <span className="text-xs uppercase font-medium">X Process</span>
            </div>
            <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">{stats.xProsesPercent}%</span>
          </div>
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{stats.xProsesCount}</p>
        </div>
      </div>

      {/* Quick Search - Search by Name/Phone without Date */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Quick Search</span>
          </div>
          <div className="flex flex-1 gap-2 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Enter name or phone number..."
                value={quickSearch}
                onChange={(e) => {
                  setQuickSearch(e.target.value);
                  if (!e.target.value) setIsQuickSearchActive(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleQuickSearch();
                }}
                className="pl-10"
              />
            </div>
            <Button onClick={handleQuickSearch} className="bg-primary hover:bg-primary/90">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
            {isQuickSearchActive && (
              <Button variant="outline" onClick={clearQuickSearch}>
                <XCircle className="w-4 h-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
          {isQuickSearchActive && (
            <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded">
              Showing results for: "{quickSearch}"
            </span>
          )}
        </div>
      </div>

      {/* Date Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Start Date</span>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setIsQuickSearchActive(false);
            }}
            className="w-40"
          />
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">End Date</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setIsQuickSearchActive(false);
            }}
            className="w-40"
          />
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, niche..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsQuickSearchActive(false);
            }}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={resetFilters}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button onClick={exportCSV} className="bg-green-600 hover:bg-green-700 text-white">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Niche</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Profile</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Jenis Prospek</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Count Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Price</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProspects.length > 0 ? (
                filteredProspects.map((prospect: any, index: number) => (
                  <tr key={prospect.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-foreground">{index + 1}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{prospect.tarikh_phone_number || "-"}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{prospect.nama_prospek}</td>
                    <td className="px-4 py-3 text-sm font-mono text-foreground">{prospect.no_telefon}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{prospect.niche}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{prospect.profile || "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          prospect.jenis_prospek === "NP"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                        }`}
                      >
                        {prospect.jenis_prospek || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-center font-medium text-foreground">
                      {prospect.count_order > 0 ? (
                        <button
                          onClick={() => handleViewOrders(prospect)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                        >
                          <ShoppingCart className="w-3 h-3" />
                          {prospect.count_order}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {prospect.status_closed ? (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            prospect.status_closed === "closed"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                          }`}
                        >
                          {prospect.status_closed.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {prospect.price_closed > 0 ? `RM ${Number(prospect.price_closed).toFixed(2)}` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditClick(prospect)}
                          className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(prospect.id)}
                          className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
                    No prospects found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prospect?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this prospect? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Format Dialog */}
      <Dialog open={showFormatDialog} onOpenChange={setShowFormatDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Excel/CSV Format</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please use the following format to import prospects. File must be in CSV or Excel format.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 font-semibold">Nama</th>
                    <th className="text-left py-2 px-2 font-semibold">Telefon</th>
                    <th className="text-left py-2 px-2 font-semibold">Niche</th>
                    <th className="text-left py-2 px-2 font-semibold">Tarikh</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-muted-foreground">
                    <td className="py-2 px-2">ALI BIN ABU</td>
                    <td className="py-2 px-2">60123456789</td>
                    <td className="py-2 px-2">PRODUCT NAME</td>
                    <td className="py-2 px-2">2024-01-15</td>
                  </tr>
                  <tr className="text-muted-foreground">
                    <td className="py-2 px-2">SITI AMINAH</td>
                    <td className="py-2 px-2">60198765432</td>
                    <td className="py-2 px-2">ANOTHER PRODUCT</td>
                    <td className="py-2 px-2">2024-01-16</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Notes:</strong>
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  <strong>Nama</strong> - Prospect name (required)
                </li>
                <li>
                  <strong>Telefon</strong> - Phone number, must start with 6 (required)
                </li>
                <li>
                  <strong>Niche</strong> - Product name from Product list (required)
                </li>
                <li>
                  <strong>Tarikh</strong> - Format: YYYY-MM-DD (required)
                </li>
              </ul>
              <p className="mt-2 text-amber-600 dark:text-amber-400">
                <strong>Note:</strong> Jenis Prospek (NP/EP) will be determined automatically when creating an order.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowFormatDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Orders Modal */}
      <Dialog open={ordersModalOpen} onOpenChange={setOrdersModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-500" />
              Order List - {selectedProspectName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isLoadingOrders ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : selectedProspectOrders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Order Date</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Price</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Bundle</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedProspectOrders.map((order: any, idx: number) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="px-3 py-2 text-foreground">{order.date_order || "-"}</td>
                        <td className="px-3 py-2 text-foreground">RM {(Number(order.total_price) || 0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-foreground">{order.produk || "-"}</td>
                        <td className="px-3 py-2 text-foreground text-center">{order.quantity || 1}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30">
                    <tr>
                      <td className="px-3 py-2 font-semibold text-foreground">Total</td>
                      <td className="px-3 py-2 font-semibold text-foreground">
                        RM {selectedProspectOrders.reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 font-semibold text-foreground text-center">
                        {selectedProspectOrders.reduce((sum: number, o: any) => sum + (o.quantity || 1), 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No orders found.</div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setOrdersModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BranchLeads;
