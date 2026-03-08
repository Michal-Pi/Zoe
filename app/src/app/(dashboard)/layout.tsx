import { Sidebar } from "@/components/shared/sidebar";
import { SubscriptionGate } from "@/components/shared/subscription-gate";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SubscriptionGate>
      <div className="min-h-screen">
        <Sidebar />
        <main className="pl-14 lg:pl-56">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </SubscriptionGate>
  );
}
