import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ShoppingCart, CheckCircle2, XCircle, Clock, Package, DollarSign } from "lucide-react";

const AgentTransactions = () => {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: purchases, isLoading } = useQuery({
    queryKey: ["agent-purchases", user?.id, startDate, endDate, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("agent_purchases" as any)
        .select(`
          *,
          agent:profiles!agent_id(full_name, email),
          product:products(name, sku),
          bundle:bundles(name)
        `)
        .eq("agent_id", user?.id)
        .order("created_at", { ascending: false });

      if (startDate) {
        query = query.gte("created_at", startDate + 'T00:00:00.000Z');
      }
      if (endDate) {
        query = query.lte("created_at", endDate + 'T23:59:59.999Z');
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any;
    },
    enabled: !!user?.id,
  });

  // Calculate statistics
  const totalTransactions = purchases?.length || 0;
  const totalSuccess = purchases?.filter(p => p.status === "completed").length || 0;
  const totalFailed = purchases?.filter(p => p.status === "failed").length || 0;
  const totalPending = purchases?.filter(p => p.status === "pending").length || 0;
  const totalUnitSuccess = purchases
    ?.filter(p => p.status === "completed")
    .reduce((sum, p) => sum + (p.quantity || 0), 0) || 0;
  const totalPriceSuccess = purchases
    ?.filter(p => p.status === "completed")
    .reduce((sum, p) => sum + (Number(p.total_price) || 0), 0) || 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">SUCCESS</Badge>;
      case "failed":
        return <Badge variant="destructive">FAILED</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Transaction</p>
                <h3 className="text-3xl font-bold mt-2">{totalTransactions}</h3>
              </div>
              <ShoppingCart className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Success</p>
                <h3 className="text-3xl font-bold mt-2">{totalSuccess}</h3>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Failed</p>
                <h3 className="text-3xl font-bold mt-2">{totalFailed}</h3>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Pending</p>
                <h3 className="text-3xl font-bold mt-2">{totalPending}</h3>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Unit Purchase (Success)</p>
                <h3 className="text-3xl font-bold mt-2">{totalUnitSuccess}</h3>
              </div>
              <Package className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Purchase (Success)</p>
                <h3 className="text-3xl font-bold mt-2">RM {totalPriceSuccess.toFixed(2)}</h3>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History with Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Filters</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      placeholder="dd/mm/yyyy"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      placeholder="dd/mm/yyyy"
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger id="status">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          {isLoading ? (
            <p>Loading transactions...</p>
          ) : purchases && purchases.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Bundle</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Total Purchase</TableHead>
                  <TableHead>Bank Holder</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Receipt Date</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases?.map((purchase, index) => (
                  <TableRow key={purchase.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{format(new Date(purchase.created_at), "dd-MM-yyyy")}</TableCell>
                    <TableCell>{purchase.product?.name}</TableCell>
                    <TableCell>{purchase.bundle?.name}</TableCell>
                    <TableCell>{purchase.quantity}</TableCell>
                    <TableCell>RM {Number(purchase.total_price || 0).toFixed(2)}</TableCell>
                    <TableCell>{purchase.bank_holder_name || "-"}</TableCell>
                    <TableCell>{purchase.bank_name || "-"}</TableCell>
                    <TableCell>{purchase.receipt_date ? format(new Date(purchase.receipt_date), "dd-MM-yyyy") : "-"}</TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">View</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>Payment Receipt</DialogTitle>
                          </DialogHeader>
                          <img
                            src={purchase.receipt_image_url}
                            alt="Payment receipt"
                            className="w-full h-auto"
                          />
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                    <TableCell>{getStatusBadge(purchase.status)}</TableCell>
                    <TableCell>{purchase.remarks || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              No purchase transactions yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentTransactions;
