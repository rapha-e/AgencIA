import crypto from "crypto";

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecryptionError";
  }
}

/**
 * Obtém ou deriva chave de 256 bits (32 bytes) para AES-256-GCM
 */
function getEncryptionKey(customSecret?: string): Buffer {
  const secret = customSecret || process.env.TOKEN_ENCRYPTION_SECRET;

  if (!secret) {
    // Chave padrão determinística de desenvolvimento (emite aviso de segurança)
    console.warn(
      "[AVISO DE SEGURANÇA] TOKEN_ENCRYPTION_SECRET não configurado. Utilizando derivação de chave de fallback local."
    );
    return crypto.createHash("sha256").update("admetrics_dev_fallback_secret_key_32_bytes!").digest();
  }

  // Se já for uma string hex de 64 caracteres (32 bytes)
  if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
    return Buffer.from(secret, "hex");
  }

  // Se for qualquer outra string de segredo, derivamos uma chave segura de 32 bytes via SHA-256
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Criptografa token de acesso com AES-256-GCM
 * Formato gerado: v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export function encryptToken(
  plainToken: string,
  secretKey?: string
): {
  versionedPayload: string;
  ivHex: string;
  tagHex: string;
} {
  if (!plainToken) {
    throw new Error("Token vazio não pode ser criptografado.");
  }

  const key = getEncryptionKey(secretKey);
  const iv = crypto.randomBytes(12); // Nonce de 96 bits recomendado pelo NIST para GCM

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plainToken, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  const ivHex = iv.toString("hex");
  const tagHex = authTag.toString("hex");
  const versionedPayload = `v1:${ivHex}:${tagHex}:${encrypted}`;

  return {
    versionedPayload,
    ivHex,
    tagHex,
  };
}

/**
 * Descriptografa token de acesso verificando integridade com a tag de autenticação GCM
 */
export function decryptToken(versionedPayload: string, secretKey?: string): string {
  if (!versionedPayload) {
    throw new DecryptionError("Payload criptografado ausente.");
  }

  const parts = versionedPayload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new DecryptionError("Formato de payload criptográfico inválido ou versão incompatível.");
  }

  const [, ivHex, tagHex, encryptedHex] = parts;

  try {
    const key = getEncryptionKey(secretKey);
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(tagHex, "hex");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    throw new DecryptionError("Falha na autenticação da tag criptográfica. O token foi adulterado ou a chave é inválida.");
  }
}
