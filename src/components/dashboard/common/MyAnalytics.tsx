import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Package, Award } from "lucide-react";

const MyAnalytics = () => {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["my-analytics", user?.id],
    queryFn: async () => {
      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select("total_price, quantity")
        .eq("buyer_id", user?.id);
      
      if (txError) throw txError;

      const { data: inventory, error: invError } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("user_id", user?.id);
      
      if (invError) throw invError;

      const { data: rewards, error: rewardsError } = await supabase
        .from("rewards_config")
        .select("*")
        .eq("is_active", true);
      
      if (rewardsError) throw rewardsError;

      const totalSpent = transactions?.reduce((sum, tx) => sum + parseFloat(tx.total_price.toString()), 0) || 0;
      const totalQuantity = transactions?.reduce((sum, tx) => sum + tx.quantity, 0) || 0;
      const currentStock = inventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;

      return {
        totalSpent,
        totalQuantity,
        currentStock,
        rewards,
      };
    },
  });

  const statCards = [
    {
      title: "Total Purchases",
      value: `RM ${stats?.totalSpent.toFixed(2) || "0.00"}`,
      icon: DollarSign,
      color: "text-green-600",
    },
    {
      title: "Products Purchased",
      value: stats?.totalQuantity || 0,
      icon: TrendingUp,
      color: "text-blue-600",
    },
    {
      title: "Current Stock",
      value: stats?.currentStock || 0,
      icon: Package,
      color: "text-purple-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-600" />
            Rewards Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats?.rewards?.map((reward) => {
              const achieved = (stats.totalQuantity || 0) >= reward.min_quantity;
              return (
                <div
                  key={reward.id}
                  className={`p-3 rounded-lg border ${
                    achieved ? "bg-green-50 border-green-200" : "bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{reward.reward_description}</p>
                      <p className="text-sm text-muted-foreground">
                        Minimum: {reward.min_quantity} units
                      </p>
                    </div>
                    {achieved && (
                      <Award className="h-6 w-6 text-yellow-600" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MyAnalytics;
