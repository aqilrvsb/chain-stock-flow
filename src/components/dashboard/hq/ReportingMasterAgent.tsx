import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerSegment } from "@/hooks/useCustomerSegment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Package, ArrowUpCircle, ArrowDownCircle, Target } from "lucide-react";

const ReportingMasterAgent = () => {
  const { isCustomerSegmentEnabled } = useCustomerSegment();
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["reporting-master-agent", startDate, endDate],
    queryFn: async () => {
      // Get all master agents
      const { data: masterAgents } = await supabase
        .from("profiles")
        .select(`
          id,
          idstaff,
          full_name,
          sub_role,
          user_roles!user_roles_user_id_fkey!inner(role)
        `)
        .eq("user_roles.role", "master_agent");

      if (!masterAgents) return [];

      // Get current date for rewards
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      // Fetch data for each master agent
      const enrichedData = await Promise.all(
        masterAgents.map(async (ma) => {
          // Latest Balance (current inventory)
          const { data: inventory } = await supabase
            .from("inventory")
            .select("quantity")
            .eq("user_id", ma.id);

          const latestBalance = inventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;

          // Stock In (transactions where success)
          let stockInQuery = supabase
            .from("pending_orders")
            .select("quantity")
            .eq("buyer_id", ma.id)
            .eq("status", "completed");

          if (startDate) {
            stockInQuery = stockInQuery.gte("created_at", startDate + 'T00:00:00+08:00');
          }
          if (endDate) {
            stockInQuery = stockInQuery.lte("created_at", endDate + 'T23:59:59.999+08:00');
          }

          const { data: stockInData } = await stockInQuery;
          const stockIn = stockInData?.reduce((sum, item) => sum + item.quantity, 0) || 0;

          // Agent Stock Out (agent purchases where success)
          let agentStockOutQuery = supabase
            .from("agent_purchases")
            .select("quantity")
            .eq("master_agent_id", ma.id)
            .eq("status", "completed");

          if (startDate) {
            agentStockOutQuery = agentStockOutQuery.gte("created_at", startDate + 'T00:00:00+08:00');
          }
          if (endDate) {
            agentStockOutQuery = agentStockOutQuery.lte("created_at", endDate + 'T23:59:59.999+08:00');
          }

          const { data: agentStockOutData } = await agentStockOutQuery;
          const agentStockOut = agentStockOutData?.reduce((sum, item) => sum + item.quantity, 0) || 0;

          // Customer Stock Out (customer purchases)
          let customerStockOutQuery = supabase
            .from("customer_purchases")
            .select("quantity")
            .eq("seller_id", ma.id);

          if (startDate) {
            customerStockOutQuery = customerStockOutQuery.gte("created_at", startDate + 'T00:00:00+08:00');
          }
          if (endDate) {
            customerStockOutQuery = customerStockOutQuery.lte("created_at", endDate + 'T23:59:59.999+08:00');
          }

          const { data: customerStockOutData } = await customerStockOutQuery;
          const customerStockOut = customerStockOutData?.reduce((sum, item) => sum + item.quantity, 0) || 0;

          // Total Purchase (total_price from pending_orders)
          let purchaseQuery = supabase
            .from("pending_orders")
            .select("total_price")
            .eq("buyer_id", ma.id)
            .eq("status", "completed");

          if (startDate) {
            purchaseQuery = purchaseQuery.gte("created_at", startDate + 'T00:00:00+08:00');
          }
          if (endDate) {
            purchaseQuery = purchaseQuery.lte("created_at", endDate + 'T23:59:59.999+08:00');
          }

          const { data: purchaseData } = await purchaseQuery;
          const totalPurchase = purchaseData?.reduce((sum, item) => sum + Number(item.total_price), 0) || 0;

          // Agent Total Sales (total_price from agent_purchases)
          let agentSalesQuery = supabase
            .from("agent_purchases")
            .select("total_price, bundle_id")
            .eq("master_agent_id", ma.id)
            .eq("status", "completed");

          if (startDate) {
            agentSalesQuery = agentSalesQuery.gte("created_at", startDate + 'T00:00:00+08:00');
          }
          if (endDate) {
            agentSalesQuery = agentSalesQuery.lte("created_at", endDate + 'T23:59:59.999+08:00');
          }

          const { data: agentSalesData } = await agentSalesQuery;
          const agentTotalSales = agentSalesData?.reduce((sum, item) => sum + Number(item.total_price), 0) || 0;

          // Get bundles for agent profit calculation
          const agentBundleIds = agentSalesData?.map(s => s.bundle_id).filter(Boolean) || [];
          const { data: agentBundles } = agentBundleIds.length > 0
            ? await supabase
                .from("bundles")
                .select("id, master_agent_price")
                .in("id", agentBundleIds)
            : { data: [] };

          const agentBundlesMap = new Map(agentBundles?.map(b => [b.id, b.master_agent_price]) || []);

          // Calculate Agent Profit (total_price - master_agent_price)
          let agentProfit = 0;
          agentSalesData?.forEach(sale => {
            const maPrice = agentBundlesMap.get(sale.bundle_id) || 0;
            agentProfit += Number(sale.total_price) - Number(maPrice);
          });

          // Customer Total Sales (total_price from customer_purchases)
          let customerSalesQuery = supabase
            .from("customer_purchases")
            .select("total_price, unit_price, quantity, product_id, customer_id")
            .eq("seller_id", ma.id);

          if (startDate) {
            customerSalesQuery = customerSalesQuery.gte("created_at", startDate + 'T00:00:00+08:00');
          }
          if (endDate) {
            customerSalesQuery = customerSalesQuery.lte("created_at", endDate + 'T23:59:59.999+08:00');
          }

          const { data: customerSalesData } = await customerSalesQuery;
          const customerTotalSales = customerSalesData?.reduce((sum, item) => sum + Number(item.total_price), 0) || 0;

          // Calculate Customer Profit (revenue - cost from HQ)
          let customerProfit = 0;
          for (const sale of customerSalesData || []) {
            // Find cost per unit from master agent's purchase from HQ
            const costOrder = purchaseData?.find(order => order.product_id === sale.product_id);
            if (costOrder) {
              const costPerUnit = Number(costOrder.total_price) / costOrder.quantity;
              const cost = costPerUnit * sale.quantity;
              customerProfit += Number(sale.total_price) - cost;
            } else {
              // If no matching purchase, use full sale price as profit
              customerProfit += Number(sale.total_price);
            }
          }

          // Count unique customers
          const totalCustomers = new Set(customerSalesData?.map(s => s.customer_id)).size;

          // Target Monthly
          const { data: monthlyReward } = await supabase
            .from("rewards_config")
            .select("min_quantity")
            .eq("role", "master_agent")
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
            .eq("role", "master_agent")
            .eq("year", year)
            .eq("is_active", true)
            .order("min_quantity", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Count agents under this master agent via relationships table
          const { data: relationships } = await supabase
            .from("master_agent_relationships")
            .select("agent_id")
            .eq("master_agent_id", ma.id);

          const agentCount = relationships?.length || 0;

          return {
            id: ma.id,
            idstaff: ma.idstaff,
            full_name: ma.full_name,
            sub_role: ma.sub_role,
            latestBalance,
            stockIn,
            totalPurchase,
            agentStockOut,
            customerStockOut,
            agentTotalSales,
            customerTotalSales,
            agentProfit,
            customerProfit,
            targetMonthly: monthlyReward?.min_quantity || 0,
            targetYearly: yearlyReward?.min_quantity || 0,
            agentCount,
            totalCustomers,
          };
        })
      );

      return enrichedData;
    },
  });

  // Calculate summary stats
  const totalMasterAgents = reportData?.length || 0;
  const totalStockIn = reportData?.reduce((sum, item) => sum + item.stockIn, 0) || 0;
  const totalStockOut = reportData?.reduce((sum, item) => sum + item.agentStockOut + item.customerStockOut, 0) || 0;
  const totalTargetMonthly = reportData?.reduce((sum, item) => sum + item.targetMonthly, 0) || 0;

  const summaryStats = [
    {
      title: "Total Master Agent",
      value: totalMasterAgents,
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
        <h1 className="text-3xl font-bold">Reporting Master Agent</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive report of all master agents performance
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
          <CardTitle>Master Agent Report</CardTitle>
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
                  <TableHead>Role</TableHead>
                  <TableHead>Latest Balance</TableHead>
                  <TableHead>Stock In</TableHead>
                  <TableHead>Total Purchase</TableHead>
                  <TableHead>Agent Stock Out</TableHead>
                  {isCustomerSegmentEnabled && <TableHead>Customer Stock Out</TableHead>}
                  <TableHead>Agent Total Sales</TableHead>
                  {isCustomerSegmentEnabled && <TableHead>Customer Total Sales</TableHead>}
                  <TableHead>Agent Profit</TableHead>
                  {isCustomerSegmentEnabled && <TableHead>Customer Profit</TableHead>}
                  <TableHead>Target Monthly</TableHead>
                  <TableHead>Target Yearly</TableHead>
                  <TableHead>Agent</TableHead>
                  {isCustomerSegmentEnabled && <TableHead>Total Customer</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{item.idstaff || "-"}</TableCell>
                    <TableCell>{item.full_name || "-"}</TableCell>
                    <TableCell>{item.sub_role === 'dealer_1' ? 'Dealer 1' : item.sub_role === 'dealer_2' ? 'Dealer 2' : '-'}</TableCell>
                    <TableCell>{item.latestBalance}</TableCell>
                    <TableCell>{item.stockIn}</TableCell>
                    <TableCell>RM {item.totalPurchase.toFixed(2)}</TableCell>
                    <TableCell>{item.agentStockOut}</TableCell>
                    {isCustomerSegmentEnabled && <TableCell>{item.customerStockOut}</TableCell>}
                    <TableCell>RM {item.agentTotalSales.toFixed(2)}</TableCell>
                    {isCustomerSegmentEnabled && <TableCell>RM {item.customerTotalSales.toFixed(2)}</TableCell>}
                    <TableCell>RM {item.agentProfit.toFixed(2)}</TableCell>
                    {isCustomerSegmentEnabled && <TableCell>RM {item.customerProfit.toFixed(2)}</TableCell>}
                    <TableCell>{item.targetMonthly}</TableCell>
                    <TableCell>{item.targetYearly}</TableCell>
                    <TableCell>{item.agentCount}</TableCell>
                    {isCustomerSegmentEnabled && <TableCell>{item.totalCustomers}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              No master agents found
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportingMasterAgent;
