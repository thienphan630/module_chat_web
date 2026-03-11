export type CryptoAction =
    | 'GEN_UUID'
    | 'ENCRYPT_TEXT'
    | 'DECRYPT_TEXT'
    | 'ENCRYPT_FILE'
    | 'DECRYPT_FILE';

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

export type WorkerRequest =
    | GenUUIDRequest
    | EncryptTextRequest
    | DecryptTextRequest
    | EncryptFileRequest
    | DecryptFileRequest;

export interface WorkerResponse {
    id: string;
    action: CryptoAction;
    result?: any;
    error?: string;
}
