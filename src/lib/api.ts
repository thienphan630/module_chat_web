export interface RoomMetaData {
    id: string;
    name: string;
    avatarUrl?: string;
    lastMessagePreview?: string;
    updatedAt: number;
}

// Mocked fetch logic since server is not implemented in full
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const api = {
    async getRooms(): Promise<RoomMetaData[]> {
        await sleep(500); // simulate network
        return [
            { id: 'room-1', name: 'General Chat', lastMessagePreview: 'Hello world!', updatedAt: Date.now() },
            { id: 'room-2', name: 'Secret Encrypted Group', lastMessagePreview: '[Ciphertext]', updatedAt: Date.now() - 3600000 },
        ];
    },

    async syncMessages(roomId: string, afterServerTs: number) {
        await sleep(1000); // simulate network delay
        console.log(`[API Mock] Sync requested for room ${roomId} after ${afterServerTs}`);
        return {
            messages: [] // Simulate returning empty or fetched old messages
        };
    },

    async uploadFile(_blob: Blob): Promise<string> {
        await sleep(1500);
        return 'https://mock-s3.url/' + crypto.randomUUID();
    }
}
