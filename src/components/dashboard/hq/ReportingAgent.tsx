import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, ArrowUpCircle, ArrowDownCircle, Target } from "lucide-react";

const ReportingAgent = () => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["reporting-agent", startDate, endDate],
    queryFn: async () => {
      // Get all agents
      const { data: agents } = await supabase
        .from("profiles")
        .select(`
          id,
          idstaff,
          full_name,
          user_roles!user_roles_user_id_fkey!inner(role)
        `)
        .eq("user_roles.role", "agent");

      if (!agents) return [];

      // Get current date for rewards
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      // Get master agent relationships for all agents
      const agentIds = agents.map(a => a.id);
      const { data: relationships } = await supabase
        .from("master_agent_relationships")
        .select(`
          agent_id,
          master_agent:profiles!master_agent_relationships_master_agent_id_fkey(
            id,
            full_name
          )
        `)
        .in("agent_id", agentIds);

      // Create a map of agent_id -> master_agent name
      const masterAgentMap = new Map(
        relationships?.map(rel => [
          rel.agent_id,
          rel.master_agent?.full_name || "-"
        ]) || []
      );

      // Fetch data for each agent
      const enrichedData = await Promise.all(
        agents.map(async (agent) => {
          // Latest Balance (current inventory)
          const { data: inventory } = await supabase
            .from("inventory")
            .select("quantity")
            .eq("user_id", agent.id);

          const latestBalance = inventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;

          // Stock In (agent purchases where success)
          let stockInQuery = supabase
            .from("agent_purchases")
            .select("quantity")
            .eq("agent_id", agent.id)
            .eq("status", "completed");

          if (startDate) {
            stockInQuery = stockInQuery.gte("created_at", startDate + 'T00:00:00.000Z');
          }
          if (endDate) {
            stockInQuery = stockInQuery.lte("created_at", endDate + 'T23:59:59.999Z');
          }

          const { data: stockInData } = await stockInQuery;
          const stockIn = stockInData?.reduce((sum, item) => sum + item.quantity, 0) || 0;

          // Total Purchase (total_price from agent_purchases)
          let purchaseQuery = supabase
            .from("agent_purchases")
            .select("total_price")
            .eq("agent_id", agent.id)
            .eq("status", "completed");

          if (startDate) {
            purchaseQuery = purchaseQuery.gte("created_at", startDate + 'T00:00:00.000Z');
          }
          if (endDate) {
            purchaseQuery = purchaseQuery.lte("created_at", endDate + 'T23:59:59.999Z');
          }

          const { data: purchaseData } = await purchaseQuery;
          const totalPurchase = purchaseData?.reduce((sum, item) => sum + Number(item.total_price), 0) || 0;

          // Customer Stock Out (customer purchases)
          let customerStockOutQuery = supabase
            .from("customer_purchases")
            .select("quantity")
            .eq("seller_id", agent.id);

          if (startDate) {
            customerStockOutQuery = customerStockOutQuery.gte("created_at", startDate + 'T00:00:00.000Z');
          }
          if (endDate) {
            customerStockOutQuery = customerStockOutQuery.lte("created_at", endDate + 'T23:59:59.999Z');
          }

          const { data: customerStockOutData } = await customerStockOutQuery;
          const customerStockOut = customerStockOutData?.reduce((sum, item) => sum + item.quantity, 0) || 0;

          // Customer Total Sales (total_price from customer_purchases)
          let customerSalesQuery = supabase
            .from("customer_purchases")
            .select("total_price, customer_id")
            .eq("seller_id", agent.id);

          if (startDate) {
            customerSalesQuery = customerSalesQuery.gte("created_at", startDate + 'T00:00:00.000Z');
          }
          if (endDate) {
            customerSalesQuery = customerSalesQuery.lte("created_at", endDate + 'T23:59:59.999Z');
          }

          const { data: customerSalesData } = await customerSalesQuery;
          const customerTotalSales = customerSalesData?.reduce((sum, item) => sum + Number(item.total_price), 0) || 0;

          // Count unique customers
          const totalCustomers = new Set(customerSalesData?.map(s => s.customer_id)).size;

          // Target Monthly
          const { data: monthlyReward } = await supabase
            .from("rewards_config")
            .select("min_quantity")
            .eq("role", "agent")
            .eq("month", month)
            .eq("year", year)
            .eq("is_active", true)
            .order("min_quantity", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Target Yearly
          const { data: yearlyReward } = await supabase
            .from("rewards_config")
            .select("min_quantity")
            .eq("role", "agent")
            .eq("year", year)
            .eq("is_active", true)
            .order("min_quantity", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: agent.id,
            idstaff: agent.idstaff,
            full_name: agent.full_name,
            latestBalance,
            stockIn,
            totalPurchase,
            customerStockOut,
            customerTotalSales,
            targetMonthly: monthlyReward?.min_quantity || 0,
            targetYearly: yearlyReward?.min_quantity || 0,
            masterAgentName: masterAgentMap.get(agent.id) || "-",
            totalCustomers,
          };
        })
      );

      return enrichedData;
    },
  });

  // Calculate summary stats
  const totalAgents = reportData?.length || 0;
  const totalStockIn = reportData?.reduce((sum, item) => sum + item.stockIn, 0) || 0;
  const totalStockOut = reportData?.reduce((sum, item) => sum + item.customerStockOut, 0) || 0;
  const totalTargetMonthly = reportData?.reduce((sum, item) => sum + item.targetMonthly, 0) || 0;

  const summaryStats = [
    {
      title: "Total Agent",
      value: totalAgents,
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: "Total Stock In",
      value: totalStockIn,
      icon: ArrowUpCircle,
      color: "text-green-600",
    },
    {
      title: "Total Stock Out",
      value: totalStockOut,
      icon: ArrowDownCircle,
      color: "text-orange-600",
    },
    {
      title: "Total Target Monthly",
      value: totalTargetMonthly,
      icon: Target,
      color: "text-purple-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reporting Agent</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive report of all agents performance
        </p>
      </div>

      {/* Date Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Date Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="from-date">From Date</Label>
              <Input
                id="from-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to-date">To Date</Label>
              <Input
                id="to-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

      {/* Report Table */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Report</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8">Loading report...</p>
          ) : reportData && reportData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>ID STAFF</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Latest Balance</TableHead>
                  <TableHead>Stock In</TableHead>
                  <TableHead>Total Purchase</TableHead>
                  <TableHead>Customer Stock Out</TableHead>
                  <TableHead>Customer Total Sales</TableHead>
                  <TableHead>Target Monthly</TableHead>
                  <TableHead>Target Yearly</TableHead>
                  <TableHead>Master Agent</TableHead>
                  <TableHead>Total Customer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{item.idstaff || "-"}</TableCell>
                    <TableCell>{item.full_name || "-"}</TableCell>
                    <TableCell>{item.latestBalance}</TableCell>
                    <TableCell>{item.stockIn}</TableCell>
                    <TableCell>RM {item.totalPurchase.toFixed(2)}</TableCell>
                    <TableCell>{item.customerStockOut}</TableCell>
                    <TableCell>RM {item.customerTotalSales.toFixed(2)}</TableCell>
                    <TableCell>{item.targetMonthly}</TableCell>
                    <TableCell>{item.targetYearly}</TableCell>
                    <TableCell>{item.masterAgentName}</TableCell>
                    <TableCell>{item.totalCustomers}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              No agents found
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportingAgent;
