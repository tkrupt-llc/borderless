import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export default function StaffLoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-6 px-5 py-12">
      <Logo size="lg" />
      <div>
        <h1 className="font-serif text-[1.875rem] leading-tight font-normal">Care team sign-in</h1>
      </div>
      <LoginForm />
    </main>
  );
}
