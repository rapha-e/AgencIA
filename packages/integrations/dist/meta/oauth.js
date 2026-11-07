import crypto from "crypto";
/**
 * Escopos permitidos para integração estritamente de leitura.
 * RESTRIÇÃO CRÍTICA: 'ads_management' NUNCA é solicitado.
 */
export const META_READONLY_SCOPES = ["ads_read", "public_profile"];
/**
 * Gerador e Validador de Fluxo OAuth para Meta Marketing API
 */
export class MetaOAuthService {
    appId;
    appSecret;
    redirectUri;
    apiVersion;
    constructor(config) {
        this.appId = config.appId;
        this.appSecret = config.appSecret;
        this.redirectUri = config.redirectUri;
        this.apiVersion =
            config.apiVersion ||
                (typeof process !== "undefined" && (process.env?.META_GRAPH_API_VERSION || process.env?.META_API_VERSION)) ||
                "v22.0";
    }
    /**
     * Cria o state com nonce e assinatura HMAC-SHA256 para proteção contra CSRF
     */
    generateSignedState(data) {
        const nonce = crypto.randomBytes(16).toString("hex");
        const payload = {
            ...data,
            nonce,
            createdAt: Date.now(),
        };
        const payloadJson = JSON.stringify(payload);
        const payloadBase64 = Buffer.from(payloadJson, "utf8").toString("base64url");
        const signature = crypto
            .createHmac("sha256", this.appSecret)
            .update(payloadBase64)
            .digest("base64url");
        return {
            stateString: `${payloadBase64}.${signature}`,
            nonce,
        };
    }
    /**
     * Valida o state recebido no callback
     */
    verifySignedState(stateString, maxAgeMs = 600000) {
        if (!stateString || !stateString.includes(".")) {
            throw new Error("Parâmetro state ausente ou malformado.");
        }
        const [payloadBase64, providedSignature] = stateString.split(".");
        const expectedSignature = crypto
            .createHmac("sha256", this.appSecret)
            .update(payloadBase64)
            .digest("base64url");
        // Comparação em tempo constante para evitar timing attacks
        const providedBuffer = Buffer.from(providedSignature, "utf8");
        const expectedBuffer = Buffer.from(expectedSignature, "utf8");
        if (providedBuffer.length !== expectedBuffer.length ||
            !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
            throw new Error("Assinatura do state inválida. Possível ataque CSRF.");
        }
        const payloadJson = Buffer.from(payloadBase64, "base64url").toString("utf8");
        const data = JSON.parse(payloadJson);
        // Validação de expiração (10 minutos por padrão)
        if (Date.now() - data.createdAt > maxAgeMs) {
            throw new Error("O link de autorização expirou. Por favor, reinicie o processo de conexão.");
        }
        return data;
    }
    /**
     * Gera a URL oficial de diálogo OAuth da Meta
     */
    getAuthorizationUrl(stateString) {
        const params = new URLSearchParams({
            client_id: this.appId,
            redirect_uri: this.redirectUri,
            state: stateString,
            scope: META_READONLY_SCOPES.join(","),
            response_type: "code",
        });
        return `https://www.facebook.com/${this.apiVersion}/dialog/oauth?${params.toString()}`;
    }
    /**
     * Troca o código temporário por Short-Lived User Access Token
     */
    async exchangeCodeForToken(code, fetchFn = fetch) {
        const params = new URLSearchParams({
            client_id: this.appId,
            client_secret: this.appSecret,
            redirect_uri: this.redirectUri,
            code,
        });
        const response = await fetchFn(`https://graph.facebook.com/${this.apiVersion}/oauth/access_token?${params.toString()}`);
        const json = (await response.json());
        if (!response.ok || json.error) {
            throw new Error(`Erro na troca de código da Meta: ${json.error?.message || response.statusText}`);
        }
        return {
            accessToken: json.access_token,
            tokenType: json.token_type || "bearer",
            expiresIn: json.expires_in,
        };
    }
    /**
     * Troca o Short-Lived Token por um Long-Lived Token (válido por ~60 dias)
     */
    async exchangeForLongLivedToken(shortLivedToken, fetchFn = fetch) {
        const params = new URLSearchParams({
            grant_type: "fb_exchange_token",
            client_id: this.appId,
            client_secret: this.appSecret,
            fb_exchange_token: shortLivedToken,
        });
        const response = await fetchFn(`https://graph.facebook.com/${this.apiVersion}/oauth/access_token?${params.toString()}`);
        const json = (await response.json());
        if (!response.ok || json.error) {
            throw new Error(`Erro ao renovar token de longa duração da Meta: ${json.error?.message || response.statusText}`);
        }
        return {
            accessToken: json.access_token,
            tokenType: json.token_type || "bearer",
            expiresIn: json.expires_in, // geralmente ~5184000 segundos (60 dias)
        };
    }
    /**
     * Inspeciona escopos concedidos e validade do token
     */
    async debugToken(token, fetchFn = fetch) {
        const appAccessToken = `${this.appId}|${this.appSecret}`;
        const params = new URLSearchParams({
            input_token: token,
            access_token: appAccessToken,
        });
        const response = await fetchFn(`https://graph.facebook.com/${this.apiVersion}/debug_token?${params.toString()}`);
        const json = (await response.json());
        if (!response.ok || json.error) {
            throw new Error(`Erro ao inspecionar token: ${json.error?.message || response.statusText}`);
        }
        const data = json.data;
        return {
            isValid: Boolean(data?.is_valid),
            appId: data?.app_id,
            userId: data?.user_id,
            expiresAt: data?.expires_at,
            scopes: data?.scopes || [],
        };
    }
}
//# sourceMappingURL=oauth.js.map