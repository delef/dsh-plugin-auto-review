import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Per-session automatic reviewer selector for the conversation composer. */
import { useEffect, useRef, useState } from 'react';
import { en } from './locales.js';
import { callAutoReview } from './rpc.js';
/** Bind the per-session read endpoint to one Connection RPC face. */
export function createAutoReviewLoader(rpc, sessionId) {
    return () => callAutoReview(rpc, 'autoReview', { sessionId });
}
/** Bind the per-session write endpoint and reduce business errors to `false`. */
export function createAutoReviewSetter(rpc, sessionId) {
    return reviewer => callAutoReview(rpc, 'setAutoReview', { sessionId, reviewer }).then(() => true, () => false);
}
function fallbackTranslate(key) {
    return en[key];
}
/** Render a compact menu beside other composer controls. */
export function AutoReviewSelect({ loadAutoReview, setAutoReview, t }) {
    const translate = t ?? fallbackTranslate;
    const [state, setState] = useState(null);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const rootRef = useRef(null);
    const loadRef = useRef(loadAutoReview);
    loadRef.current = loadAutoReview;
    useEffect(() => {
        const load = loadRef.current;
        if (load === undefined)
            return;
        let cancelled = false;
        void load().then(value => { if (!cancelled)
            setState(value); }, () => { });
        return () => { cancelled = true; };
    }, []);
    useEffect(() => {
        if (!open)
            return;
        const closeOutside = (event) => {
            if (!rootRef.current?.contains(event.target))
                setOpen(false);
        };
        document.addEventListener('mousedown', closeOutside);
        return () => { document.removeEventListener('mousedown', closeOutside); };
    }, [open]);
    if (loadAutoReview === undefined || setAutoReview === undefined || state === null)
        return null;
    const liveReviewers = state.reviewers;
    const selected = state.reviewer;
    const selectedIsStale = selected !== 'none'
        && !liveReviewers.some(option => option.reviewer === selected);
    const staleOption = selectedIsStale
        ? { reviewer: selected, label: `${selected} (${translate('unavailable')})` }
        : undefined;
    const choices = [
        { reviewer: 'none', label: translate('none') },
        ...staleOption === undefined ? [] : [staleOption],
        ...liveReviewers,
    ];
    const selectedLabel = choices.find(option => option.reviewer === selected)?.label ?? selected;
    const triggerLabel = `${translate('autoReview')} · ${selectedLabel}`;
    const choose = (reviewer) => {
        if (busy)
            return;
        if (reviewer === state.reviewer) {
            setOpen(false);
            return;
        }
        setBusy(true);
        void setAutoReview(reviewer).then(ok => {
            setBusy(false);
            if (ok) {
                setState(current => current === null ? current : { ...current, reviewer });
                setOpen(false);
            }
        }, () => { setBusy(false); });
    };
    const show = () => {
        setOpen(true);
        const load = loadRef.current;
        if (load !== undefined)
            void load().then(setState, () => { });
    };
    return (_jsxs("div", { ref: rootRef, "data-plugin": "dsh-plugin-auto-review", style: styles.root, onKeyDown: event => {
            if (event.key === 'Escape' && open) {
                event.preventDefault();
                setOpen(false);
            }
        }, children: [open && (_jsx("div", { style: styles.menu, role: "menu", "aria-label": translate('autoReview'), children: choices.map(option => {
                    const stale = option.reviewer === selected && selectedIsStale;
                    return (_jsxs("button", { type: "button", role: "menuitemradio", "aria-checked": option.reviewer === selected, "aria-disabled": stale, style: styles.item, disabled: busy || stale, onClick: () => { choose(option.reviewer); }, children: [_jsx("span", { style: styles.itemCheck, children: option.reviewer === selected ? '✓' : '' }), _jsxs("span", { style: styles.itemText, children: [_jsx("span", { style: styles.itemName, children: option.label }), _jsx("span", { style: styles.itemDescription, children: option.reviewer === 'none' ? translate('noneDescription') : translate('reviewerDescription') })] })] }, option.reviewer));
                }) })), _jsx("button", { type: "button", style: styles.trigger, "aria-haspopup": "menu", "aria-expanded": open, "aria-label": triggerLabel, title: triggerLabel, disabled: busy, onClick: () => { if (open)
                    setOpen(false);
                else
                    show(); }, children: triggerLabel })] }));
}
const styles = {
    root: { position: 'relative', display: 'inline-flex' },
    trigger: {
        border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8,
        background: 'transparent', color: 'var(--dsw-alias-label-secondary)',
        font: 'inherit', fontSize: 12, lineHeight: '18px',
        padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap',
    },
    menu: {
        position: 'absolute', bottom: '100%', right: 0, marginBottom: 4,
        minWidth: 220, padding: 4, zIndex: 20,
        background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 2,
    },
    item: {
        display: 'flex', alignItems: 'flex-start', gap: 6, width: '100%',
        border: 'none', borderRadius: 6, background: 'transparent',
        padding: '6px 8px', cursor: 'pointer', font: 'inherit', textAlign: 'left',
    },
    itemCheck: { width: 14, flexShrink: 0, fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-primary)' },
    itemText: { display: 'flex', flexDirection: 'column' },
    itemName: { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-primary)' },
    itemDescription: { fontSize: 11, lineHeight: '16px', color: 'var(--dsw-alias-label-tertiary)' },
};
