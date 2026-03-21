import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <div className="page-shell py-12">
      <AuthForm type="login" />
    </div>
  );
}
