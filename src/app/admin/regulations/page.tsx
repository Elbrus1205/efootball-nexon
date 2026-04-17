import { UserRole } from "@prisma/client";
import { RegulationsEditor } from "@/components/admin/regulations-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { getRegulationsText } from "@/lib/regulations";

export default async function AdminRegulationsPage() {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR, UserRole.HEAD_JUDGE, UserRole.JUDGE]);

  const regulations = await getRegulationsText();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Регламент</CardTitle>
        <CardDescription>Этот текст показывается на публичной странице регламента.</CardDescription>
      </CardHeader>
      <CardContent>
        <RegulationsEditor initialText={regulations} />
      </CardContent>
    </Card>
  );
}
