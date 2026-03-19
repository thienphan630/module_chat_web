export type CryptoAction =
    | 'GEN_UUID'
    | 'ENCRYPT_TEXT'
    | 'DECRYPT_TEXT'
    | 'ENCRYPT_FILE'
    | 'DECRYPT_FILE'
    | 'GEN_KEYS'
    | 'WRAP_ROOM_KEY'
    | 'UNWRAP_ROOM_KEY';

export interface BaseWorkerRequest {
    id: string; // tracking task
    action: CryptoAction;
}

export interface GenUUIDRequest extends BaseWorkerRequest {
    action: 'GEN_UUID';
}

export interface EncryptTextRequest extends BaseWorkerRequest {
    action: 'ENCRYPT_TEXT';
    payload: string; // Plaintext
    roomKey: string; // Base64 encoded or hex encoded symmetric key
}

export interface DecryptTextRequest extends BaseWorkerRequest {
    action: 'DECRYPT_TEXT';
    payload: string; // Ciphertext
    roomKey: string;
}

export interface EncryptFileRequest extends BaseWorkerRequest {
    action: 'ENCRYPT_FILE';
    payload: Blob; // File blob
}

export interface DecryptFileRequest extends BaseWorkerRequest {
    action: 'DECRYPT_FILE';
    payload: {
        encryptedBlob: Blob;
        fileKey: string;
    };
}

export interface GenKeysRequest extends BaseWorkerRequest {
    action: 'GEN_KEYS';
}

export interface WrapRoomKeyRequest extends BaseWorkerRequest {
    action: 'WRAP_ROOM_KEY';
    payload: {
        roomKey: string;          // Base64 AES-256 room key to wrap
        theirSignedPreKeyPub: string; // Base64 X25519 public key of recipient
        ourSignedPreKeyPriv: string;  // Base64 X25519 private key of sender
    };
}

export interface UnwrapRoomKeyRequest extends BaseWorkerRequest {
    action: 'UNWRAP_ROOM_KEY';
    payload: {
        wrappedKey: string;        // Base64 AES-GCM ciphertext
        theirSignedPreKeyPub: string; // Base64 X25519 public key of sender
        ourSignedPreKeyPriv: string;  // Base64 X25519 private key of recipient
    };
}

export type WorkerRequest =
    | GenUUIDRequest
    | EncryptTextRequest
    | DecryptTextRequest
    | EncryptFileRequest
    | DecryptFileRequest
    | GenKeysRequest
    | WrapRoomKeyRequest
    | UnwrapRoomKeyRequest;

export interface WorkerResponse {
    id: string;
    action: CryptoAction;
    result?: any;
    error?: string;
}
