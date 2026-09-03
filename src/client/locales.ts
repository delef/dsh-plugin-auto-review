/** English and Chinese copy owned by the `settings.autoReview` namespace. */
export const en = {
  nav: 'Auto Review',
  autoReview: 'Auto Review',
  autoReviewNone: 'Manual approval',
  autoReviewNoneDescription: 'Use DSH manual approvals',
  autoReviewProviderDescription: 'Review approval requests automatically',
  default: 'Default reviewer',
  defaultTitle: 'Automatic approval review',
  defaultHint: 'The composer can override this choice for one session; delegated subagents inherit it.',
  autoReviewDefaultTitle: 'Default Auto Review',
  autoReviewDefaultHint: 'The composer can override this choice for one session; delegated subagents inherit it.',
  autoReviewDefaultLoading: 'Loading Auto Review settings…',
  autoReviewDefaultSaving: 'Saving…',
  autoReviewDefaultLoadFailed: 'Failed to load Auto Review settings: {message}',
  autoReviewDefaultSaveFailed: 'Failed to save Auto Review settings: {message}',
  none: 'Manual approval',
  noneDescription: 'Use DSH manual approvals',
  reviewerDescription: 'Review approval requests automatically',
  unavailable: 'unavailable',
  loading: 'Loading Auto Review settings…',
  saving: 'Saving…',
} as const

export const zh = {
  nav: '自动审查',
  autoReview: '自动审查',
  autoReviewNone: '手动审批',
  autoReviewNoneDescription: '使用 DSH 手动审批',
  autoReviewProviderDescription: '自动审查审批请求',
  default: '默认审查器',
  defaultTitle: '自动审批审查',
  defaultHint: '输入区可按会话覆盖；委派子代理继承此选择。',
  autoReviewDefaultTitle: '默认自动审查',
  autoReviewDefaultHint: '可在输入区按会话覆盖；委派子代理继承此选择。',
  autoReviewDefaultLoading: '正在加载自动审查设置…',
  autoReviewDefaultSaving: '正在保存…',
  autoReviewDefaultLoadFailed: '自动审查设置加载失败：{message}',
  autoReviewDefaultSaveFailed: '自动审查设置保存失败：{message}',
  none: '手动审批',
  noneDescription: '使用 DSH 手动审批',
  reviewerDescription: '自动审查审批请求',
  unavailable: '不可用',
  loading: '正在加载自动审查设置…',
  saving: '正在保存…',
} as const

export type AutoReviewKey = keyof typeof en

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.autoReview': AutoReviewKey
  }
}
