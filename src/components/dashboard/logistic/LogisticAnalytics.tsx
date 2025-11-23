import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Package, CheckCircle, XCircle, AlertTriangle, Loader, PackageCheck } from "lucide-react";

const LogisticAnalytics = () => {
  // Fetch ALL raw material stock (no date filter)
  const { data: allRawMaterials } = useQuery({
    queryKey: ["all-raw-material-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raw_material_stock")
        .select("quantity");
      if (error) throw error;
      return data;
    },
  });

  // Fetch ALL processed stock (no date filter)
  const { data: allProcessedStock } = useQuery({
    queryKey: ["all-processed-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processed_stock")
        .select("quantity, status");
      if (error) throw error;
      return data;
    },
  });

  // Calculate totals WITHOUT date filter
  const totalRawMaterial = allRawMaterials?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  const totalSuccess = allProcessedStock?.filter(item => item.status === 'success')
    .reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalReject = allProcessedStock?.filter(item => item.status === 'reject')
    .reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalDamage = allProcessedStock?.filter(item => item.status === 'damage')
    .reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalLost = allProcessedStock?.filter(item => item.status === 'lost')
    .reduce((sum, item) => sum + item.quantity, 0) || 0;

  const totalProcessed = totalSuccess + totalReject + totalDamage + totalLost;
  const totalPending = totalRawMaterial - totalProcessed;

  const stats = [
    {
      title: "Total Raw Material",
      value: totalRawMaterial,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Total Processed",
      value: totalProcessed,
      icon: PackageCheck,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      title: "Total Pending",
      value: totalPending,
      icon: Loader,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      title: "Total Success Packaging",
      value: totalSuccess,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Total Reject Packaging",
      value: totalReject,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Total Damage Packaging",
      value: totalDamage,
      icon: AlertTriangle,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Total Lost Packaging",
      value: totalLost,
      icon: XCircle,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-2">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default LogisticAnalytics;
