window.__ModuleLoader__.load({ id: "dsh-plugin-auto-review", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
let react = require("react");
react = __toESM(react);
let react_jsx_runtime = require("react/jsx-runtime");
react_jsx_runtime = __toESM(react_jsx_runtime);

//#region src/client/locales.ts
/** English and Chinese copy owned by the `settings.autoReview` namespace. */
const en = {
	nav: "Auto Review",
	autoReview: "Auto Review",
	autoReviewNone: "Manual approval",
	autoReviewNoneDescription: "Use DSH manual approvals",
	autoReviewProviderDescription: "Review approval requests automatically",
	default: "Default reviewer",
	defaultTitle: "Automatic approval review",
	defaultHint: "The composer can override this choice for one session; delegated subagents inherit it.",
	autoReviewDefaultTitle: "Default Auto Review",
	autoReviewDefaultHint: "The composer can override this choice for one session; delegated subagents inherit it.",
	autoReviewDefaultLoading: "Loading Auto Review settings…",
	autoReviewDefaultSaving: "Saving…",
	autoReviewDefaultLoadFailed: "Failed to load Auto Review settings: {message}",
	autoReviewDefaultSaveFailed: "Failed to save Auto Review settings: {message}",
	none: "Manual approval",
	noneDescription: "Use DSH manual approvals",
	reviewerDescription: "Review approval requests automatically",
	unavailable: "unavailable",
	loading: "Loading Auto Review settings…",
	saving: "Saving…"
};
const zh = {
	nav: "自动审查",
	autoReview: "自动审查",
	autoReviewNone: "手动审批",
	autoReviewNoneDescription: "使用 DSH 手动审批",
	autoReviewProviderDescription: "自动审查审批请求",
	default: "默认审查器",
	defaultTitle: "自动审批审查",
	defaultHint: "输入区可按会话覆盖；委派子代理继承此选择。",
	autoReviewDefaultTitle: "默认自动审查",
	autoReviewDefaultHint: "可在输入区按会话覆盖；委派子代理继承此选择。",
	autoReviewDefaultLoading: "正在加载自动审查设置…",
	autoReviewDefaultSaving: "正在保存…",
	autoReviewDefaultLoadFailed: "自动审查设置加载失败：{message}",
	autoReviewDefaultSaveFailed: "自动审查设置保存失败：{message}",
	none: "手动审批",
	noneDescription: "使用 DSH 手动审批",
	reviewerDescription: "自动审查审批请求",
	unavailable: "不可用",
	loading: "正在加载自动审查设置…",
	saving: "正在保存…"
};

//#endregion
//#region src/client/rpc.ts
/** Error raised for either a transport failure or a rejected endpoint result. */
var AutoReviewRpcError = class extends Error {
	constructor(message, code = "internal") {
		super(message);
		this.code = code;
		this.name = "AutoReviewRpcError";
	}
};
/** Call one `/auto-review` endpoint and unwrap its current RpcResult value. */
async function callAutoReview(rpc, endpoint, payload) {
	let result;
	try {
		result = await rpc.call("/auto-review", endpoint, payload);
	} catch (error) {
		throw new AutoReviewRpcError(error instanceof Error ? error.message : String(error));
	}
	if (!result.ok) throw new AutoReviewRpcError(result.error.message, result.error.code);
	return result.value;
}

//#endregion
//#region src/client/AutoReviewSelect.tsx
/** Bind the per-session read endpoint to one Connection RPC face. */
function createAutoReviewLoader(rpc, sessionId) {
	return () => callAutoReview(rpc, "autoReview", { sessionId });
}
/** Bind the per-session write endpoint and reduce business errors to `false`. */
function createAutoReviewSetter(rpc, sessionId) {
	return (reviewer) => callAutoReview(rpc, "setAutoReview", {
		sessionId,
		reviewer
	}).then(() => true, () => false);
}
function fallbackTranslate$1(key) {
	return en[key];
}
/** Render a compact menu beside other composer controls. */
function AutoReviewSelect({ loadAutoReview, setAutoReview, t }) {
	const translate = t ?? fallbackTranslate$1;
	const [state, setState] = (0, react.useState)(null);
	const [open, setOpen] = (0, react.useState)(false);
	const [busy, setBusy] = (0, react.useState)(false);
	const rootRef = (0, react.useRef)(null);
	const loadRef = (0, react.useRef)(loadAutoReview);
	loadRef.current = loadAutoReview;
	(0, react.useEffect)(() => {
		const load = loadRef.current;
		if (load === void 0) return;
		let cancelled = false;
		load().then((value) => {
			if (!cancelled) setState(value);
		}, () => {});
		return () => {
			cancelled = true;
		};
	}, []);
	(0, react.useEffect)(() => {
		if (!open) return;
		const closeOutside = (event) => {
			if (!rootRef.current?.contains(event.target)) setOpen(false);
		};
		document.addEventListener("mousedown", closeOutside);
		return () => {
			document.removeEventListener("mousedown", closeOutside);
		};
	}, [open]);
	if (loadAutoReview === void 0 || setAutoReview === void 0 || state === null) return null;
	const liveReviewers = state.reviewers;
	const selected = state.reviewer;
	const selectedIsStale = selected !== "none" && !liveReviewers.some((option) => option.reviewer === selected);
	const staleOption = selectedIsStale ? {
		reviewer: selected,
		label: `${selected} (${translate("unavailable")})`
	} : void 0;
	const choices = [
		{
			reviewer: "none",
			label: translate("none")
		},
		...staleOption === void 0 ? [] : [staleOption],
		...liveReviewers
	];
	const selectedLabel = choices.find((option) => option.reviewer === selected)?.label ?? selected;
	const triggerLabel = `${translate("autoReview")} · ${selectedLabel}`;
	const choose = (reviewer) => {
		if (busy) return;
		if (reviewer === state.reviewer) {
			setOpen(false);
			return;
		}
		setBusy(true);
		setAutoReview(reviewer).then((ok) => {
			setBusy(false);
			if (ok) {
				setState((current) => current === null ? current : {
					...current,
					reviewer
				});
				setOpen(false);
			}
		}, () => {
			setBusy(false);
		});
	};
	const show = () => {
		setOpen(true);
		const load = loadRef.current;
		if (load !== void 0) load().then(setState, () => {});
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		ref: rootRef,
		"data-plugin": "dsh-plugin-auto-review",
		style: styles$1.root,
		onKeyDown: (event) => {
			if (event.key === "Escape" && open) {
				event.preventDefault();
				setOpen(false);
			}
		},
		children: [open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			style: styles$1.menu,
			role: "menu",
			"aria-label": translate("autoReview"),
			children: choices.map((option) => {
				const stale = option.reviewer === selected && selectedIsStale;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					role: "menuitemradio",
					"aria-checked": option.reviewer === selected,
					"aria-disabled": stale,
					style: styles$1.item,
					disabled: busy || stale,
					onClick: () => {
						choose(option.reviewer);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: styles$1.itemCheck,
						children: option.reviewer === selected ? "✓" : ""
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: styles$1.itemText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: styles$1.itemName,
							children: option.label
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: styles$1.itemDescription,
							children: option.reviewer === "none" ? translate("noneDescription") : translate("reviewerDescription")
						})]
					})]
				}, option.reviewer);
			})
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
			type: "button",
			style: styles$1.trigger,
			"aria-haspopup": "menu",
			"aria-expanded": open,
			"aria-label": triggerLabel,
			title: triggerLabel,
			disabled: busy,
			onClick: () => {
				if (open) setOpen(false);
				else show();
			},
			children: triggerLabel
		})]
	});
}
const styles$1 = {
	root: {
		position: "relative",
		display: "inline-flex"
	},
	trigger: {
		border: "1px solid var(--dsw-alias-border-l2)",
		borderRadius: 8,
		background: "transparent",
		color: "var(--dsw-alias-label-secondary)",
		font: "inherit",
		fontSize: 12,
		lineHeight: "18px",
		padding: "2px 8px",
		cursor: "pointer",
		whiteSpace: "nowrap"
	},
	menu: {
		position: "absolute",
		bottom: "100%",
		right: 0,
		marginBottom: 4,
		minWidth: 220,
		padding: 4,
		zIndex: 20,
		background: "var(--dsw-alias-bg-layer-1)",
		border: "1px solid var(--dsw-alias-border-l2)",
		borderRadius: 8,
		display: "flex",
		flexDirection: "column",
		gap: 2
	},
	item: {
		display: "flex",
		alignItems: "flex-start",
		gap: 6,
		width: "100%",
		border: "none",
		borderRadius: 6,
		background: "transparent",
		padding: "6px 8px",
		cursor: "pointer",
		font: "inherit",
		textAlign: "left"
	},
	itemCheck: {
		width: 14,
		flexShrink: 0,
		fontSize: 12,
		lineHeight: "18px",
		color: "var(--dsw-alias-label-primary)"
	},
	itemText: {
		display: "flex",
		flexDirection: "column"
	},
	itemName: {
		fontSize: 12,
		lineHeight: "18px",
		color: "var(--dsw-alias-label-primary)"
	},
	itemDescription: {
		fontSize: 11,
		lineHeight: "16px",
		color: "var(--dsw-alias-label-tertiary)"
	}
};

