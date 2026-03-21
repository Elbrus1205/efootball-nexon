import { AuthForm } from "@/components/auth/auth-form";

export default function RegisterPage() {
  return (
    <div className="page-shell py-12">
      <AuthForm type="register" />
    </div>
  );
}
