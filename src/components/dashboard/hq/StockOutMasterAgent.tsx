import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Users, DollarSign, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { getMalaysiaDate } from "@/lib/utils";

const StockOutMasterAgent = () => {
  const today = getMalaysiaDate();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const { data: masterAgentStats, isLoading } = useQuery({
    queryKey: ["stock-out-ma", startDate, endDate],
    queryFn: async () => {
      // Get all master agents
      const { data: masterAgents } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          user_roles!user_roles_user_id_fkey!inner(role)
        `)
        .eq("user_roles.role", "master_agent");

      if (!masterAgents) return [];

      // For each master agent, get their inventory and transactions
      const stats = await Promise.all(
        masterAgents.map(async (ma) => {
          // Get master agent's inventory
          const { data: inventory } = await supabase
            .from("inventory")
            .select(`
              *,
              product:products(name, sku)
            `)
            .eq("user_id", ma.id);

          // Get their agents
          const { data: relationships } = await supabase
            .from("master_agent_relationships")
            .select("agent_id")
            .eq("master_agent_id", ma.id);

          const agentIds = relationships?.map(r => r.agent_id) || [];

          // Get transactions where master agent sold to agents
          let query = supabase
            .from("transactions")
            .select(`
              *,
              product:products(name, sku),
              buyer:profiles!transactions_buyer_id_fkey(full_name, email)
            `)
            .eq("seller_id", ma.id)
            .in("buyer_id", agentIds)
            .eq("transaction_type", "purchase");

          if (startDate) query = query.gte("created_at", startDate);
          if (endDate) query = query.lte("created_at", endDate);

          const { data: transactions } = await query;

          // Combine inventory with transactions
          const inventoryWithTransactions = (inventory || []).map(inv => {
            const relatedTransactions = transactions?.filter(tx => tx.product_id === inv.product_id) || [];
            const totalSold = relatedTransactions.reduce((sum, tx) => sum + tx.quantity, 0);
            const totalRevenue = relatedTransactions.reduce((sum, tx) => sum + parseFloat(String(tx.total_price)), 0);

            return {
              ...inv,
              transactions: relatedTransactions,
              totalSold,
              totalRevenue,
              balance: inv.quantity
            };
          });

          const totalQuantity = transactions?.reduce((sum, tx) => sum + tx.quantity, 0) || 0;
          const totalRevenue = transactions?.reduce((sum, tx) => sum + parseFloat(String(tx.total_price)), 0) || 0;
          const totalTransactions = transactions?.length || 0;

          return {
            masterAgent: ma,
            inventory: inventoryWithTransactions,
            totalQuantity,
            totalRevenue,
            totalTransactions,
          };
        })
      );

      return stats;
    },
  });

  // Count only master agents with transactions
  const totalMasterAgents = masterAgentStats?.filter(ma => ma.totalTransactions > 0).length || 0;
  
  // Count unique agents who made purchases
  const uniqueAgents = new Set(
    masterAgentStats?.flatMap(ma => 
      ma.inventory.flatMap(inv => 
        inv.transactions.map(tx => tx.buyer_id)
      )
    ) || []
  );
  const totalAgents = uniqueAgents.size;
  
  const grandTotalTransactions = masterAgentStats?.reduce((sum, ma) => sum + ma.totalTransactions, 0) || 0;
  const grandTotalQuantity = masterAgentStats?.reduce((sum, ma) => sum + ma.totalQuantity, 0) || 0;
  const grandTotalRevenue = masterAgentStats?.reduce((sum, ma) => sum + ma.totalRevenue, 0) || 0;

  const summaryStats = [
    { title: "Master Agents", value: totalMasterAgents, icon: Users, color: "text-blue-600" },
    { title: "Agents", value: totalAgents, icon: Users, color: "text-cyan-600" },
    { title: "Total Transactions", value: grandTotalTransactions, icon: ShoppingCart, color: "text-green-600" },
    { title: "Total Units", value: grandTotalQuantity, icon: Package, color: "text-purple-600" },
    { title: "Total Price", value: `RM ${grandTotalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-orange-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          Stock Out Master Agent
        </h1>
        <p className="text-muted-foreground mt-2">
          Track all transactions from Master Agents to Agents
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {summaryStats.map((stat) => (
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
            <p>Loading data...</p>
          ) : (
            <div className="space-y-6">
              {masterAgentStats?.map((maStat) => (
                <div key={maStat.masterAgent.id} className="border rounded-lg p-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Bundle Name</TableHead>
                        <TableHead>Master Agent</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Total Price</TableHead>
                        <TableHead>Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(maStat.inventory || []).map((inv) => 
                        inv.transactions.length > 0 ? (
                          inv.transactions.map((tx) => (
                            <TableRow key={tx.id}>
                              <TableCell>{format(new Date(tx.created_at), "dd-MM-yyyy")}</TableCell>
                              <TableCell>{tx.product?.name}</TableCell>
                              <TableCell>{tx.product?.sku}</TableCell>
                              <TableCell>RM {parseFloat(String(tx.unit_price)).toFixed(2)}</TableCell>
                              <TableCell>{maStat.masterAgent.full_name || maStat.masterAgent.email}</TableCell>
                              <TableCell>{tx.buyer?.full_name || tx.buyer?.email || '-'}</TableCell>
                              <TableCell>{tx.quantity}</TableCell>
                              <TableCell className="font-bold">RM {parseFloat(String(tx.total_price)).toFixed(2)}</TableCell>
                              <TableCell className="font-semibold text-primary">{inv.balance}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow key={inv.id}>
                            <TableCell>-</TableCell>
                            <TableCell>{inv.product?.name}</TableCell>
                            <TableCell>{inv.product?.sku}</TableCell>
                            <TableCell>-</TableCell>
                            <TableCell>{maStat.masterAgent.full_name || maStat.masterAgent.email}</TableCell>
                            <TableCell>-</TableCell>
                            <TableCell>-</TableCell>
                            <TableCell>-</TableCell>
                            <TableCell className="font-semibold text-primary">{inv.balance}</TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StockOutMasterAgent;
