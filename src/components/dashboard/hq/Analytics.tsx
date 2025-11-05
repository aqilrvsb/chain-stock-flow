import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DollarSign,
  TrendingUp,
  Users,
  Package,
  ShoppingCart,
  Target,
  Award,
  UserCheck,
  TrendingDown,
  ArrowUpCircle,
  ArrowDownCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Analytics = () => {
  const { user } = useAuth();

  // Date filters start as empty
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Fetch all data
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["hq-analytics", startDate, endDate],
    queryFn: async () => {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // 1. Total HQ Unit In (Stock In HQ)
      let stockInQuery = supabase
        .from("stock_in_hq")
        .select("quantity");

      if (startDate) {
        stockInQuery = stockInQuery.gte("date", startDate + 'T00:00:00.000Z');
      }
      if (endDate) {
        stockInQuery = stockInQuery.lte("date", endDate + 'T23:59:59.999Z');
      }

      const { data: stockInData } = await stockInQuery;

      const totalHQUnitIn = stockInData?.reduce((sum, item) => sum + item.quantity, 0) || 0;

      // 2. Total Master Agent Unit Buy (pending_orders where success)
      let pendingOrdersQuery = supabase
        .from("pending_orders")
        .select("quantity, total_price, product_id")
        .eq("status", "completed");

      if (startDate) {
        pendingOrdersQuery = pendingOrdersQuery.gte("created_at", startDate + 'T00:00:00.000Z');
      }
      if (endDate) {
        pendingOrdersQuery = pendingOrdersQuery.lte("created_at", endDate + 'T23:59:59.999Z');
      }

      const { data: pendingOrders } = await pendingOrdersQuery;

      const totalMAUnitBuy = pendingOrders?.reduce((sum, order) => sum + order.quantity, 0) || 0;
      const totalSalesHQ = pendingOrders?.reduce((sum, order) => sum + Number(order.total_price), 0) || 0;

      // 2b. Total HQ Unit Out (Stock Out HQ)
      let stockOutQuery = supabase
        .from("stock_out_hq")
        .select("quantity");

      if (startDate) {
        stockOutQuery = stockOutQuery.gte("date", startDate + 'T00:00:00.000Z');
      }
      if (endDate) {
        stockOutQuery = stockOutQuery.lte("date", endDate + 'T23:59:59.999Z');
      }

      const { data: stockOutData } = await stockOutQuery;

      const stockOutHQ = stockOutData?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      const totalHQUnitOut = stockOutHQ + totalMAUnitBuy;

      // 3. Total Agent Unit Buy (agent_purchases where success)
      let agentPurchasesQuery = supabase
        .from("agent_purchases")
        .select("quantity, total_price, product_id, bundle_id")
        .eq("status", "completed");

      if (startDate) {
        agentPurchasesQuery = agentPurchasesQuery.gte("created_at", startDate + 'T00:00:00.000Z');
      }
      if (endDate) {
        agentPurchasesQuery = agentPurchasesQuery.lte("created_at", endDate + 'T23:59:59.999Z');
      }

      const { data: agentPurchases } = await agentPurchasesQuery;

      const totalAgentUnitBuy = agentPurchases?.reduce((sum, purchase) => sum + purchase.quantity, 0) || 0;
      const totalSalesMA = agentPurchases?.reduce((sum, purchase) => sum + Number(purchase.total_price), 0) || 0;

      // 4. Get all products to calculate HQ profit
      const { data: products } = await supabase
        .from("products")
        .select("id, base_cost");

      const productsMap = new Map(products?.map(p => [p.id, p.base_cost]) || []);

      // Calculate Total Profit HQ (from pending_orders)
      let profitHQ = 0;
      pendingOrders?.forEach(order => {
        const baseCost = productsMap.get(order.product_id) || 0;
        const profit = Number(order.total_price) - Number(baseCost);
        profitHQ += profit;
      });

      // 5. Get all bundles to calculate MA profit
      const { data: bundles } = await supabase
        .from("bundles")
        .select("id, master_agent_price");

      const bundlesMap = new Map(bundles?.map(b => [b.id, b.master_agent_price]) || []);

      // Calculate Total Profit Master Agent (from agent_purchases)
      let profitMA = 0;
      agentPurchases?.forEach(purchase => {
        const maPrice = bundlesMap.get(purchase.bundle_id) || 0;
        const profit = Number(purchase.total_price) - Number(maPrice);
        profitMA += profit;
      });

      // 5. Total Master Agent Aktif
      const { data: masterAgents } = await supabase
        .from("profiles")
        .select(`
          id,
          user_roles!user_roles_user_id_fkey!inner(role)
        `)
        .eq("user_roles.role", "master_agent");

      const totalMAActive = masterAgents?.length || 0;

      // Get HQ user ID for latest balance
      const { data: hqUser } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "hq")
        .single();

      // Get HQ latest balance (current inventory)
      let latestBalanceHQ = 0;
      if (hqUser) {
        const { data: hqInventory } = await supabase
          .from("inventory")
          .select("quantity")
          .eq("user_id", hqUser.user_id);

        latestBalanceHQ = hqInventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      }

      // 6. Total Agent Aktif
      const { data: agents } = await supabase
        .from("profiles")
        .select(`
          id,
          user_roles!user_roles_user_id_fkey!inner(role)
        `)
        .eq("user_roles.role", "agent");

      const totalAgentActive = agents?.length || 0;

      // 7. Total Reward Monthly Master Agent Achieve
      const month = currentMonthStart.getMonth() + 1;
      const year = currentMonthStart.getFullYear();

      const { data: maRewards } = await supabase
        .from("rewards_config")
        .select("*")
        .eq("role", "master_agent")
        .eq("month", month)
        .eq("year", year)
        .eq("is_active", true);

      // Get MA transactions for the month
      const monthStartDate = new Date(year, month - 1, 1);
      const monthEndDate = new Date(year, month, 0, 23, 59, 59);

      let maRewardAchieveCount = 0;
      if (maRewards && maRewards.length > 0 && masterAgents) {
        for (const ma of masterAgents) {
          const { data: maOrders } = await supabase
            .from("pending_orders")
            .select("quantity")
            .eq("buyer_id", ma.id)
            .eq("status", "completed")
            .gte("created_at", monthStartDate.toISOString())
            .lte("created_at", monthEndDate.toISOString());

          const totalQty = maOrders?.reduce((sum, o) => sum + o.quantity, 0) || 0;

          // Check if achieved any reward
          const achieved = maRewards.some(reward => totalQty >= reward.min_quantity);
          if (achieved) maRewardAchieveCount++;
        }
      }

      // 8. Total Reward Monthly Agent Achieve
      const { data: agentRewards } = await supabase
        .from("rewards_config")
        .select("*")
        .eq("role", "agent")
        .eq("month", month)
        .eq("year", year)
        .eq("is_active", true);

      let agentRewardAchieveCount = 0;
      if (agentRewards && agentRewards.length > 0 && agents) {
        for (const agent of agents) {
          const { data: agentOrders } = await supabase
            .from("agent_purchases")
            .select("quantity")
            .eq("agent_id", agent.id)
            .eq("status", "completed")
            .gte("created_at", monthStartDate.toISOString())
            .lte("created_at", monthEndDate.toISOString());

          const totalQty = agentOrders?.reduce((sum, o) => sum + o.quantity, 0) || 0;

          // Check if achieved any reward
          const achieved = agentRewards.some(reward => totalQty >= reward.min_quantity);
          if (achieved) agentRewardAchieveCount++;
        }
      }

      return {
        totalHQUnitIn,
        totalHQUnitOut,
        totalMAUnitBuy,
        totalAgentUnitBuy,
        totalSalesHQ,
        profitHQ,
        totalSalesMA,
        profitMA,
        totalMAActive,
        totalAgentActive,
        maRewardAchieveCount,
        agentRewardAchieveCount,
        latestBalanceHQ,
      };
    },
  });

  const stats = [
    {
      title: "Total HQ Unit In",
      value: analyticsData?.totalHQUnitIn || 0,
      icon: ArrowUpCircle,
      subtitle: "Stock In HQ",
      color: "text-blue-600",
    },
    {
      title: "Total HQ Unit Out",
      value: analyticsData?.totalHQUnitOut || 0,
      icon: ArrowDownCircle,
      subtitle: "Stock Out HQ + MA Buy",
      color: "text-orange-600",
    },
    {
      title: "Total Master Agent Unit Buy",
      value: analyticsData?.totalMAUnitBuy || 0,
      icon: ShoppingCart,
      subtitle: "Success orders",
      color: "text-green-600",
    },
    {
      title: "Total Agent Unit Buy",
      value: analyticsData?.totalAgentUnitBuy || 0,
      icon: Package,
      subtitle: "Success purchases",
      color: "text-purple-600",
    },
    {
      title: "Total Sales HQ",
      value: `RM ${(analyticsData?.totalSalesHQ || 0).toFixed(2)}`,
      icon: DollarSign,
      subtitle: "Revenue from MA",
      color: "text-emerald-600",
    },
    {
      title: "Total Profit HQ",
      value: `RM ${(analyticsData?.profitHQ || 0).toFixed(2)}`,
      icon: TrendingUp,
      subtitle: "Profit from MA sales",
      color: "text-teal-600",
    },
    {
      title: "Total Sales Master Agent",
      value: `RM ${(analyticsData?.totalSalesMA || 0).toFixed(2)}`,
      icon: DollarSign,
      subtitle: "Revenue from Agents",
      color: "text-cyan-600",
    },
    {
      title: "Total Profit Master Agent",
      value: `RM ${(analyticsData?.profitMA || 0).toFixed(2)}`,
      icon: TrendingUp,
      subtitle: "Profit from agent sales",
      color: "text-indigo-600",
    },
    {
      title: "Total Master Agent Active",
      value: analyticsData?.totalMAActive || 0,
      icon: Users,
      subtitle: "Active master agents",
      color: "text-pink-600",
    },
    {
      title: "Total Agent Active",
      value: analyticsData?.totalAgentActive || 0,
      icon: UserCheck,
      subtitle: "Active agents",
      color: "text-rose-600",
    },
    {
      title: "Total Reward Monthly MA Achieve",
      value: analyticsData?.maRewardAchieveCount || 0,
      icon: Award,
      subtitle: "Master agents with rewards",
      color: "text-yellow-600",
    },
    {
      title: "Total Reward Monthly Agent Achieve",
      value: analyticsData?.agentRewardAchieveCount || 0,
      icon: Target,
      subtitle: "Agents with rewards",
      color: "text-amber-600",
    },
    {
      title: "Latest Balance Unit",
      value: analyticsData?.latestBalanceHQ || 0,
      icon: Package,
      subtitle: "Current HQ inventory",
      color: "text-violet-600",
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filter by Date Range</CardTitle>
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

      {isLoading ? (
        <div className="text-center py-8">Loading analytics...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                  </div>
                  <div className="p-2 rounded-full bg-muted">
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Analytics;
