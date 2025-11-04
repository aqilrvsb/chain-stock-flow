import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Users, DollarSign, ShoppingCart } from "lucide-react";
import { format } from "date-fns";

const StockOutHQ = () => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["stock-out-hq", startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("transactions")
        .select(`
          *,
          buyer:profiles!transactions_buyer_id_fkey(full_name, email),
          product:products(name, sku)
        `)
        .eq("transaction_type", "purchase")
        .order("created_at", { ascending: false });

      if (startDate) {
        query = query.gte("created_at", startDate);
      }
      if (endDate) {
        query = query.lte("created_at", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Calculate summary stats
  const totalTransactions = transactions?.length || 0;
  const totalQuantity = transactions?.reduce((sum, tx) => sum + tx.quantity, 0) || 0;
  const totalRevenue = transactions?.reduce((sum, tx) => sum + parseFloat(String(tx.total_price)), 0) || 0;
  const uniqueMasterAgents = new Set(transactions?.map(tx => tx.buyer_id)).size;

  const stats = [
    { title: "Total Transactions", value: totalTransactions, icon: ShoppingCart, color: "text-blue-600" },
    { title: "Master Agents", value: uniqueMasterAgents, icon: Users, color: "text-green-600" },
    { title: "Total Units", value: totalQuantity, icon: Package, color: "text-purple-600" },
    { title: "Total Price", value: `RM ${totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-orange-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          Stock Out HQ
        </h1>
        <p className="text-muted-foreground mt-2">
          Track all transactions from HQ to Master Agents
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-2">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter by Date</CardTitle>
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading transactions...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Master Agent</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Bundle Name</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Total Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions?.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{format(new Date(tx.created_at), "dd-MM-yyyy")}</TableCell>
                    <TableCell>{tx.buyer?.full_name || tx.buyer?.email}</TableCell>
                    <TableCell>{tx.product?.name}</TableCell>
                    <TableCell>{tx.product?.sku}</TableCell>
                    <TableCell>RM {parseFloat(String(tx.unit_price)).toFixed(2)}</TableCell>
                    <TableCell>{tx.quantity}</TableCell>
                    <TableCell className="font-bold">RM {parseFloat(String(tx.total_price)).toFixed(2)}</TableCell>
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

export default StockOutHQ;