//#endregion
//#region src/client/AutoReviewSection.tsx
/** Bind the Settings read endpoint to one Connection RPC face. */
function createAutoReviewDefaultLoader(rpc) {
	return () => callAutoReview(rpc, "autoReviewDefault", {});
}
/** Bind the Settings write endpoint to one Connection RPC face. */
function createAutoReviewDefaultSetter(rpc) {
	return (reviewer) => callAutoReview(rpc, "setAutoReviewDefault", { reviewer });
}
function fallbackTranslate(key) {
	return en[key];
}
/** Settings section intentionally stays compact so the page remains scannable. */
function AutoReviewSection({ loadAutoReviewDefault, setAutoReviewDefault, t }) {
	const translate = t ?? fallbackTranslate;
	const [state, setState] = (0, react.useState)(null);
	const [error, setError] = (0, react.useState)(null);
	const [saving, setSaving] = (0, react.useState)(false);
	(0, react.useEffect)(() => {
		if (loadAutoReviewDefault === void 0) return;
		let cancelled = false;
		loadAutoReviewDefault().then((value) => {
			if (!cancelled) setState(value);
		}, (reason) => {
			if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
		});
		return () => {
			cancelled = true;
		};
	}, [loadAutoReviewDefault]);
	if (loadAutoReviewDefault === void 0 || setAutoReviewDefault === void 0) return null;
	if (state === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
		"data-plugin": "dsh-plugin-auto-review",
		children: error ?? translate("loading")
	});
	const liveReviewers = state.reviewers;
	const stale = state.reviewer !== "none" && !liveReviewers.some((option) => option.reviewer === state.reviewer);
	const options = [
		{
			reviewer: "none",
			label: translate("none")
		},
		...stale ? [{
			reviewer: state.reviewer,
			label: `${state.reviewer} (${translate("unavailable")})`
		}] : [],
		...liveReviewers
	];
	const choose = (reviewer) => {
		if (saving || reviewer === state.reviewer || reviewer === (stale ? state.reviewer : "")) return;
		setSaving(true);
		setError(null);
		setAutoReviewDefault(reviewer).then((value) => {
			setState(value);
			setSaving(false);
		}, (reason) => {
			setError(reason instanceof Error ? reason.message : String(reason));
			setSaving(false);
		});
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
		"data-plugin": "dsh-plugin-auto-review",
		style: styles.section,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
				style: styles.title,
				children: translate("defaultTitle")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				style: styles.hint,
				children: translate("defaultHint")
			}),
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				style: styles.label,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: translate("default") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
					"aria-label": translate("default"),
					value: state.reviewer,
					disabled: saving,
					onChange: (event) => {
						choose(event.target.value);
					},
					style: styles.select,
					children: options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
						value: option.reviewer,
						disabled: option.reviewer === state.reviewer && stale,
						children: option.label
					}, option.reviewer))
				})]
			}),
			saving && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				style: styles.status,
				children: translate("saving")
			}),
			error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				style: styles.error,
				children: error
			})
		]
	});
}
const styles = {
	section: {
		display: "flex",
		flexDirection: "column",
		gap: 8,
		maxWidth: 560,
		color: "var(--dsw-alias-label-primary)"
	},
	title: {
		margin: 0,
		fontSize: 16,
		lineHeight: "24px",
		fontWeight: 600
	},
	hint: {
		margin: 0,
		color: "var(--dsw-alias-label-tertiary)",
		fontSize: 13,
		lineHeight: "20px"
	},
	label: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
		fontSize: 14,
		lineHeight: "22px"
	},
	select: {
		minWidth: 180,
		height: 32,
		border: "1px solid var(--dsw-alias-border-l2)",
		borderRadius: 8,
		padding: "0 8px",
		background: "var(--dsw-alias-bg-layer-1)",
		color: "var(--dsw-alias-label-primary)",
		font: "inherit"
	},
	status: {
		margin: 0,
		color: "var(--dsw-alias-label-tertiary)",
		fontSize: 12,
		lineHeight: "18px"
	},
	error: {
		margin: 0,
		color: "var(--dsw-alias-state-error-primary)",
		fontSize: 12,
		lineHeight: "18px"
	}
};

