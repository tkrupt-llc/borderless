import { HelpBar } from "@/components/help-bar";

// Patient pages: one centred column (max 640px). The help buttons sit in a
// sticky bar at the bottom on phones and tablets, and in a panel beside the
// column on laptops and wider (from 1024px), so they never cover the content.
export default function PatientLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 justify-center">
      <div className="flex min-h-dvh w-full max-w-[640px] flex-col lg:max-w-[936px] lg:flex-row lg:items-start lg:gap-8 lg:px-6">
        <main className="flex flex-1 flex-col pb-6 lg:min-h-dvh lg:max-w-[640px]">{children}</main>
        <HelpBar />
      </div>
    </div>
  );
}
