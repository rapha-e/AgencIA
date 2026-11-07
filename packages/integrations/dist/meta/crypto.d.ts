export declare class DecryptionError extends Error {
    constructor(message: string);
}
/**
 * Criptografa token de acesso com AES-256-GCM
 * Formato gerado: v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export declare function encryptToken(plainToken: string, secretKey?: string): {
    versionedPayload: string;
    ivHex: string;
    tagHex: string;
};
/**
 * Descriptografa token de acesso verificando integridade com a tag de autenticação GCM
 */
export declare function decryptToken(versionedPayload: string, secretKey?: string): string;
//# sourceMappingURL=crypto.d.ts.map