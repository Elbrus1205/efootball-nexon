import type { RolePermissionId } from "@/lib/role-permissions";
import type { StorageFolder } from "@/lib/storage/supabase-storage";

const MANAGED_FOLDER_PERMISSIONS: Partial<Record<StorageFolder, RolePermissionId>> = {
  tournaments: "tournaments.createEdit",
  divisions: "divisions.manage",
  faq: "content.manage",
};

export function getRequiredUploadPermission(folder: StorageFolder) {
  return MANAGED_FOLDER_PERMISSIONS[folder] ?? null;
}
