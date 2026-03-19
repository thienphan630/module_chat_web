/**
 * Deterministic color from string hash — same userId always = same color.
 */
export function hashToHSL(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    const hue = Math.abs(hash) % 360
    return `hsl(${hue}, 55%, 45%)`
}

export function hashToGradient(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    const hue1 = Math.abs(hash) % 360
    const hue2 = (hue1 + 40) % 360
    return `linear-gradient(135deg, hsl(${hue1}, 55%, 45%), hsl(${hue2}, 55%, 35%))`
}
