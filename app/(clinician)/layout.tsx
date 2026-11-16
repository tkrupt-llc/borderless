// Care-team pages use the console palette (cool neutrals, see globals.css).
export default function ClinicianLayout({ children }: LayoutProps<"/">) {
  return <div className="console flex flex-1 flex-col">{children}</div>;
}
