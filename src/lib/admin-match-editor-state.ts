export function pickAdminMatchSaveResult(
  requestedPayload: Record<string, unknown>,
  serverMatch: Record<string, unknown>,
) {
  const savedFields: Record<string, unknown> = {};

  for (const field of Object.keys(requestedPayload)) {
    if (field in serverMatch) {
      savedFields[field] = serverMatch[field];
    }
  }

  return savedFields;
}

export function mergeAdminMatchSaveResult<T extends object>(
  currentMatch: T,
  requestedPayload: Record<string, unknown>,
  serverMatch: Record<string, unknown>,
) {
  return {
    ...currentMatch,
    ...pickAdminMatchSaveResult(requestedPayload, serverMatch),
  } as T;
}
