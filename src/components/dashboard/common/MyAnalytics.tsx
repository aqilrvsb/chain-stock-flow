import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerSegment } from "@/hooks/useCustomerSegment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DollarSign,
  TrendingUp,
  Package,
  Award,
  ShoppingCart,
  Users,
  Target,
  CheckCircle2,
  TrendingDown,
  UserCheck,
  BarChart3
} from "lucide-react";

const MyAnalytics = () => {
  const { user, userRole } = useAuth();
  const { isCustomerSegmentEnabled } = useCustomerSegment();

  // Date filters start as empty
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: stats, isLoading} = useQuery({
    queryKey: ["my-analytics", user?.id, userRole, startDate, endDate],
    queryFn: async () => {
      const now = new Date();

      // Get current inventory
      const { data: inventory } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("user_id", user?.id);

      const currentStock = inventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;

      if (userRole === "master_agent") {
        // Master Agent specific analytics
        let purchasesQuery = supabase
          .from("pending_orders")
          .select("quantity, total_price, status, product_id")
          .eq("buyer_id", user?.id);

        if (startDate) {
          purchasesQuery = purchasesQuery.gte("created_at", startDate + 'T00:00:00.000Z');
        }
        if (endDate) {
          purchasesQuery = purchasesQuery.lte("created_at", endDate + 'T23:59:59.999Z');
        }

        const { data: purchases } = await purchasesQuery;

        const completedPurchases = purchases?.filter(p => p.status === "completed") || [];
        const pendingPurchases = purchases?.filter(p => p.status === "pending") || [];
        const rejectedPurchases = purchases?.filter(p => p.status === "rejected") || [];

        const totalSpent = completedPurchases.reduce((sum, tx) => sum + Number(tx.total_price), 0);
        const totalQuantity = completedPurchases.reduce((sum, tx) => sum + tx.quantity, 0);
        const pendingAmount = pendingPurchases.reduce((sum, tx) => sum + Number(tx.total_price), 0);

        // Get agent sales (agents buying from this MA)
        let agentSalesQuery = supabase
          .from("agent_purchases")
          .select("quantity, total_price, status, bundle_id, agent_id")
          .eq("master_agent_id", user?.id);

        if (startDate) {
          agentSalesQuery = agentSalesQuery.gte("created_at", startDate + 'T00:00:00.000Z');
        }
        if (endDate) {
          agentSalesQuery = agentSalesQuery.lte("created_at", endDate + 'T23:59:59.999Z');
        }

        const { data: agentSales } = await agentSalesQuery;

        const completedAgentSales = agentSales?.filter(s => s.status === "completed") || [];
        const agentSalesTotal = completedAgentSales.reduce((sum, s) => sum + Number(s.total_price), 0);
        const agentUnitsSold = completedAgentSales.reduce((sum, s) => sum + s.quantity, 0);

        // Calculate profit from agent sales using bundle master_agent_price
        const { data: bundles } = await supabase
          .from("bundles")
          .select("id, master_agent_price");
        const bundlesMap = new Map(bundles?.map(b => [b.id, b.master_agent_price]) || []);

        let agentProfit = 0;
        completedAgentSales.forEach(sale => {
          const maPrice = bundlesMap.get(sale.bundle_id) || 0;
          const profit = Number(sale.total_price) - Number(maPrice);
          agentProfit += profit;
        });

        // Get unique agents count
        const uniqueAgents = new Set(agentSales?.map(s => s.agent_id)).size;

        // Calculate Total Unit In (transactions where success)
        const totalUnitIn = completedPurchases.reduce((sum, tx) => sum + tx.quantity, 0);

        // Calculate Total Unit Out (agent purchases where success)
        const totalUnitOut = agentUnitsSold;

        // Get customer purchases data with unit price
        let customerPurchasesQuery = supabase
          .from("customer_purchases")
          .select("quantity, total_price, unit_price, customer_id, product_id")
          .eq("seller_id", user?.id);

        if (startDate) {
          customerPurchasesQuery = customerPurchasesQuery.gte("created_at", startDate + 'T00:00:00.000Z');
        }
        if (endDate) {
          customerPurchasesQuery = customerPurchasesQuery.lte("created_at", endDate + 'T23:59:59.999Z');
        }

        const { data: customerPurchases } = await customerPurchasesQuery;

        const customerUnitsSold = customerPurchases?.reduce((sum, p) => sum + p.quantity, 0) || 0;
        const customerSalesTotal = customerPurchases?.reduce((sum, p) => sum + Number(p.total_price), 0) || 0;
        const uniqueCustomers = new Set(customerPurchases?.map(p => p.customer_id)).size;

        // Calculate customer profit (revenue - cost)
        // For Master Agent: cost is HQ price from pending_orders
        let customerCost = 0;
        for (const purchase of customerPurchases || []) {
          // Find the cost per unit from the master agent's purchase from HQ
          const costOrder = completedPurchases.find(order => order.product_id === purchase.product_id);
          if (costOrder) {
            const costPerUnit = Number(costOrder.total_price) / costOrder.quantity;
            customerCost += costPerUnit * purchase.quantity;
          }
        }
        const customerProfit = customerSalesTotal - customerCost;

        // Get rewards for master agent
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const { data: monthlyRewards } = await supabase
          .from("rewards_config")
          .select("*")
          .eq("role", "master_agent")
          .eq("month", month)
          .eq("year", year)
          .eq("is_active", true);

        // Get yearly rewards for master agent (all rewards for the year)
        const { data: yearlyRewards } = await supabase
          .from("rewards_config")
          .select("*")
          .eq("role", "master_agent")
          .eq("year", year)
          .eq("is_active", true);

        return {
          totalSpent,
          totalQuantity,
          currentStock,
          pendingAmount,
          completedCount: completedPurchases.length,
          pendingCount: pendingPurchases.length,
          rejectedCount: rejectedPurchases.length,
          agentSalesTotal,
          agentUnitsSold,
          agentProfit,
          uniqueAgents,
          totalUnitIn,
          totalUnitOut,
          customerUnitsSold,
          customerSalesTotal,
          customerProfit,
          uniqueCustomers,
          monthlyRewards,
          yearlyRewards,
        };
      } else {
        // Agent specific analytics
        let purchasesQuery = supabase
          .from("agent_purchases")
          .select("quantity, total_price, status, product_id")
          .eq("agent_id", user?.id);

        if (startDate) {
          purchasesQuery = purchasesQuery.gte("created_at", startDate + 'T00:00:00.000Z');
        }
        if (endDate) {
          purchasesQuery = purchasesQuery.lte("created_at", endDate + 'T23:59:59.999Z');
        }

        const { data: purchases } = await purchasesQuery;

        const completedPurchases = purchases?.filter(p => p.status === "completed") || [];
        const pendingPurchases = purchases?.filter(p => p.status === "pending") || [];
        const rejectedPurchases = purchases?.filter(p => p.status === "rejected") || [];

        const totalSpent = completedPurchases.reduce((sum, tx) => sum + Number(tx.total_price), 0);
        const totalQuantity = completedPurchases.reduce((sum, tx) => sum + tx.quantity, 0);
        const pendingAmount = pendingPurchases.reduce((sum, tx) => sum + Number(tx.total_price), 0);

        // Calculate Total Unit In (agent purchases where success)
        const totalUnitIn = totalQuantity;

        // Get customer purchases data with unit price
        let customerPurchasesQuery = supabase
          .from("customer_purchases")
          .select("quantity, total_price, unit_price, customer_id, product_id")
          .eq("seller_id", user?.id);

        if (startDate) {
          customerPurchasesQuery = customerPurchasesQuery.gte("created_at", startDate + 'T00:00:00.000Z');
        }
        if (endDate) {
          customerPurchasesQuery = customerPurchasesQuery.lte("created_at", endDate + 'T23:59:59.999Z');
        }

        const { data: customerPurchases } = await customerPurchasesQuery;

        const customerUnitsSold = customerPurchases?.reduce((sum, p) => sum + p.quantity, 0) || 0;
        const customerSalesTotal = customerPurchases?.reduce((sum, p) => sum + Number(p.total_price), 0) || 0;
        const uniqueCustomers = new Set(customerPurchases?.map(p => p.customer_id)).size;

        // Calculate customer profit (revenue - cost)
        // For Agent: cost is Master Agent price from agent_purchases
        let customerCost = 0;
        for (const purchase of customerPurchases || []) {
          // Find the cost per unit from the agent's purchase from Master Agent
          const costOrder = completedPurchases.find(order => order.product_id === purchase.product_id);
          if (costOrder) {
            const costPerUnit = Number(costOrder.total_price) / costOrder.quantity;
            customerCost += costPerUnit * purchase.quantity;
          }
        }
        const customerProfit = customerSalesTotal - customerCost;

        // Get rewards for agent
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const { data: monthlyRewards } = await supabase
          .from("rewards_config")
          .select("*")
          .eq("role", "agent")
          .eq("month", month)
          .eq("year", year)
          .eq("is_active", true);

        // Get yearly rewards for agent (all rewards for the year)
        const { data: yearlyRewards } = await supabase
          .from("rewards_config")
          .select("*")
          .eq("role", "agent")
          .eq("year", year)
          .eq("is_active", true);

        return {
          totalSpent,
          totalQuantity,
          currentStock,
          pendingAmount,
          completedCount: completedPurchases.length,
          pendingCount: pendingPurchases.length,
          rejectedCount: rejectedPurchases.length,
          totalUnitIn,
          customerUnitsSold,
          customerSalesTotal,
          customerProfit,
          uniqueCustomers,
          monthlyRewards,
          yearlyRewards,
        };
      }
    },
    enabled: !!user?.id,
  });

  const getAgentStats = () => {
    if (userRole === "master_agent") {
      return [
        {
          title: "Agent Total Unit Sales",
          value: stats?.totalUnitOut || 0,
          subtitle: "Agent purchases success",
          icon: Package,
          color: "text-orange-600",
        },
        {
          title: "Agent Total Sales",
          value: `RM ${(stats?.agentSalesTotal || 0).toFixed(2)}`,
          subtitle: "Revenue from agents",
          icon: DollarSign,
          color: "text-emerald-600",
        },
        {
          title: "Agent Total Profit",
          value: `RM ${(stats?.agentProfit || 0).toFixed(2)}`,
          subtitle: "Profit from agent sales",
          icon: TrendingUp,
          color: "text-teal-600",
        },
        {
          title: "Total Agent Aktif",
          value: stats?.uniqueAgents || 0,
          subtitle: "Active agents",
          icon: Users,
          color: "text-pink-600",
        },
      ];
    }
    // Agent role - no agent statistics needed
    return [];
  };

  const getCustomerStats = () => {
    return [
      {
        title: "Customer Total Unit Sales",
        value: stats?.customerUnitsSold || 0,
        subtitle: "Units sold to customers",
        icon: Package,
        color: "text-indigo-600",
      },
      {
        title: "Customer Total Sales",
        value: `RM ${(stats?.customerSalesTotal || 0).toFixed(2)}`,
        subtitle: "Revenue from customers",
        icon: DollarSign,
        color: "text-green-600",
      },
      {
        title: "Customer Total Profit",
        value: `RM ${(stats?.customerProfit || 0).toFixed(2)}`,
        subtitle: "Profit from customer sales",
        icon: TrendingUp,
        color: "text-amber-600",
      },
      {
        title: "Total Customer",
        value: stats?.uniqueCustomers || 0,
        subtitle: "Unique customers",
        icon: UserCheck,
        color: "text-rose-600",
      },
    ];
  };

  const getSummaryStats = () => {
    if (userRole === "master_agent") {
      // Calculate combined totals - only include customer data if segment is enabled
      const customerSales = isCustomerSegmentEnabled ? (stats?.customerSalesTotal || 0) : 0;
      const customerProfit = isCustomerSegmentEnabled ? (stats?.customerProfit || 0) : 0;
      const customerUnits = isCustomerSegmentEnabled ? (stats?.customerUnitsSold || 0) : 0;

      const totalSales = (stats?.agentSalesTotal || 0) + customerSales;
      const totalProfit = (stats?.agentProfit || 0) + customerProfit;
      const totalUnitOut = (stats?.totalUnitOut || 0) + customerUnits;

      const subtitle = isCustomerSegmentEnabled
        ? "Combined agent + customer"
        : "Agent sales only";

      return [
        {
          title: "Latest Balance Unit",
          value: stats?.currentStock || 0,
          subtitle: "Current inventory",
          icon: Package,
          color: "text-violet-600",
        },
        {
          title: "Total Unit Purchase From HQ",
          value: stats?.totalUnitIn || 0,
          subtitle: "Units purchased from HQ",
          icon: Package,
          color: "text-blue-600",
        },
        {
          title: "Total Purchase From HQ",
          value: `RM ${(stats?.totalSpent || 0).toFixed(2)}`,
          subtitle: "Total spent at HQ",
          icon: DollarSign,
          color: "text-cyan-600",
        },
        {
          title: "Total Sales",
          value: `RM ${totalSales.toFixed(2)}`,
          subtitle: `${subtitle} sales`,
          icon: DollarSign,
          color: "text-emerald-600",
        },
        {
          title: "Total Profit",
          value: `RM ${totalProfit.toFixed(2)}`,
          subtitle: `${subtitle} profit`,
          icon: TrendingUp,
          color: "text-green-600",
        },
        {
          title: "Total Unit Out",
          value: totalUnitOut,
          subtitle: `${subtitle} units sold`,
          icon: Package,
          color: "text-orange-600",
        },
      ];
    }

    // Agent role - only show customer data if segment is enabled
    const totalSales = isCustomerSegmentEnabled ? (stats?.customerSalesTotal || 0) : 0;
    const totalProfit = isCustomerSegmentEnabled ? (stats?.customerProfit || 0) : 0;
    const totalUnitOut = isCustomerSegmentEnabled ? (stats?.customerUnitsSold || 0) : 0;

    return [
      {
        title: "Latest Balance Unit",
        value: stats?.currentStock || 0,
        subtitle: "Current inventory",
        icon: Package,
        color: "text-violet-600",
      },
      {
        title: "Total Unit Purchase From Master Agent",
        value: stats?.totalUnitIn || 0,
        subtitle: "Units purchased from Master Agent",
        icon: Package,
        color: "text-blue-600",
      },
      {
        title: "Total Purchase From Master Agent",
        value: `RM ${(stats?.totalSpent || 0).toFixed(2)}`,
        subtitle: "Total spent at Master Agent",
        icon: DollarSign,
        color: "text-cyan-600",
      },
      ...(isCustomerSegmentEnabled ? [
        {
          title: "Total Sales",
          value: `RM ${totalSales.toFixed(2)}`,
          subtitle: "Customer sales",
          icon: DollarSign,
          color: "text-emerald-600",
        },
        {
          title: "Total Profit",
          value: `RM ${totalProfit.toFixed(2)}`,
          subtitle: "Customer profit",
          icon: TrendingUp,
          color: "text-green-600",
        },
        {
          title: "Total Unit Out",
          value: totalUnitOut,
          subtitle: "Customer units sold",
          icon: Package,
          color: "text-orange-600",
        },
      ] : []),
    ];
  };

  const agentStats = getAgentStats();
  const customerStats = getCustomerStats();
  const summaryStats = getSummaryStats();

  return (
    <div className="space-y-6">
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

      {isLoading ? (
        <div className="text-center py-8">Loading analytics...</div>
      ) : (
        <>
          {/* Agent Statistics Section - Only for Master Agent */}
          {agentStats.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Agent Statistics</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {agentStats.map((stat, index) => (
                  <Card key={index} className="hover:shadow-lg transition-shadow">
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
            </div>
          )}

          {/* Customer Statistics Section - Only show if customer segment is enabled */}
          {isCustomerSegmentEnabled && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Customer Statistics</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {customerStats.map((stat, index) => (
                  <Card key={index} className="hover:shadow-lg transition-shadow">
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
            </div>
          )}

          {/* Summary Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Summary</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {summaryStats.map((stat, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
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
          </div>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-600" />
            Rewards Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.yearlyRewards && stats.yearlyRewards.length > 0 ? (
            <div className="space-y-3">
              {stats.yearlyRewards.map((reward) => {
                const progress = (stats.totalQuantity || 0);
                const achieved = progress >= reward.min_quantity;
                const percentAchieve = reward.min_quantity > 0
                  ? Math.min((progress / reward.min_quantity) * 100, 100)
                  : 0;

                return (
                  <div
                    key={reward.id}
                    className={`p-4 rounded-lg border transition-all ${
                      achieved
                        ? "bg-green-50 border-green-200 shadow-sm"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-base">{reward.reward_description}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Target: {reward.min_quantity} units {reward.month ? `(Month ${reward.month})` : '(Yearly)'}
                        </p>
                      </div>
                      {achieved && (
                        <span className="text-sm font-medium text-green-700">Achieved!</span>
                      )}
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Progress: {progress} / {reward.min_quantity}</span>
                        <span className="font-medium">{Math.round(percentAchieve)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            achieved ? "bg-green-500" : "bg-primary"
                          }`}
                          style={{ width: `${percentAchieve}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No active rewards available
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyAnalytics;
