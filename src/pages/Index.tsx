import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Package, ArrowRight, TrendingUp, Users, ShieldCheck } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-accent/5">
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Package className="h-7 w-7 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">DistroHub</span>
          </div>
          <Button onClick={() => navigate("/auth")} variant="outline">
            Login
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-6 text-5xl font-bold leading-tight md:text-6xl">
            Multi-Tier Product
            <br />
            <span className="text-primary">Distribution Platform</span>
          </h1>
          <p className="mb-10 text-xl text-muted-foreground">
            Streamline your distribution network with role-based access, dynamic pricing,
            and real-time analytics across HQ, Master Agents, and Agents.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" onClick={() => navigate("/auth")} className="w-full sm:w-auto">
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-24 grid max-w-5xl gap-8 md:grid-cols-3">
          <div className="rounded-xl border bg-card p-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <TrendingUp className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Dynamic Pricing</h3>
            <p className="text-muted-foreground">
              Configure custom pricing for each tier automatically
            </p>
          </div>

          <div className="rounded-xl border bg-card p-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
              <Users className="h-7 w-7 text-accent" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Multi-Tier Structure</h3>
            <p className="text-muted-foreground">
              Manage HQ, Master Agents, and Agents seamlessly
            </p>
          </div>

          <div className="rounded-xl border bg-card p-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
              <ShieldCheck className="h-7 w-7 text-success" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Secure & Scalable</h3>
            <p className="text-muted-foreground">
              Role-based access control with real-time tracking
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
