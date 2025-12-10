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
import { Loader2, Plus, Search, Target, Users, Pencil, Trash2 } from "lucide-react";

const PROSPECT_TYPES = ["NP", "EP", "EC"];
const STATUS_OPTIONS = ["Open", "Closed", "Invalid", "Tidak Angkat", "Busy"];

const MarketerLeads = () => {
  const { user, userProfile } = useAuth();
  const queryClient = useQueryClient();
  const userIdStaff = userProfile?.idstaff;

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<any>(null);

  // Form state
  const [namaProspek, setNamaProspek] = useState("");
  const [noTelefon, setNoTelefon] = useState("");
  const [niche, setNiche] = useState("");
  const [jenisProspek, setJenisProspek] = useState("");
  const [statusClosed, setStatusClosed] = useState("");
  const [priceClosed, setPriceClosed] = useState("");

  // Filter state
  const [search, setSearch] = useState("");

  // Fetch prospects
  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ["marketer-prospects", userIdStaff],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospects")
        .select("*")
        .eq("marketer_id_staff", userIdStaff)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userIdStaff,
  });

  // Fetch products for niche dropdown
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
      if (editingProspect) {
        // Update
        const { error } = await supabase
          .from("prospects")
          .update({
            nama_prospek: data.namaProspek,
            no_telefon: data.noTelefon,
            niche: data.niche,
            jenis_prospek: data.jenisProspek,
            status_closed: data.statusClosed || null,
            price_closed: data.priceClosed ? parseFloat(data.priceClosed) : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingProspect.id);
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from("prospects")
          .insert({
            nama_prospek: data.namaProspek,
            no_telefon: data.noTelefon,
            niche: data.niche,
            jenis_prospek: data.jenisProspek,
            marketer_id_staff: userIdStaff,
            created_by: user?.id,
            tarikh_phone_number: new Date().toISOString().split("T")[0],
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingProspect ? "Lead updated" : "Lead added");
      queryClient.invalidateQueries({ queryKey: ["marketer-prospects"] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save lead");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prospects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead deleted");
      queryClient.invalidateQueries({ queryKey: ["marketer-prospects"] });
    },
    onError: () => {
      toast.error("Failed to delete lead");
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProspect(null);
    setNamaProspek("");
    setNoTelefon("");
    setNiche("");
    setJenisProspek("");
    setStatusClosed("");
    setPriceClosed("");
  };

  const handleEdit = (prospect: any) => {
    setEditingProspect(prospect);
    setNamaProspek(prospect.nama_prospek || "");
    setNoTelefon(prospect.no_telefon || "");
    setNiche(prospect.niche || "");
    setJenisProspek(prospect.jenis_prospek || "");
    setStatusClosed(prospect.status_closed || "");
    setPriceClosed(prospect.price_closed?.toString() || "");
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaProspek || !noTelefon || !niche || !jenisProspek) {
      toast.error("Please fill all required fields");
      return;
    }
    saveMutation.mutate({
      namaProspek,
      noTelefon,
      niche,
      jenisProspek,
      statusClosed,
      priceClosed,
    });
  };

  // Filter prospects
  const filteredProspects = useMemo(() => {
    return prospects.filter((p: any) => {
      if (search.trim()) {
        const searchLower = search.toLowerCase();
        return (
          p.nama_prospek?.toLowerCase().includes(searchLower) ||
          p.no_telefon?.toLowerCase().includes(searchLower) ||
          p.niche?.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [prospects, search]);

  // Stats
  const stats = useMemo(() => {
    const total = prospects.length;
    const npCount = prospects.filter((p: any) => p.jenis_prospek === "NP").length;
    const epCount = prospects.filter((p: any) => p.jenis_prospek === "EP").length;
    const ecCount = prospects.filter((p: any) => p.jenis_prospek === "EC").length;
    return { total, npCount, epCount, ecCount };
  }, [prospects]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leads Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage your prospects and leads
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleCloseDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingProspect ? "Edit Lead" : "Add New Lead"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={namaProspek}
                  onChange={(e) => setNamaProspek(e.target.value)}
                  placeholder="Prospect name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  value={noTelefon}
                  onChange={(e) => setNoTelefon(e.target.value)}
                  placeholder="e.g. 60123456789"
                />
              </div>
              <div className="space-y-2">
                <Label>Product (Niche) *</Label>
                <Select value={niche} onValueChange={setNiche}>
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
                <Label>Type *</Label>
                <Select value={jenisProspek} onValueChange={setJenisProspek}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROSPECT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editingProspect && (
                <>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={statusClosed} onValueChange={setStatusClosed}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Price Closed (RM)</Label>
                    <Input
                      type="number"
                      value={priceClosed}
                      onChange={(e) => setPriceClosed(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingProspect ? (
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="w-6 h-6 text-blue-500" />
              <div>
                <p className="text-xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-green-500" />
              <div>
                <p className="text-xl font-bold">{stats.npCount}</p>
                <p className="text-xs text-muted-foreground">New Prospect (NP)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-orange-500" />
              <div>
                <p className="text-xl font-bold">{stats.epCount}</p>
                <p className="text-xs text-muted-foreground">Existing Prospect (EP)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-purple-500" />
              <div>
                <p className="text-xl font-bold">{stats.ecCount}</p>
                <p className="text-xs text-muted-foreground">Existing Customer (EC)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
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
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProspects.length > 0 ? (
                  filteredProspects.map((prospect: any, idx: number) => (
                    <TableRow key={prospect.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{prospect.tarikh_phone_number || "-"}</TableCell>
                      <TableCell>{prospect.nama_prospek}</TableCell>
                      <TableCell>{prospect.no_telefon}</TableCell>
                      <TableCell>{prospect.niche}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{prospect.jenis_prospek}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={prospect.status_closed === "Closed" ? "default" : "secondary"}
                        >
                          {prospect.status_closed || "Open"}
                        </Badge>
                      </TableCell>
                      <TableCell>{prospect.count_order || 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(prospect)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(prospect.id)}
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
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No leads found
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

export default MarketerLeads;
