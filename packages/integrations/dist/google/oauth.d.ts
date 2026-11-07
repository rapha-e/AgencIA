export interface GoogleAdsOAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}
export interface GoogleOAuthStateData {
    nonce: string;
    userId: string;
    organizationId: string;
    clientId: string;
    createdAt: number;
}
export interface GoogleTokenResponse {
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    tokenType: string;
    scope?: string;
}
/**
 * Escopo oficial do Google Ads API.
 * A governança de somente leitura (GAQL searchStream) é imposta estritamente pelo conector.
 */
export declare const GOOGLE_ADS_OAUTH_SCOPES: readonly ["https://www.googleapis.com/auth/adwords"];
/**
 * Serviço de Autenticação OAuth 2.0 Oficial para Google Ads API
 */
export declare class GoogleAdsOAuthService {
    private readonly clientId;
    private readonly clientSecret;
    private readonly redirectUri;
    constructor(config: GoogleAdsOAuthConfig);
    /**
     * Cria o state assinado com HMAC-SHA256 e nonce para proteção contra CSRF
     */
    generateSignedState(data: Omit<GoogleOAuthStateData, "nonce" | "createdAt">): {
        stateString: string;
        nonce: string;
    };
    /**
     * Verifica integridade e expiração do state OAuth do Google Ads
     */
    verifySignedState(stateString: string, maxAgeMs?: number): GoogleOAuthStateData;
    /**
     * Gera a URL oficial de consentimento OAuth 2.0 do Google com access_type=offline
     */
    getAuthorizationUrl(stateString: string): string;
    /**
     * Troca o authorization code por Access Token + Refresh Token
     */
    exchangeCodeForTokens(code: string, fetchFn?: typeof fetch): Promise<GoogleTokenResponse>;
    /**
     * Renova um Access Token expirado usando o Refresh Token armazenado
     */
    refreshAccessToken(refreshToken: string, fetchFn?: typeof fetch): Promise<GoogleTokenResponse>;
}
//# sourceMappingURL=oauth.d.ts.map