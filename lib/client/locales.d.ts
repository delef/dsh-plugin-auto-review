/** English and Chinese copy owned by the `settings.autoReview` namespace. */
export declare const en: {
    readonly nav: "Auto Review";
    readonly autoReview: "Auto Review";
    readonly autoReviewNone: "Manual approval";
    readonly autoReviewNoneDescription: "Use DSH manual approvals";
    readonly autoReviewProviderDescription: "Review approval requests automatically";
    readonly default: "Default reviewer";
    readonly defaultTitle: "Automatic approval review";
    readonly defaultHint: "The composer can override this choice for one session; delegated subagents inherit it.";
    readonly autoReviewDefaultTitle: "Default Auto Review";
    readonly autoReviewDefaultHint: "The composer can override this choice for one session; delegated subagents inherit it.";
    readonly autoReviewDefaultLoading: "Loading Auto Review settings…";
    readonly autoReviewDefaultSaving: "Saving…";
    readonly autoReviewDefaultLoadFailed: "Failed to load Auto Review settings: {message}";
    readonly autoReviewDefaultSaveFailed: "Failed to save Auto Review settings: {message}";
    readonly none: "Manual approval";
    readonly noneDescription: "Use DSH manual approvals";
    readonly reviewerDescription: "Review approval requests automatically";
    readonly unavailable: "unavailable";
    readonly loading: "Loading Auto Review settings…";
    readonly saving: "Saving…";
};
export declare const zh: {
    readonly nav: "自动审查";
    readonly autoReview: "自动审查";
    readonly autoReviewNone: "手动审批";
    readonly autoReviewNoneDescription: "使用 DSH 手动审批";
    readonly autoReviewProviderDescription: "自动审查审批请求";
    readonly default: "默认审查器";
    readonly defaultTitle: "自动审批审查";
    readonly defaultHint: "输入区可按会话覆盖；委派子代理继承此选择。";
    readonly autoReviewDefaultTitle: "默认自动审查";
    readonly autoReviewDefaultHint: "可在输入区按会话覆盖；委派子代理继承此选择。";
    readonly autoReviewDefaultLoading: "正在加载自动审查设置…";
    readonly autoReviewDefaultSaving: "正在保存…";
    readonly autoReviewDefaultLoadFailed: "自动审查设置加载失败：{message}";
    readonly autoReviewDefaultSaveFailed: "自动审查设置保存失败：{message}";
    readonly none: "手动审批";
    readonly noneDescription: "使用 DSH 手动审批";
    readonly reviewerDescription: "自动审查审批请求";
    readonly unavailable: "不可用";
    readonly loading: "正在加载自动审查设置…";
    readonly saving: "正在保存…";
};
export type AutoReviewKey = keyof typeof en;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'settings.autoReview': AutoReviewKey;
    }
}
