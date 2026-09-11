import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Compact Settings page for the persisted Auto Review default. */
import { useEffect, useState } from 'react';
import { callAutoReview } from './rpc.js';
import { en } from './locales.js';
/** Bind the Settings read endpoint to one Connection RPC face. */
export function createAutoReviewDefaultLoader(rpc) {
    return () => callAutoReview(rpc, 'autoReviewDefault', {});
}
/** Bind the Settings write endpoint to one Connection RPC face. */
export function createAutoReviewDefaultSetter(rpc) {
    return reviewer => callAutoReview(rpc, 'setAutoReviewDefault', { reviewer });
}
function fallbackTranslate(key) {
    return en[key];
}
/** Settings section intentionally stays compact so the page remains scannable. */
export function AutoReviewSection({ loadAutoReviewDefault, setAutoReviewDefault, t }) {
    const translate = t ?? fallbackTranslate;
    const [state, setState] = useState(null);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        if (loadAutoReviewDefault === undefined)
            return;
        let cancelled = false;
        void loadAutoReviewDefault().then(value => { if (!cancelled)
            setState(value); }, reason => { if (!cancelled)
            setError(reason instanceof Error ? reason.message : String(reason)); });
        return () => { cancelled = true; };
    }, [loadAutoReviewDefault]);
    if (loadAutoReviewDefault === undefined || setAutoReviewDefault === undefined)
        return null;
    if (state === null) {
        return _jsx("p", { "data-plugin": "dsh-plugin-auto-review", children: error ?? translate('loading') });
    }
    const liveReviewers = state.reviewers;
    const stale = state.reviewer !== 'none' && !liveReviewers.some(option => option.reviewer === state.reviewer);
    const options = [
        { reviewer: 'none', label: translate('none') },
        ...stale ? [{ reviewer: state.reviewer, label: `${state.reviewer} (${translate('unavailable')})` }] : [],
        ...liveReviewers,
    ];
    const choose = (reviewer) => {
        if (saving || reviewer === state.reviewer || reviewer === (stale ? state.reviewer : ''))
            return;
        setSaving(true);
        setError(null);
        void setAutoReviewDefault(reviewer).then(value => { setState(value); setSaving(false); }, reason => { setError(reason instanceof Error ? reason.message : String(reason)); setSaving(false); });
    };
    return (_jsxs("section", { "data-plugin": "dsh-plugin-auto-review", style: styles.section, children: [_jsx("h2", { style: styles.title, children: translate('defaultTitle') }), _jsx("p", { style: styles.hint, children: translate('defaultHint') }), _jsxs("label", { style: styles.label, children: [_jsx("span", { children: translate('default') }), _jsx("select", { "aria-label": translate('default'), value: state.reviewer, disabled: saving, onChange: event => { choose(event.target.value); }, style: styles.select, children: options.map(option => _jsx("option", { value: option.reviewer, disabled: option.reviewer === state.reviewer && stale, children: option.label }, option.reviewer)) })] }), saving && _jsx("p", { style: styles.status, children: translate('saving') }), error !== null && _jsx("p", { style: styles.error, children: error })] }));
}
const styles = {
    section: { display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 560, color: 'var(--dsw-alias-label-primary)' },
    title: { margin: 0, fontSize: 16, lineHeight: '24px', fontWeight: 600 },
    hint: { margin: 0, color: 'var(--dsw-alias-label-tertiary)', fontSize: 13, lineHeight: '20px' },
    label: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 14, lineHeight: '22px' },
    select: { minWidth: 180, height: 32, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8, padding: '0 8px', background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', font: 'inherit' },
    status: { margin: 0, color: 'var(--dsw-alias-label-tertiary)', fontSize: 12, lineHeight: '18px' },
    error: { margin: 0, color: 'var(--dsw-alias-state-error-primary)', fontSize: 12, lineHeight: '18px' },
};
