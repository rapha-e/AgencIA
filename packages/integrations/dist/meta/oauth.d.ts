export interface MetaOAuthConfig {
    appId: string;
    appSecret: string;
    redirectUri: string;
    apiVersion?: string;
}
export interface MetaOAuthStateData {
    nonce: string;
    userId: string;
    organizationId: string;
    clientId: string;
    createdAt: number;
}
export interface MetaTokenResponse {
    accessToken: string;
    tokenType: string;
    expiresIn?: number;
}
export interface MetaDebugTokenResponse {
    isValid: boolean;
    appId: string;
    userId: string;
    expiresAt: number;
    scopes: string[];
}
/**
 * Escopos permitidos para integração estritamente de leitura.
 * RESTRIÇÃO CRÍTICA: 'ads_management' NUNCA é solicitado.
 */
export declare const META_READONLY_SCOPES: readonly ["ads_read", "public_profile"];
/**
 * Gerador e Validador de Fluxo OAuth para Meta Marketing API
 */
export declare class MetaOAuthService {
    private readonly appId;
    private readonly appSecret;
    private readonly redirectUri;
    private readonly apiVersion;
    constructor(config: MetaOAuthConfig);
    /**
     * Cria o state com nonce e assinatura HMAC-SHA256 para proteção contra CSRF
     */
    generateSignedState(data: Omit<MetaOAuthStateData, "nonce" | "createdAt">): {
        stateString: string;
        nonce: string;
    };
    /**
     * Valida o state recebido no callback
     */
    verifySignedState(stateString: string, maxAgeMs?: number): MetaOAuthStateData;
    /**
     * Gera a URL oficial de diálogo OAuth da Meta
     */
    getAuthorizationUrl(stateString: string): string;
    /**
     * Troca o código temporário por Short-Lived User Access Token
     */
    exchangeCodeForToken(code: string, fetchFn?: typeof fetch): Promise<MetaTokenResponse>;
    /**
     * Troca o Short-Lived Token por um Long-Lived Token (válido por ~60 dias)
     */
    exchangeForLongLivedToken(shortLivedToken: string, fetchFn?: typeof fetch): Promise<MetaTokenResponse>;
    /**
     * Inspeciona escopos concedidos e validade do token
     */
    debugToken(token: string, fetchFn?: typeof fetch): Promise<MetaDebugTokenResponse>;
}
//# sourceMappingURL=oauth.d.ts.map