//#endregion
//#region src/client/AutoReviewActivity.tsx
const REVIEW_TOOL_PREFIX = "auto-review/";
const REVIEW_ID_PREFIX = "auto-review-";
/** Stable user-facing status text for live and replayed Chat cards. */
function formatAutoReviewActivity(provider, outcome) {
	return `Auto Review · ${provider} · ${outcome === void 0 ? "Reviewing..." : outcome === "allowed-once" ? "Allowed" : outcome === "rejected" ? "Denied" : outcome === "unavailable" ? "Unavailable" : outcome === "cancelled" ? "Cancelled" : "Completed"}`;
}
/** Fold `auto-review/<id>` asked/decided events into one visible Chat node. */
const autoReviewActivityDefinition = {
	kind: "auto-review",
	target: "chat",
	match(event) {
		if (event.type === "approval/asked" && event.data.toolName.startsWith(REVIEW_TOOL_PREFIX)) return {
			id: String(event.data.id),
			role: "start"
		};
		if (event.type === "approval/decided" && String(event.data.id).startsWith(REVIEW_ID_PREFIX)) return {
			id: String(event.data.id),
			role: "update"
		};
		return null;
	},
	start(_context, match) {
		if (match.event.type !== "approval/asked" || match.event.data.callId === void 0) throw new Error("auto-review activity start requires an approval/asked event with a call id");
		const reviewerId = match.event.data.toolName.slice(12);
		return {
			provider: match.event.data.reason ?? reviewerId,
			callId: String(match.event.data.callId),
			seq: match.event.seq
		};
	},
	update(context, match) {
		if (match.event.type !== "approval/decided") return context.state;
		return {
			...context.state,
			outcome: match.event.data.outcome
		};
	},
	buildViewNode(context) {
		if (context.state === void 0) return null;
		const data = {
			provider: context.state.provider,
			callId: context.state.callId,
			...context.state.outcome === void 0 ? {} : { outcome: context.state.outcome }
		};
		return {
			key: context.key,
			kind: "auto-review",
			id: context.id,
			target: "chat",
			anchorSeq: context.state.seq,
			location: context.start?.location ?? { kind: "unresolved" },
			visibility: "visible",
			data
		};
	}
};
/** Compact status row that stays outside the model-visible transcript. */
function AutoReviewActivity({ node }) {
	const outcome = node.data.outcome;
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "dsh-plugin-auto-review-activity",
		"data-plugin": "dsh-plugin-auto-review",
		"data-outcome": outcome ?? "reviewing",
		role: "status",
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			className: "dsh-plugin-auto-review-activity-dot",
			"aria-hidden": "true"
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: formatAutoReviewActivity(node.data.provider, outcome) })]
	});
}
/** Register the definition against whichever Conversation event service exists. */
function registerAutoReviewActivity(ctx) {
	let registered = false;
	const register = (registry) => {
		if (registered) return;
		registered = true;
		registry.register(autoReviewActivityDefinition);
	};
	ctx.inject(["conversationEvents"], (scope) => {
		register(scope.conversationEvents);
	});
	ctx.inject(["uiConversation"], (scope) => {
		register(scope.uiConversation.events);
	});
	ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
		name: "conversation.chat.node",
		key: "auto-review"
	}, AutoReviewActivity));
	ctx.effect(() => {
		if (typeof document === "undefined") return () => void 0;
		const style = document.createElement("style");
		style.setAttribute("data-plugin", "dsh-plugin-auto-review");
		style.textContent = `
      .dsh-plugin-auto-review-activity {
        color: var(--dsw-alias-label-tertiary);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 0;
        font-size: 13px;
        line-height: 20px;
      }
      .dsh-plugin-auto-review-activity-dot {
        width: 7px;
        height: 7px;
        flex: none;
        border-radius: 999px;
        background: var(--dsw-alias-state-business-primary);
      }
      .dsh-plugin-auto-review-activity[data-outcome="allowed-once"] .dsh-plugin-auto-review-activity-dot { background: #28a745; }
      .dsh-plugin-auto-review-activity[data-outcome="rejected"] .dsh-plugin-auto-review-activity-dot { background: #dc3545; }
      .dsh-plugin-auto-review-activity[data-outcome="unavailable"] .dsh-plugin-auto-review-activity-dot,
      .dsh-plugin-auto-review-activity[data-outcome="cancelled"] .dsh-plugin-auto-review-activity-dot { background: #d99a00; }
    `;
		document.head.appendChild(style);
		return () => style.remove();
	}, "dsh-plugin-auto-review: Chat activity style");
}

