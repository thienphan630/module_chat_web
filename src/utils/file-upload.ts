/**
 * E2EE File Upload Service
 *
 * Flow:
 *   1. CryptoClient.encryptFile(blob) → { encryptedBlob, fileKey }
 *   2. Upload encryptedBlob (mock for demo — BE presigned URL not available)
 *   3. CryptoClient.encryptText(fileKey, roomKey) → encryptedFileKey
 *   4. Return MessageAttachment metadata
 */

import { CryptoClient } from '../workers/cryptoClient'
import type { MessageAttachment } from '../types/chat.types'

/**
 * Encrypt a file and prepare attachment metadata.
 * Since the presigned URL endpoint is NOT implemented yet,
 * we store the encrypted blob as a local object URL for demo.
 */
export async function encryptAndUpload(
    file: File,
    roomKeyBase64: string,
    _roomId: string,
): Promise<MessageAttachment> {
    // 1. Encrypt the file blob → { encryptedBlob, fileKey }
    const { encryptedBlob, fileKey } = await CryptoClient.encryptFile(file)

    // 2. Upload encrypted blob
    // TODO: When BE adds presigned URL endpoint, replace this with real upload:
    //   const { upload_url, file_path } = await api.getPresignedUrl(roomId, file.name, file.type)
    //   await fetch(upload_url, { method: 'PUT', body: encryptedBlob })
    //   file_path = the returned cloud URL
    //
    // For now: create local object URL as demo placeholder
    const filePath = URL.createObjectURL(encryptedBlob)

    // 3. Encrypt the file key with room key (so it can be safely transmitted in message)
    const encryptedFileKey = await CryptoClient.encryptText(fileKey, roomKeyBase64)

    return {
        file_path: filePath,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_key_encrypted: encryptedFileKey,
    }
}
