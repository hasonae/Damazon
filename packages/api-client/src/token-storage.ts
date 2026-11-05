/**
 * Token storage contract.
 *
 * Access tokens are stored in memory by both PWAs. Refresh credentials remain
 * in the API's HttpOnly cookie and are never exposed to this interface.
 */

export interface TokenPair {
  readonly accessToken: string;
  readonly accessTokenExpiresIn: number;
}

export interface TokenStorage {
  readAccessToken(): string | null;
  writeSession(pair: TokenPair): Promise<void>;
  clearSession(): Promise<void>;
  /** Invoked when the server reports the refresh token is no longer valid. */
  onSessionExpired?(): void;
}

/** In-memory storage: the token is lost on reload, which is the safe default. */
export class MemoryTokenStorage implements TokenStorage {
  private accessToken: string | null = null;

  public readAccessToken(): string | null {
    return this.accessToken;
  }

  public async writeSession(pair: TokenPair): Promise<void> {
    this.accessToken = pair.accessToken;
  }

  public async clearSession(): Promise<void> {
    this.accessToken = null;
  }
}
