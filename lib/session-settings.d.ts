export declare function inheritedSessionSetting<T>(values: ReadonlyMap<string, T>, sessionId: string, parentOf: (id: string) => string | undefined): T | undefined;
