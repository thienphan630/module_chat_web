/**
 * Browser Notification API utility.
 * Requests permission and dispatches OS-level notifications
 * when the app tab is not focused.
 */

export function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
    }
}

export function showBrowserNotification(title: string, body: string, _roomId?: string) {
    if (
        'Notification' in window &&
        Notification.permission === 'granted' &&
        document.hidden
    ) {
        const n = new Notification(title, {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
        })
        n.onclick = () => {
            window.focus()
            n.close()
        }
    }
}