//#endregion
//#region src/client/index.ts
/** Required browser services; each registration remains owned by its slot fiber. */
const inject = [
	"slots",
	"connection",
	"locale"
];
const NS = "settings.autoReview";
/** Register this plugin's copy and all UI contribution points. */
function apply(ctx) {
	const connection = ctx.get("connection");
	const translate = ctx.locale.bind(NS);
	ctx.effect(() => ctx.locale.register(NS, {
		en,
		zh
	}), "dsh-plugin-auto-review: copy dictionaries");
	registerAutoReviewActivity(ctx);
	ctx.slots.inject("settings.section", () => ctx.slots.register({
		name: "settings.section",
		id: "auto-review",
		order: 90,
		locale: NS,
		label: () => translate("nav"),
		inject: () => ({
			loadAutoReviewDefault: createAutoReviewDefaultLoader(connection.rpc),
			setAutoReviewDefault: createAutoReviewDefaultSetter(connection.rpc)
		})
	}, AutoReviewSection));
	ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
		name: "conversation.input.right",
		id: "auto-review",
		order: 90,
		locale: NS,
		inject: (sessionId) => ({
			loadAutoReview: createAutoReviewLoader(connection.rpc, sessionId),
			setAutoReview: createAutoReviewSetter(connection.rpc, sessionId)
		})
	}, AutoReviewSelect));
}

//#endregion
exports.AutoReviewRpcError = AutoReviewRpcError;
exports.apply = apply;
exports.callAutoReview = callAutoReview;
exports.inject = inject;
return module.exports; } });