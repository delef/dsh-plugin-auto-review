export type StoredAutoReviewMode = 'none' | string;
export declare function autoReviewSettingsFilePath(): string;
export declare class AutoReviewDefaultStore {
    private readonly configured;
    private readonly warn;
    private readonly path;
    private current;
    private writes;
    constructor(fallback: StoredAutoReviewMode, configured: (id: string) => boolean, warn: (message: string) => void, path?: string);
    currentValue(): StoredAutoReviewMode;
    get(): Promise<StoredAutoReviewMode>;
    set(reviewer: StoredAutoReviewMode): Promise<void>;
    private isConfigured;
}
