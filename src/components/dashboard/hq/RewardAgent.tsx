import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, Award, Target, TrendingUp } from "lucide-react";

const RewardAgent = () => {
  const currentDate = new Date();
  const [periodFilter, setPeriodFilter] = useState<"monthly" | "yearly">("monthly");
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());

  const { data: rewardData, isLoading } = useQuery({
    queryKey: ["reward-agent-progress", periodFilter, selectedMonth, selectedYear],
    queryFn: async () => {
      const month = periodFilter === "monthly" ? parseInt(selectedMonth) : 0;
      const year = parseInt(selectedYear);

      // Get active rewards for agents - filter by period type
      const { data: rewards } = await supabase
        .from("rewards_config")
        .select("*")
        .eq("role", "agent")
        .eq("month", month)
        .eq("year", year)
        .eq("is_active", true)
        .order("month", { ascending: false });

      // Get all agents
      const { data: agents } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          idstaff,
          user_roles!user_roles_user_id_fkey!inner(role)
        `)
        .eq("user_roles.role", "agent");

      if (!agents) return { agents: [], rewards: rewards || [] };

      // Get master agents to filter transactions
      const { data: masterAgents } = await supabase
        .from("profiles")
        .select(`
          id,
          user_roles!user_roles_user_id_fkey!inner(role)
        `)
        .eq("user_roles.role", "master_agent");

      const masterAgentIds = masterAgents?.map(ma => ma.id) || [];

      // Get transactions for each agent (purchases from Master Agents)
      // For yearly: Jan 1 to Dec 31, For monthly: specific month
      const startDate = periodFilter === "yearly"
        ? new Date(year, 0, 1)
        : new Date(year, month - 1, 1);
      const endDate = periodFilter === "yearly"
        ? new Date(year, 11, 31, 23, 59, 59)
        : new Date(year, month, 0, 23, 59, 59);

      const progressData = await Promise.all(
        agents.map(async (agent) => {
          const { data: transactions } = await supabase
            .from("transactions")
            .select("quantity")
            .eq("buyer_id", agent.id)
            .in("seller_id", masterAgentIds)
            .eq("transaction_type", "purchase")
            .gte("created_at", startDate.toISOString())
            .lte("created_at", endDate.toISOString());

          const totalQuantity = transactions?.reduce((sum, tx) => sum + tx.quantity, 0) || 0;

          // Find matching rewards and calculate achievement
          const rewardProgress = rewards?.map(reward => {
            const percentAchieve = reward.min_quantity > 0 
              ? Math.min((totalQuantity / reward.min_quantity) * 100, 100)
              : 0;
            const isAchieved = totalQuantity >= reward.min_quantity;

            return {
              ...reward,
              totalQuantity,
              percentAchieve: Math.round(percentAchieve),
              isAchieved,
            };
          }) || [];

          return {
            agent,
            rewardProgress,
            totalQuantity,
          };
        })
      );

      return { agents: progressData, rewards: rewards || [] };
    },
  });

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  // Calculate summary stats
  const allUsers = rewardData?.agents.length || 0;
  const achievedCount = rewardData?.agents.filter(a => 
    a.rewardProgress.some(rp => rp.isAchieved)
  ).length || 0;
  const notAchievedCount = allUsers - achievedCount;
  const totalTargetQuantity = rewardData?.rewards.reduce((sum, r) => sum + r.min_quantity, 0) || 0;
  const totalQuantity = rewardData?.agents.reduce((sum, a) => sum + a.totalQuantity, 0) || 0;

  const summaryStats = [
    { title: "All Users", value: allUsers, icon: Users, color: "text-blue-600" },
    { title: "Achieved", value: achievedCount, icon: Award, color: "text-green-600" },
    { title: "Not Achieved", value: notAchievedCount, icon: Target, color: "text-orange-600" },
    { title: "Total Target Quantity", value: totalTargetQuantity, icon: TrendingUp, color: "text-purple-600" },
    { title: "Total Quantity", value: totalQuantity, icon: TrendingUp, color: "text-cyan-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          Reward Agent Progress
        </h1>
        <p className="text-muted-foreground mt-2">
          Track Agent performance towards monthly reward targets
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
          <CardTitle>Filter by Period</CardTitle>
          <div className="grid gap-4 md:grid-cols-3 mt-4">
            <div className="space-y-2">
              <Label htmlFor="periodType">Period Type</Label>
              <Select value={periodFilter} onValueChange={(value: any) => setPeriodFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {periodFilter === "monthly" && (
              <div className="space-y-2">
                <Label htmlFor="month">Month</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthNames.map((name, index) => (
                      <SelectItem key={index + 1} value={(index + 1).toString()}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading progress data...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Target Quantity</TableHead>
                  <TableHead>Total Quantity</TableHead>
                  <TableHead>Percent Achieve</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rewardData?.agents.flatMap((a) =>
                  a.rewardProgress.length > 0 ? (
                    a.rewardProgress.map((rp, idx) => (
                      <TableRow key={`${a.agent.id}-${idx}`}>
                        <TableCell>{monthNames[parseInt(selectedMonth) - 1]}</TableCell>
                        <TableCell>{selectedYear}</TableCell>
                        <TableCell>{a.agent.idstaff || a.agent.full_name || a.agent.email}</TableCell>
                        <TableCell>{rp.min_quantity}</TableCell>
                        <TableCell className="font-bold">{rp.totalQuantity}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-full max-w-[100px] bg-muted rounded-full h-2">
                              <div 
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${rp.percentAchieve}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{rp.percentAchieve}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rp.isAchieved ? "default" : "secondary"}>
                            {rp.isAchieved ? "Achieved" : "Not Achieved"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow key={a.agent.id}>
                      <TableCell>{monthNames[parseInt(selectedMonth) - 1]}</TableCell>
                      <TableCell>{selectedYear}</TableCell>
                      <TableCell>{a.agent.idstaff || a.agent.full_name || a.agent.email}</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>{a.totalQuantity}</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>
                        <Badge variant="secondary">No Target</Badge>
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RewardAgent;