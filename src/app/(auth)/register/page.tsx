import { AuthForm } from "@/components/auth/auth-form";

export default function RegisterPage({
  searchParams,
}: {
  searchParams?: Record<string, string>;
}) {
  void searchParams;
  const vkAppId = process.env.NEXT_PUBLIC_VK_APP_ID ?? process.env.VK_CLIENT_ID;

  return (
    <div className="page-shell py-12">
      <AuthForm type="register" vkAppId={vkAppId} />
    </div>
  );
}
