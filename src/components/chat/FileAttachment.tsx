import { useState, useEffect } from 'react'
import { CryptoClient } from '../../workers/cryptoClient'
import { File as FileIcon, Download, Loader2 } from 'lucide-react'
import type { MessageAttachment } from '../../types/chat.types'

interface FileAttachmentProps {
    attachment: MessageAttachment
    roomKeyBase64: string
}

export const FileAttachment = ({ attachment, roomKeyBase64 }: FileAttachmentProps) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')

    const isImage = attachment.file_type.startsWith('image/')
    const sizeLabel = attachment.file_size < 1024 * 1024
        ? `${(attachment.file_size / 1024).toFixed(1)} KB`
        : `${(attachment.file_size / (1024 * 1024)).toFixed(1)} MB`

    useEffect(() => {
        let revoked = false
        const decrypt = async () => {
            try {
                setIsLoading(true)

                // 1. Decrypt file key using room key
                const fileKey = await CryptoClient.decryptText(
                    attachment.file_key_encrypted,
                    roomKeyBase64
                )

                // 2. Fetch encrypted blob from file_path
                const response = await fetch(attachment.file_path)
                const encryptedBlob = await response.blob()

                // 3. Decrypt the file blob
                const decryptedBlob = await CryptoClient.decryptFile(encryptedBlob, fileKey)

                if (!revoked) {
                    const url = URL.createObjectURL(decryptedBlob)
                    setBlobUrl(url)
                }
            } catch (err) {
                console.error('[FileAttachment] Decrypt failed:', err)
                if (!revoked) setError('Lỗi giải mã tệp')
            } finally {
                if (!revoked) setIsLoading(false)
            }
        }

        decrypt()
        return () => {
            revoked = true
            if (blobUrl) URL.revokeObjectURL(blobUrl)
        }
    }, [attachment.file_path, attachment.file_key_encrypted, roomKeyBase64])

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 p-3 bg-zinc-900/50 rounded-xl mt-1">
                <Loader2 size={16} className="animate-spin text-zinc-400" />
                <span className="text-xs text-zinc-500">Đang giải mã {attachment.file_name}...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-xl mt-1 text-xs text-red-400">
                <FileIcon size={14} /> {error}
            </div>
        )
    }

    // Image preview
    if (isImage && blobUrl) {
        return (
            <div className="mt-1 rounded-xl overflow-hidden max-w-[300px]">
                <img
                    src={blobUrl}
                    alt={attachment.file_name}
                    className="w-full h-auto rounded-xl"
                    loading="lazy"
                />
                <div className="flex items-center justify-between px-2 py-1 text-xs text-zinc-500">
                    <span className="truncate">{attachment.file_name}</span>
                    <span>{sizeLabel}</span>
                </div>
            </div>
        )
    }

    // Generic file download link
    return (
        <a
            href={blobUrl || '#'}
            download={attachment.file_name}
            className="flex items-center gap-3 p-3 bg-zinc-900/50 hover:bg-zinc-800/50 rounded-xl mt-1 transition-colors group"
        >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <FileIcon size={18} className="text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 truncate">{attachment.file_name}</p>
                <p className="text-xs text-zinc-500">{sizeLabel} • {attachment.file_type}</p>
            </div>
            <Download size={16} className="text-zinc-500 group-hover:text-emerald-400 transition-colors shrink-0" />
        </a>
    )
}
