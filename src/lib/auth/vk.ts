type VkUserInfoResponse = {
  user?: Partial<{
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
    avatar: string;
  }>;
  error?: string;
  error_description?: string;
};

export type VkUserProfile = {
  vkId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  avatar: string | null;
};

export async function fetchVkUserProfile(accessToken: string): Promise<VkUserProfile> {
  const clientId = process.env.VK_CLIENT_ID?.trim();

  if (!clientId) {
    throw new Error("VK client id is not configured.");
  }

  const response = await fetch(`https://id.vk.com/oauth2/user_info?client_id=${encodeURIComponent(clientId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      access_token: accessToken,
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as VkUserInfoResponse | null;

  if (!response.ok || !payload?.user?.user_id || payload.error) {
    throw new Error(payload?.error_description || payload?.error || "VK user info request failed.");
  }

  const firstName = payload.user.first_name?.trim() || null;
  const lastName = payload.user.last_name?.trim() || null;
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || null;

  return {
    vkId: String(payload.user.user_id),
    email: payload.user.email?.trim().toLowerCase() || null,
    firstName,
    lastName,
    fullName,
    avatar: payload.user.avatar?.trim() || null,
  };
}
