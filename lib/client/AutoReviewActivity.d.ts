/** Chat projection for the paired Auto Review approval audit events. */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { ApprovalOutcome } from '@deepseek-ai/dsh-user-approval';
import type { ConversationLocation, ConversationNodeDefinition, ConversationViewNode } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
export interface AutoReviewActivityData {
    readonly provider: string;
    readonly callId: string;
    readonly outcome?: ApprovalOutcome;
}
interface AutoReviewActivityState extends AutoReviewActivityData {
    readonly seq: number;
}
interface AutoReviewActivityNode extends ConversationViewNode {
    readonly kind: 'auto-review';
    readonly target: 'chat';
    readonly anchorSeq: number;
    readonly location: ConversationLocation;
    readonly visibility: 'visible';
    readonly data: AutoReviewActivityData;
}
interface AutoReviewEventRegistry {
    register(definition: ConversationNodeDefinition<AutoReviewActivityState>): () => void;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        conversationEvents: AutoReviewEventRegistry;
    }
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        'conversation.chat.node': {
            kind: 'keyed';
            scope: 'session';
            keyProps: {
                'auto-review': {
                    node: AutoReviewActivityNode;
                };
            };
        };
    }
}
export type AutoReviewActivityProps = PropsRuntime<'conversation.chat.node', 'auto-review'>;
/** Stable user-facing status text for live and replayed Chat cards. */
export declare function formatAutoReviewActivity(provider: string, outcome?: string): string;
/** Fold `auto-review/<id>` asked/decided events into one visible Chat node. */
export declare const autoReviewActivityDefinition: ConversationNodeDefinition<AutoReviewActivityState>;
/** Compact status row that stays outside the model-visible transcript. */
export declare function AutoReviewActivity({ node }: AutoReviewActivityProps): import("react").JSX.Element;
/** Register the definition against whichever Conversation event service exists. */
export declare function registerAutoReviewActivity(ctx: ClientContext): void;
export {};
