import { RegulationsEditor } from "@/components/admin/regulations-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { getRegulationsText } from "@/lib/regulations";

export default async function AdminRegulationsPage() {
  await requirePermission("content.manage");

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
