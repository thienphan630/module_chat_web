import { v7 as uuidv7 } from 'uuid'
import type { WorkerRequest, WorkerResponse } from './crypto.types'

// Setup native crypto api
const cryptoSubtle = globalThis.crypto.subtle

// Helper to convert Base64/Hex to Uint8Array
function generateRandomIV(length = 12): Uint8Array {
    const bytes = new Uint8Array(length)
    globalThis.crypto.getRandomValues(bytes)
    return bytes as Uint8Array
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export async function importRawKey(keyBase64: string): Promise<CryptoKey> {
    const binaryString = atob(keyBase64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
    }
    return await cryptoSubtle.importKey(
        'raw',
        bytes,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    )
}

export async function exportRawKey(key: CryptoKey): Promise<string> {
    const exported = await cryptoSubtle.exportKey('raw', key)
    const bytes = new Uint8Array(exported as ArrayBuffer)
    let binaryString = ''
    for (let i = 0; i < bytes.length; i++) {
        binaryString += String.fromCharCode(bytes[i])
    }
    return btoa(binaryString)
}

export async function handleGenerateUUID() {
    return uuidv7()
}

export async function handleEncryptText(plaintext: string, roomKeyStr: string): Promise<string> {
    const key = await importRawKey(roomKeyStr)
    const iv = generateRandomIV()

    const encodedText = encoder.encode(plaintext)

    const encryptedBuffer = await cryptoSubtle.encrypt(
        { name: 'AES-GCM', iv: iv as any },
        key,
        encodedText
    )

    // Combine IV and Encrypted payload
    const encryptedArray = new Uint8Array(encryptedBuffer)
    const payload = new Uint8Array(iv.length + encryptedArray.length)
    payload.set(iv)
    payload.set(encryptedArray, iv.length)

    // Convert payload to Base64
    let binaryString = ''
    for (let i = 0; i < payload.length; i++) {
        binaryString += String.fromCharCode(payload[i])
    }

    return btoa(binaryString)
}

export async function handleDecryptText(ciphertextBase64: string, roomKeyStr: string): Promise<string> {
    const key = await importRawKey(roomKeyStr)

    const binaryString = atob(ciphertextBase64)
    const payload = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
        payload[i] = binaryString.charCodeAt(i)
    }

    const iv = payload.slice(0, 12)
    const encryptedPayload = payload.slice(12)

    const decryptedBuffer = await cryptoSubtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedPayload
    )

    return decoder.decode(decryptedBuffer)
}

async function handleEncryptFile(blob: Blob): Promise<{ encryptedBlob: Blob, fileKey: string }> {
    const arrayBuffer = await blob.arrayBuffer()

    // Generate a random key for the file
    const key = await cryptoSubtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true, // Extractable so we can send it
        ['encrypt', 'decrypt']
    )

    const fileKeyStr = await exportRawKey(key)
    const iv = generateRandomIV()

    const encryptedBuffer = await cryptoSubtle.encrypt(
        { name: 'AES-GCM', iv: iv as any },
        key,
        arrayBuffer
    )

    // Combine IV and Encrypted File Buffer
    const ivBlob = new Blob([iv as any])
    const encBlob = new Blob([encryptedBuffer])
    const finalBlob = new Blob([ivBlob, encBlob], { type: 'application/octet-stream' })

    return { encryptedBlob: finalBlob, fileKey: fileKeyStr }
}

async function handleDecryptFile(encryptedBlob: Blob, fileKeyStr: string): Promise<Blob> {
    const arrayBuffer = await encryptedBlob.arrayBuffer()
    const payload = new Uint8Array(arrayBuffer)

    const key = await importRawKey(fileKeyStr)
    const iv = payload.slice(0, 12)
    const encryptedPayload = payload.slice(12)

    const decryptedBuffer = await cryptoSubtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedPayload
    )

    return new Blob([decryptedBuffer])
}

// Global Message Listener inside Worker
if (typeof self !== 'undefined') {
    self.addEventListener('message', async (e: MessageEvent<WorkerRequest>) => {
        const req = e.data
        const response: WorkerResponse = { id: req.id, action: req.action }

        try {
            switch (req.action) {
                case 'GEN_UUID':
                    response.result = await handleGenerateUUID()
                    break
                case 'ENCRYPT_TEXT':
                    response.result = await handleEncryptText(req.payload, req.roomKey)
                    break
                case 'DECRYPT_TEXT':
                    response.result = await handleDecryptText(req.payload, req.roomKey)
                    break
                case 'ENCRYPT_FILE':
                    response.result = await handleEncryptFile(req.payload)
                    break
                case 'DECRYPT_FILE':
                    response.result = await handleDecryptFile(req.payload.encryptedBlob, req.payload.fileKey)
                    break
                default:
                    throw new Error('Unknown action')
            }
        } catch (err: any) {
            response.error = err?.message || 'Unknown worker error'
        }

        self.postMessage(response)
    })
}
