import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, Users, Package, Calendar, Target, PhoneCall, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Analytics = () => {
  const { data: transactions } = useQuery({
    queryKey: ["hq-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["hq-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: masterAgents } = useQuery({
    queryKey: ["master-agents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*").eq("role", "master_agent");
      if (error) throw error;
      return data;
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*").eq("role", "agent");
      if (error) throw error;
      return data;
    },
  });

  const totalSales = transactions?.reduce((sum, t) => sum + Number(t.total_price), 0) || 0;
  const totalProfit = transactions?.reduce((sum, t) => {
    const product = products?.find(p => p.id === t.product_id);
    const profit = Number(t.total_price) - (Number(product?.base_cost || 0) * t.quantity);
    return sum + profit;
  }, 0) || 0;

  const today = new Date().toISOString().split('T')[0];

  const stats = [
    {
      title: "Total Sales",
      value: `RM ${totalSales.toFixed(2)}`,
      icon: Target,
      subtitle: "All-time revenue",
      iconBg: "bg-purple-100 dark:bg-purple-900/20",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
    {
      title: "Total Contacts",
      value: (masterAgents?.length || 0) + (agents?.length || 0),
      icon: Users,
      subtitle: "Active users",
      iconBg: "bg-purple-100 dark:bg-purple-900/20",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
    {
      title: "Total Minutes Used",
      value: `${totalProfit.toFixed(1)} min`,
      icon: Calendar,
      subtitle: "Pro account usage",
      iconBg: "bg-blue-100 dark:bg-blue-900/20",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Remaining Minutes",
      value: `${(products?.length || 0)} min`,
      icon: Calendar,
      subtitle: "Pro account balance",
      iconBg: "bg-green-100 dark:bg-green-900/20",
      iconColor: "text-green-600 dark:text-green-400",
    },
    {
      title: "Total Calls",
      value: transactions?.length || 0,
      icon: PhoneCall,
      subtitle: "All transactions",
      iconBg: "bg-blue-100 dark:bg-blue-900/20",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Answered",
      value: transactions?.filter(t => t.transaction_type === "purchase").length || 0,
      icon: CheckCircle,
      subtitle: "Completed purchases",
      iconBg: "bg-green-100 dark:bg-green-900/20",
      iconColor: "text-green-600 dark:text-green-400",
    },
    {
      title: "Unanswered",
      value: 0,
      icon: XCircle,
      subtitle: "Pending items",
      iconBg: "bg-orange-100 dark:bg-orange-900/20",
      iconColor: "text-orange-600 dark:text-orange-400",
    },
    {
      title: "Voicemail/Failed",
      value: 0,
      icon: AlertCircle,
      subtitle: "Failed transactions",
      iconBg: "bg-red-100 dark:bg-red-900/20",
      iconColor: "text-red-600 dark:text-red-400",
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Date Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="from-date">From Date</Label>
              <Input id="from-date" type="date" defaultValue={today} className="w-full" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to-date">To Date</Label>
              <Input id="to-date" type="date" defaultValue={today} className="w-full" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold text-primary">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.iconBg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Analytics;
