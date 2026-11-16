import { HelpBar } from "@/components/help-bar";

// Patient pages: one centred column (max 640px). The help buttons sit in a
// sticky bar at the bottom on phones and tablets. From 1024px they move into
// the right-hand margin, level with the top bar, and the column stays centred.
export default function PatientLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 justify-center">
      <div className="flex min-h-dvh w-full max-w-[640px] flex-col lg:grid lg:max-w-none lg:grid-cols-[1fr_minmax(0,640px)_1fr] lg:items-start">
        <main className="flex flex-1 flex-col pb-6 lg:col-start-2 lg:row-start-1 lg:min-h-dvh">{children}</main>
        <HelpBar />
      </div>
    </div>
  );
}
