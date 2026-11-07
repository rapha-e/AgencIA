import crypto from "crypto";
/**
 * Escopo oficial do Google Ads API.
 * A governança de somente leitura (GAQL searchStream) é imposta estritamente pelo conector.
 */
export const GOOGLE_ADS_OAUTH_SCOPES = [
    "https://www.googleapis.com/auth/adwords"
];
/**
 * Serviço de Autenticação OAuth 2.0 Oficial para Google Ads API
 */
export class GoogleAdsOAuthService {
    clientId;
    clientSecret;
    redirectUri;
    constructor(config) {
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.redirectUri = config.redirectUri;
    }
    /**
     * Cria o state assinado com HMAC-SHA256 e nonce para proteção contra CSRF
     */
    generateSignedState(data) {
        const nonce = crypto.randomBytes(16).toString("hex");
        const payload = {
            ...data,
            nonce,
            createdAt: Date.now()
        };
        const payloadJson = JSON.stringify(payload);
        const payloadBase64 = Buffer.from(payloadJson, "utf8").toString("base64url");
        const signature = crypto
            .createHmac("sha256", this.clientSecret)
            .update(payloadBase64)
            .digest("base64url");
        return {
            stateString: `${payloadBase64}.${signature}`,
            nonce
        };
    }
    /**
     * Verifica integridade e expiração do state OAuth do Google Ads
     */
    verifySignedState(stateString, maxAgeMs = 600000) {
        if (!stateString || !stateString.includes(".")) {
            throw new Error("Parâmetro state do Google OAuth ausente ou malformado.");
        }
        const [payloadBase64, providedSignature] = stateString.split(".");
        const expectedSignature = crypto
            .createHmac("sha256", this.clientSecret)
            .update(payloadBase64)
            .digest("base64url");
        const providedBuffer = Buffer.from(providedSignature, "utf8");
        const expectedBuffer = Buffer.from(expectedSignature, "utf8");
        if (providedBuffer.length !== expectedBuffer.length ||
            !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
            throw new Error("Assinatura do state inválida. Possível ataque CSRF no Google OAuth.");
        }
        const payloadJson = Buffer.from(payloadBase64, "base64url").toString("utf8");
        const data = JSON.parse(payloadJson);
        if (Date.now() - data.createdAt > maxAgeMs) {
            throw new Error("A sessão de autorização do Google Ads expirou. Reinicie a conexão.");
        }
        return data;
    }
    /**
     * Gera a URL oficial de consentimento OAuth 2.0 do Google com access_type=offline
     */
    getAuthorizationUrl(stateString) {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: "code",
            scope: GOOGLE_ADS_OAUTH_SCOPES.join(" "),
            access_type: "offline",
            prompt: "consent",
            include_granted_scopes: "true",
            state: stateString
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }
    /**
     * Troca o authorization code por Access Token + Refresh Token
     */
    async exchangeCodeForTokens(code, fetchFn = fetch) {
        const body = new URLSearchParams({
            code,
            client_id: this.clientId,
            client_secret: this.clientSecret,
            redirect_uri: this.redirectUri,
            grant_type: "authorization_code"
        });
        const response = await fetchFn("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: body.toString()
        });
        const json = (await response.json());
        if (!response.ok || json.error) {
            throw new Error(`Erro ao trocar código OAuth do Google Ads: ${json.error_description || json.error || response.statusText}`);
        }
        return {
            accessToken: json.access_token,
            refreshToken: json.refresh_token,
            expiresIn: Number(json.expires_in || 3600),
            tokenType: json.token_type || "Bearer",
            scope: json.scope
        };
    }
    /**
     * Renova um Access Token expirado usando o Refresh Token armazenado
     */
    async refreshAccessToken(refreshToken, fetchFn = fetch) {
        const body = new URLSearchParams({
            refresh_token: refreshToken,
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: "refresh_token"
        });
        const response = await fetchFn("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: body.toString()
        });
        const json = (await response.json());
        if (!response.ok || json.error) {
            throw new Error(`Erro ao renovar access token do Google Ads: ${json.error_description || json.error || response.statusText}`);
        }
        return {
            accessToken: json.access_token,
            refreshToken,
            expiresIn: Number(json.expires_in || 3600),
            tokenType: json.token_type || "Bearer",
            scope: json.scope
        };
    }
}
//# sourceMappingURL=oauth.js.map