import { describe, it, expect, beforeAll } from 'vitest'
import {
    handleGenerateUUID,
    handleEncryptText,
    handleDecryptText,
    exportRawKey
} from './crypto.worker'

describe('Crypto Worker Logic', () => {
    let mainRoomKeyBase64: string

    beforeAll(async () => {
        // We need a proper base64 key generated using AES-GCM
        const key = await globalThis.crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        )
        mainRoomKeyBase64 = await exportRawKey(key)
    })

    it('generates a valid UUIDv7', async () => {
        const uuid = await handleGenerateUUID()
        expect(uuid).toBeDefined()
        expect(typeof uuid).toBe('string')
        // UUID format check
        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('can encrypt and decrypt text message via shared room key', async () => {
        const originalText = "Hello from E2EE Secret Room!"

        // Encrypt
        const ciphertext = await handleEncryptText(originalText, mainRoomKeyBase64)
        expect(ciphertext).toBeDefined()
        expect(ciphertext).not.toBe(originalText)

        // Decrypt
        const decryptedText = await handleDecryptText(ciphertext, mainRoomKeyBase64)
        expect(decryptedText).toBe(originalText)
    })

    it('throws decrypting with wrong key', async () => {
        const originalText = "Are you a hacker?"
        const ciphertext = await handleEncryptText(originalText, mainRoomKeyBase64)

        // Generate an alternative key
        const fakeKey = await globalThis.crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        )
        const fakeRoomKeyBase64 = await exportRawKey(fakeKey)

        // Try decrypt with fake key
        await expect(handleDecryptText(ciphertext, fakeRoomKeyBase64)).rejects.toThrow()
    })
})
