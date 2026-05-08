function nowMs() {
    return Date.now();
}

class TtlCache {
    constructor({ defaultTtlMs } = {}) {
        this.defaultTtlMs = Number(defaultTtlMs || 0);
        this.map = new Map();
    }

    get(key) {
        const entry = this.map.get(key);
        if (!entry) return undefined;

        const now = nowMs();
        if (entry.expiresAt <= now) {
            this.map.delete(key);
            return undefined;
        }

        return entry.value;
    }

    set(key, value, ttlMs) {
        const ttl = Number.isFinite(ttlMs) ? ttlMs : this.defaultTtlMs;
        const expiresAt = nowMs() + Math.max(0, ttl || 0);
        this.map.set(key, { value, expiresAt });
        return value;
    }

    delete(key) {
        this.map.delete(key);
    }

    clear() {
        this.map.clear();
    }

    async getOrSet(key, fn, ttlMs) {
        const cached = this.get(key);
        if (cached !== undefined) return cached;

        const value = await fn();
        this.set(key, value, ttlMs);
        return value;
    }
}

module.exports = {
    TtlCache
};
