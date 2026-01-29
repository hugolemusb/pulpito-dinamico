
import { supabase } from '../lib/supabaseClient';

// --- Types ---
export type SocialPlatform = 'meta' | 'tiktok' | 'restream';

export interface SocialAccount {
    id: string;
    platform: SocialPlatform;
    connected: boolean;
    expires_at?: string;
    scopes?: string[];
}

// --- Configuration ---
// In a real app, this key should not be hardcoded in the client.
// We use it here to demonstrate the encryption-at-rest requirement requested.
// Ideally, this would be a user-derived key (e.g. from password or PIN).
const APP_ENCRYPTION_SECRET = "PULPITO_DINAMICO_OFFLINE_SECRET_KEY_2026";

// --- PKCE Utilities ---

function base64URLEncode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
}

export const generatePKCE = async () => {
    const array = new Uint32Array(32);
    window.crypto.getRandomValues(array);
    const verifier = base64URLEncode(array.buffer);

    const challengeBuffer = await sha256(verifier);
    const challenge = base64URLEncode(challengeBuffer);

    return { verifier, challenge };
};

// --- Encryption Utilities (AES-GCM) ---

async function getKey(): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(APP_ENCRYPTION_SECRET),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: encoder.encode("salt_pulpito_v1"), // Fixed salt for now
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

export const encryptToken = async (token: string) => {
    const key = await getKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();

    const encryptedContent = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encoder.encode(token)
    );

    return {
        encrypted: base64URLEncode(encryptedContent),
        iv: base64URLEncode(iv.buffer)
    };
};

export const decryptToken = async (encrypted: string, ivStr: string) => {
    // Decode Base64URL
    const fromBase64URL = (str: string) => {
        const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        const binary_string = window.atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    };

    try {
        const key = await getKey();
        const iv = fromBase64URL(ivStr);
        const data = fromBase64URL(encrypted);

        const decryptedContent = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(iv) },
            key,
            data
        );

        return new TextDecoder().decode(decryptedContent);
    } catch (e) {
        console.error("Decryption failed:", e);
        return null; // Return null if decryption fails (e.g. wrong key/tampered)
    }
};

// --- Database Operations ---

// MOCK USER ID as per plan
const MOCK_USER_ID = "1";

export const socialAuthService = {

    async getConnectedAccounts(): Promise<SocialAccount[]> {
        // Fetch from Supabase
        const { data, error } = await supabase
            .from('social_accounts')
            .select('id, platform, expires_at, scopes')
            .eq('user_id', MOCK_USER_ID);

        if (error) {
            console.error("Error fetching social accounts:", error);
            // Fallback for demo/offline if DB not ready
            return [];
        }

        // Map to internal type
        return data.map((acc: any) => ({
            id: acc.id,
            platform: acc.platform as SocialPlatform,
            connected: true, // If it exists in DB, we assume it's connected/authorized
            expires_at: acc.expires_at,
            scopes: acc.scopes ? JSON.parse(acc.scopes) : []
        }));
    },

    async disconnectAccount(platform: SocialPlatform): Promise<boolean> {
        const { error } = await supabase
            .from('social_accounts')
            .delete()
            .eq('user_id', MOCK_USER_ID)
            .eq('platform', platform);

        return !error;
    },

    async saveAccountConnection(platform: SocialPlatform, accessToken: string, refreshToken?: string, expiresIn?: number, scopes?: string[]) {
        const encryptedAccess = await encryptToken(accessToken);
        const encryptedRefresh = refreshToken ? await encryptToken(refreshToken) : null;

        const expiresAt = expiresIn
            ? new Date(Date.now() + expiresIn * 1000).toISOString()
            : null;

        // Upsert logic
        // First check if exists to update or insert
        const { data: existing } = await supabase
            .from('social_accounts')
            .select('id')
            .eq('user_id', MOCK_USER_ID)
            .eq('platform', platform)
            .single();

        const payload = {
            user_id: MOCK_USER_ID,
            platform,
            access_token_encrypted: encryptedAccess.encrypted,
            refresh_token_encrypted: encryptedRefresh?.encrypted || null,
            iv: encryptedAccess.iv, // Saving the IV for access token. Ideal to have separate IVs but for MVP reusing logic/simplifying schema
            expires_at: expiresAt,
            scopes: JSON.stringify(scopes || []),
            updated_at: new Date().toISOString()
        };

        let error;
        if (existing) {
            const { error: err } = await supabase
                .from('social_accounts')
                .update(payload)
                .eq('id', existing.id);
            error = err;
        } else {
            const { error: err } = await supabase
                .from('social_accounts')
                .insert({ ...payload, created_at: new Date().toISOString() });
            error = err;
        }

        if (error) throw error;
        return true;
    }
};
