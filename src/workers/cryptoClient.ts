import CryptoWorker from './crypto.worker?worker'
import { v4 as uuidv4 } from 'uuid'
import type { UploadKeysPayload } from '../types/chat.types'
import type {
    WorkerRequest,
    WorkerResponse,
    CryptoAction
} from './crypto.types'

// Singleton worker instance
const worker = new CryptoWorker()
const callbacks = new Map<string, { resolve: (res: any) => void, reject: (err: any) => void }>()

worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const { id, result, error } = e.data
    const cb = callbacks.get(id)
    if (cb) {
        if (error) {
            cb.reject(new Error(error))
        } else {
            cb.resolve(result)
        }
        callbacks.delete(id)
    }
}

function dispatch<T>(action: CryptoAction, payload?: any, key?: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const id = uuidv4() // Use typical v4 for tracking job ids internally
        callbacks.set(id, { resolve, reject })

        // Construct the correct request type
        const req: Record<string, any> = { id, action }
        if (payload !== undefined) req.payload = payload
        if (key !== undefined) req.roomKey = key

        worker.postMessage(req as WorkerRequest)
    })
}

export const CryptoClient = {
    genUUID: () => dispatch<string>('GEN_UUID'),

    genKeys: () => dispatch<{ uploadPayload: UploadKeysPayload, privateData: any }>('GEN_KEYS'),

    encryptText: (plaintext: string, roomKey: string) =>
        dispatch<string>('ENCRYPT_TEXT', plaintext, roomKey),

    decryptText: (ciphertextBase64: string, roomKey: string) =>
        dispatch<string>('DECRYPT_TEXT', ciphertextBase64, roomKey),

    encryptFile: (blob: Blob) =>
        dispatch<{ encryptedBlob: Blob, fileKey: string }>('ENCRYPT_FILE', blob),

    decryptFile: (encryptedBlob: Blob, fileKeyStr: string) =>
        dispatch<Blob>('DECRYPT_FILE', { encryptedBlob, fileKey: fileKeyStr }),
}
