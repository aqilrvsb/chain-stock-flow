import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, Package, Users, BarChart3, Settings, Gift, DollarSign, Award, FileText, UserCheck } from "lucide-react";

interface SOPModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: string;
}

const SOPModal = ({ isOpen, onClose, userRole }: SOPModalProps) => {
  const [activeTab, setActiveTab] = useState("overview");

  const getSOPContent = () => {
    if (userRole === "hq") {
      return {
        title: "HQ Dashboard - Standard Operating Procedure",
        overview: "As HQ, you are the central administrator of the system. You manage all products, master agents, agents, and monitor the entire distribution chain.",
        sections: [
          {
            id: "dashboard",
            icon: Home,
            title: "Dashboard",
            description: "Main overview of the entire system",
            steps: [
              "View total master agents, agents, and customers across the system",
              "Monitor overall stock levels and distribution",
              "Check system-wide sales performance",
              "Review key metrics and analytics at a glance"
            ]
          },
          {
            id: "products",
            icon: Package,
            title: "Products",
            description: "Manage product catalog",
            steps: [
              "Add new products to the system",
              "Set pricing for different user levels (HQ Price, Master Agent Price, Agent Price, Customer Price)",
              "Update product information and availability",
              "Manage product bundles and packages",
              "View product inventory status"
            ]
          },
          {
            id: "master-agents",
            icon: Users,
            title: "Master Agents",
            description: "Manage master agent accounts",
            steps: [
              "Create new master agent accounts",
              "View all master agents in the system",
              "Monitor master agent performance and sales",
              "Manage master agent permissions and access",
              "Review master agent transaction history"
            ]
          },
          {
            id: "transactions",
            icon: BarChart3,
            title: "Transactions",
            description: "Process and review all transactions",
            steps: [
              "View all pending orders from master agents",
              "Approve or reject purchase requests",
              "Monitor payment status and confirmations",
              "Review transaction history across all users",
              "Generate transaction reports"
            ]
          },
          {
            id: "rewards",
            icon: Gift,
            title: "Rewards Config",
            description: "Set up reward programs",
            steps: [
              "Create monthly reward targets for master agents",
              "Set yearly reward milestones",
              "Define reward criteria and minimum quantities",
              "Configure reward benefits and incentives",
              "Monitor reward achievement progress"
            ]
          },
          {
            id: "reward-achievement",
            icon: Award,
            title: "Reward Achievement",
            description: "Track reward completions",
            steps: [
              "View all achieved rewards by master agents",
              "Monitor reward progress across the system",
              "Verify reward eligibility",
              "Track reward distribution",
              "Generate reward reports"
            ]
          },
          {
            id: "reporting-master",
            icon: FileText,
            title: "Reporting Master Agent",
            description: "Comprehensive master agent reports",
            steps: [
              "View detailed performance metrics for each master agent",
              "Monitor stock in/out movements",
              "Review agent and customer sales separately",
              "Analyze profit margins for agent and customer sales",
              "Filter reports by date range",
              "Track target achievement progress",
              "View agent count and customer count per master agent"
            ]
          },
          {
            id: "reporting-agent",
            icon: FileText,
            title: "Reporting Agent",
            description: "System-wide agent reports",
            steps: [
              "View all agents across all master agents",
              "Monitor agent purchase patterns",
              "Track agent inventory levels",
              "Review customer sales performance by agent",
              "Analyze agent profitability",
              "Filter by date range for specific periods",
              "Identify top performing agents"
            ]
          },
          {
            id: "settings",
            icon: Settings,
            title: "Settings",
            description: "System configuration",
            steps: [
              "Update HQ profile information",
              "Configure system-wide settings",
              "Manage payment methods",
              "Set up notification preferences",
              "Configure security settings"
            ]
          }
        ]
      };
    } else if (userRole === "master_agent") {
      return {
        title: "Master Agent Dashboard - Standard Operating Procedure",
        overview: "As a Master Agent, you are a key distributor in the chain. You purchase products from HQ, manage your own inventory, sell to agents under you, and can also sell directly to customers.",
        sections: [
          {
            id: "dashboard",
            icon: Home,
            title: "Dashboard",
            description: "Your performance overview",
            steps: [
              "View your total agent statistics (sales, profit, active agents)",
              "Monitor customer statistics (sales, profit, total customers)",
              "Check summary metrics (inventory, purchases, total sales, total profit)",
              "Review rewards progress for monthly and yearly targets",
              "Monitor key performance indicators"
            ]
          },
          {
            id: "purchase",
            icon: Package,
            title: "Purchase",
            description: "Buy products from HQ",
            steps: [
              "Browse available products from HQ",
              "View HQ pricing and master agent pricing",
              "Select products and quantities to order",
              "Choose payment method (Online Transfer, Cash, COD)",
              "Upload payment proof if using Online Transfer",
              "Submit purchase request to HQ",
              "Wait for HQ approval",
              "Track order status in Transactions"
            ]
          },
          {
            id: "inventory",
            icon: Package,
            title: "Inventory",
            description: "Manage your stock",
            steps: [
              "View current stock levels for all products",
              "Monitor product availability",
              "Track stock movements and history",
              "Check which products need restocking",
              "Review inventory value"
            ]
          },
          {
            id: "agents",
            icon: Users,
            title: "My Agents",
            description: "Manage agents under you",
            steps: [
              "View all agents assigned to you",
              "Create new agent accounts",
              "Monitor agent purchase activity",
              "Track agent performance and sales",
              "Review agent inventory levels",
              "Manage agent relationships"
            ]
          },
          {
            id: "customers",
            icon: UserCheck,
            title: "Customers",
            description: "Manage your customer base",
            steps: [
              "Add new customer records (name, phone, address, state)",
              "View all your customers",
              "Edit customer information",
              "Create customer purchase orders",
              "Select products from your inventory",
              "Set customer pricing",
              "Choose payment method",
              "Record customer transactions",
              "Track customer purchase history"
            ]
          },
          {
            id: "transactions",
            icon: BarChart3,
            title: "Transactions",
            description: "Your purchase history from HQ",
            steps: [
              "View all your orders to HQ",
              "Check order status (Pending, Completed, Rejected)",
              "Monitor payment confirmations",
              "Review transaction details",
              "Filter by date or status",
              "Track spending patterns"
            ]
          },
          {
            id: "transaction-agent",
            icon: DollarSign,
            title: "Transaction Agent",
            description: "Agent purchase requests",
            steps: [
              "View all purchase requests from your agents",
              "Review order details and quantities",
              "Check agent payment proofs",
              "Approve or reject agent orders",
              "Monitor agent payment status",
              "Track agent transaction history",
              "Manage agent credit if applicable"
            ]
          },
          {
            id: "reward-agent",
            icon: Award,
            title: "Reward Agent",
            description: "Agent reward management",
            steps: [
              "View reward achievements by your agents",
              "Monitor agent progress toward targets",
              "Track reward eligibility",
              "Verify agent reward claims",
              "Encourage agent performance"
            ]
          },
          {
            id: "reporting-agent",
            icon: FileText,
            title: "Reporting Agent",
            description: "Detailed agent reports",
            steps: [
              "View comprehensive reports for all your agents",
              "Monitor stock in from your sales to agents",
              "Track agent inventory levels",
              "Review customer sales by each agent",
              "Analyze agent and customer profitability",
              "Filter reports by date range",
              "Check target achievement by agent",
              "View total customers per agent"
            ]
          },
          {
            id: "settings",
            icon: Settings,
            title: "Settings",
            description: "Your account settings",
            steps: [
              "Update your profile information",
              "Change password",
              "Update contact details",
              "Set notification preferences",
              "Manage payment information"
            ]
          }
        ]
      };
    } else if (userRole === "agent") {
      return {
        title: "Agent Dashboard - Standard Operating Procedure",
        overview: "As an Agent, you purchase products from your Master Agent and sell to customers. You are the frontline of the distribution chain, directly serving end customers.",
        sections: [
          {
            id: "dashboard",
            icon: Home,
            title: "Dashboard",
            description: "Your performance overview",
            steps: [
              "View your customer statistics (sales, profit, total customers)",
              "Monitor summary metrics (inventory, purchases, sales, profit)",
              "Review rewards progress for monthly and yearly targets",
              "Check key performance indicators",
              "Track your sales trends"
            ]
          },
          {
            id: "purchase",
            icon: Package,
            title: "Purchase",
            description: "Buy products from your Master Agent",
            steps: [
              "Browse products available from your Master Agent",
              "View Master Agent pricing and Agent pricing",
              "Select products and quantities to order",
              "Choose payment method (Online Transfer, Cash, COD)",
              "Upload payment proof if using Online Transfer",
              "Submit purchase request to Master Agent",
              "Wait for Master Agent approval",
              "Track order status in Transactions"
            ]
          },
          {
            id: "inventory",
            icon: Package,
            title: "Inventory",
            description: "Manage your stock",
            steps: [
              "View current stock levels for all products",
              "Monitor product availability",
              "Track stock movements and history",
              "Check which products need restocking",
              "Plan reorders from Master Agent"
            ]
          },
          {
            id: "customers",
            icon: UserCheck,
            title: "Customers",
            description: "Manage your customer base",
            steps: [
              "Add new customer records (name, phone, address, state)",
              "View all your customers",
              "Edit customer information",
              "Create customer purchase orders",
              "Select products from your inventory",
              "Set customer pricing",
              "Choose payment method (Online Transfer, COD, Cash)",
              "Record customer transactions",
              "Track customer purchase history",
              "Build customer relationships"
            ]
          },
          {
            id: "transactions",
            icon: BarChart3,
            title: "Transactions",
            description: "Your purchase history",
            steps: [
              "View all your orders to Master Agent",
              "Check order status (Pending, Completed, Rejected)",
              "Monitor payment confirmations",
              "Review transaction details",
              "Filter by date or status",
              "Track spending patterns",
              "Plan future purchases"
            ]
          },
          {
            id: "settings",
            icon: Settings,
            title: "Settings",
            description: "Your account settings",
            steps: [
              "Update your profile information",
              "Change password",
              "Update contact details",
              "Set notification preferences",
              "Manage payment information"
            ]
          }
        ]
      };
    }

    return {
      title: "Standard Operating Procedure",
      overview: "Welcome to the system",
      sections: []
    };
  };

  const sopContent = getSOPContent();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{sopContent.title}</DialogTitle>
          <DialogDescription className="text-base mt-2">
            {sopContent.overview}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Detailed Guide</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Navigation Guide</CardTitle>
                    <CardDescription>Overview of all available features</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {sopContent.sections.map((section) => (
                      <div key={section.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div className="p-2 rounded-full bg-primary/10">
                          <section.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold">{section.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="details" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-6">
                {sopContent.sections.map((section, index) => (
                  <Card key={section.id}>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-primary/10">
                          <section.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{section.title}</CardTitle>
                          <CardDescription>{section.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <p className="font-medium text-sm text-muted-foreground">How to use:</p>
                        <ol className="space-y-2">
                          {section.steps.map((step, stepIndex) => (
                            <li key={stepIndex} className="flex gap-3 text-sm">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                                {stepIndex + 1}
                              </span>
                              <span className="flex-1 pt-0.5">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SOPModal;
