import { readFileSync } from 'node:fs';
import { chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
export function autoReviewSettingsFilePath() { return dshHomePath('plugins', 'auto-review', 'auto-review.json'); }
async function persist(reviewer, path) {
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
    try {
        await writeFile(tmp, JSON.stringify({ reviewer }, null, 2), { mode: 0o600 });
        await chmod(tmp, 0o600);
        await rename(tmp, path);
    }
    catch (error) {
        await rm(tmp, { force: true });
        throw error;
    }
}
export class AutoReviewDefaultStore {
    configured;
    warn;
    path;
    current;
    writes = Promise.resolve();
    constructor(fallback, configured, warn, path = autoReviewSettingsFilePath()) {
        this.configured = configured;
        this.warn = warn;
        this.path = path;
        this.current = this.isConfigured(fallback) ? fallback : 'none';
        if (this.current !== fallback)
            this.warn('configured Auto-Review default is unknown; using manual approvals');
        try {
            const raw = JSON.parse(readFileSync(path, 'utf8'));
            if (typeof raw.reviewer === 'string' && this.isConfigured(raw.reviewer))
                this.current = raw.reviewer;
            else
                this.warn('stored Auto-Review default is unknown; using configured default');
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                this.warn('cannot read Auto-Review settings; using configured default');
        }
    }
    currentValue() { return this.current; }
    async get() { return this.current; }
    set(reviewer) {
        if (!this.isConfigured(reviewer))
            return Promise.reject(new Error(`unknown automatic reviewer: ${reviewer}`));
        const run = this.writes.then(async () => { await persist(reviewer, this.path); this.current = reviewer; });
        this.writes = run.catch(() => undefined);
        return run;
    }
    isConfigured(reviewer) {
        return reviewer === 'none' || this.configured(reviewer);
    }
}
