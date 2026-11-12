import { HelpBar } from "@/components/help-bar";

// Patient pages: one centred column (max 640px) with the sticky help bar at the bottom.
export default function PatientLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 justify-center">
      <div className="flex min-h-dvh w-full max-w-[640px] flex-col">
        <main className="flex flex-1 flex-col pb-6">{children}</main>
        <HelpBar />
      </div>
    </div>
  );
}
