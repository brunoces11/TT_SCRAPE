export interface ApifyAccount {
  id: string;
  label: string;
  token: string;
  default: boolean;
}

export function getApifyAccounts(): ApifyAccount[] {
  const raw = process.env.APIFY_ACCOUNTS;
  if (!raw) {
    // Fallback to single APIFY_TOKEN for backward compatibility
    const token = process.env.APIFY_TOKEN;
    if (token) {
      return [{ id: "default", label: "Default", token, default: true }];
    }
    return [];
  }
  try {
    return JSON.parse(raw) as ApifyAccount[];
  } catch {
    return [];
  }
}

export function getTokenForAccount(accountId?: string): string {
  const accounts = getApifyAccounts();
  if (accountId) {
    const found = accounts.find((a) => a.id === accountId);
    if (found) return found.token;
  }
  // Return default account token
  const defaultAcc = accounts.find((a) => a.default);
  if (defaultAcc) return defaultAcc.token;
  // Fallback
  return accounts[0]?.token || process.env.APIFY_TOKEN || "";
}
