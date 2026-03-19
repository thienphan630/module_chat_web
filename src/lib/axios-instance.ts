import axios from 'axios'
import { useChatStore } from '../store/chatStore'
import { api } from './api'

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080',
    headers: { 'Content-Type': 'application/json' },
})

// Request interceptor — auto attach auth token
apiClient.interceptors.request.use((config) => {
    const token = useChatStore.getState().accessToken
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// Response interceptor — auto refresh on 401
apiClient.interceptors.response.use(
    (res) => res,
    async (error) => {
        const originalRequest = error.config

        // Avoid infinite loop: only retry once
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true

            const refreshToken = useChatStore.getState().refreshToken
            if (!refreshToken) {
                useChatStore.getState().clearAuth()
                return Promise.reject(error)
            }

            try {
                const data = await api.refreshToken(refreshToken)
                useChatStore.getState().setTokens(data.access_token, data.refresh_token)

                // Retry original request with new token
                originalRequest.headers.Authorization = `Bearer ${data.access_token}`
                return apiClient(originalRequest)
            } catch {
                useChatStore.getState().clearAuth()
                return Promise.reject(error)
            }
        }

        return Promise.reject(error)
    }
)

export { apiClient }
