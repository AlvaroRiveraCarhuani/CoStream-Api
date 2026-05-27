export function extractAndCleanJwt(cookieInput: string | Record<string, any> | undefined): string | null {
  if (!cookieInput) return null;

  let token: string | null = null;

  if (typeof cookieInput === 'string') {
    const match = cookieInput.match(/(?:^|;\s*)jwt=([^;]*)/);
    token = match ? match[1] : null;
  } 
  else if (typeof cookieInput === 'object' && cookieInput.jwt) {
    token = cookieInput.jwt;
  }

  return token ? token.replace(/^"|"$/g, '') : null;
}