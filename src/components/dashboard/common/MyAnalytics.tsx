import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  TrendingDown
} from "lucide-react";

const MyAnalytics = () => {
  const { user, userRole } = useAuth();

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

        // Calculate Total Unit In (pending orders where success)
        const totalUnitIn = completedPurchases.reduce((sum, tx) => sum + tx.quantity, 0);

        // Calculate Total Unit Out (agent purchases where success)
        const totalUnitOut = agentUnitsSold;

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

        // Get yearly rewards for master agent
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

        // Get yearly rewards for agent
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
          monthlyRewards,
          yearlyRewards,
        };
      }
    },
    enabled: !!user?.id,
  });

  const getStatCards = () => {
    const baseCards = [
      {
        title: "Total Purchases",
        value: `RM ${(stats?.totalSpent || 0).toFixed(2)}`,
        subtitle: "Completed orders",
        icon: DollarSign,
        color: "text-emerald-600",
      },
      {
        title: "Products Purchased",
        value: stats?.totalQuantity || 0,
        subtitle: "Total units",
        icon: ShoppingCart,
        color: "text-blue-600",
      },
      {
        title: "Current Stock",
        value: stats?.currentStock || 0,
        subtitle: "Available inventory",
        icon: Package,
        color: "text-purple-600",
      },
      {
        title: "Completed Orders",
        value: stats?.completedCount || 0,
        subtitle: "Successful transactions",
        icon: CheckCircle2,
        color: "text-green-600",
      },
      {
        title: "Pending Amount",
        value: `RM ${(stats?.pendingAmount || 0).toFixed(2)}`,
        subtitle: `${stats?.pendingCount || 0} pending orders`,
        icon: TrendingUp,
        color: "text-orange-600",
      },
    ];

    if (userRole === "master_agent") {
      return [
        {
          title: "Total Unit In",
          value: stats?.totalUnitIn || 0,
          subtitle: "Pending orders success",
          icon: Package,
          color: "text-blue-600",
        },
        {
          title: "Total Unit Out",
          value: stats?.totalUnitOut || 0,
          subtitle: "Agent purchases success",
          icon: Package,
          color: "text-orange-600",
        },
        {
          title: "Total Sales",
          value: `RM ${(stats?.agentSalesTotal || 0).toFixed(2)}`,
          subtitle: "Revenue from agents",
          icon: DollarSign,
          color: "text-emerald-600",
        },
        {
          title: "Total Profit",
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
        {
          title: "Latest Balance Unit",
          value: stats?.currentStock || 0,
          subtitle: "Current inventory",
          icon: Package,
          color: "text-violet-600",
        },
      ];
    }

    // Agent cards
    return [
      {
        title: "Total Unit In",
        value: stats?.totalUnitIn || 0,
        subtitle: "Agent purchases success",
        icon: Package,
        color: "text-blue-600",
      },
      {
        title: "Latest Balance Unit",
        value: stats?.currentStock || 0,
        subtitle: "Current inventory",
        icon: Package,
        color: "text-violet-600",
      },
      ...baseCards,
    ];
  };

  const statCards = getStatCards();

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {statCards.map((stat, index) => (
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
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-600" />
            Monthly Rewards Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.monthlyRewards && stats.monthlyRewards.length > 0 ? (
            <div className="space-y-3">
              {stats.monthlyRewards.map((reward) => {
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
                          Target: {reward.min_quantity} units
                        </p>
                      </div>
                      {achieved && (
                        <div className="flex items-center gap-2 bg-green-100 px-3 py-1 rounded-full">
                          <Award className="h-5 w-5 text-yellow-600" />
                          <span className="text-sm font-medium text-green-700">Achieved!</span>
                        </div>
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
              No active rewards for this month
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-600" />
            Yearly Rewards Progress
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
                        <div className="flex items-center gap-2 bg-green-100 px-3 py-1 rounded-full">
                          <Award className="h-5 w-5 text-amber-600" />
                          <span className="text-sm font-medium text-green-700">Achieved!</span>
                        </div>
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
              No active rewards for this year
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyAnalytics;
