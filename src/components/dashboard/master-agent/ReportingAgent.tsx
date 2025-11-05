import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, ArrowUpCircle, Target } from "lucide-react";

const ReportingAgent = () => {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["reporting-agent-ma", user?.id, startDate, endDate],
    queryFn: async () => {
      // Get agents under this master agent
      const { data: agents } = await supabase
        .from("profiles")
        .select(`
          id,
          idstaff,
          full_name,
          user_roles!user_roles_user_id_fkey!inner(role)
        `)
        .eq("user_roles.role", "agent")
        .eq("master_agent_id", user?.id);

      if (!agents) return [];

      // Get current date for rewards
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

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
            targetMonthly: monthlyReward?.min_quantity || 0,
            targetYearly: yearlyReward?.min_quantity || 0,
          };
        })
      );

      return enrichedData;
    },
    enabled: !!user?.id,
  });

  // Calculate summary stats
  const totalAgents = reportData?.length || 0;
  const totalStockIn = reportData?.reduce((sum, item) => sum + item.stockIn, 0) || 0;
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
          Comprehensive report of your agents performance
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
      <div className="grid gap-4 md:grid-cols-3">
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
                  <TableHead>Target Monthly</TableHead>
                  <TableHead>Target Yearly</TableHead>
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
                    <TableCell>{item.targetMonthly}</TableCell>
                    <TableCell>{item.targetYearly}</TableCell>
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
