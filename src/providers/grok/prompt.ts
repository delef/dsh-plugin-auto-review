/** Grok escalation-review transcript projection and local command safeguards. */

import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { ApprovalReviewAgent, ApprovalReviewRequest } from '../../auto-review.js'
import type { GrokApprovalReviewSession } from './reviewer.js'

/** Keep review input bounded while retaining both ends of important evidence. */
const GROK_REVIEW_APPROX_BYTES_PER_TOKEN = 4
const GROK_REVIEW_MESSAGE_BUDGET_BYTES = 10_000 * GROK_REVIEW_APPROX_BYTES_PER_TOKEN
const GROK_REVIEW_TOOL_BUDGET_BYTES = 10_000 * GROK_REVIEW_APPROX_BYTES_PER_TOKEN
const GROK_REVIEW_MESSAGE_ENTRY_BYTES = 2_000 * GROK_REVIEW_APPROX_BYTES_PER_TOKEN
const GROK_REVIEW_TOOL_ENTRY_BYTES = 1_000 * GROK_REVIEW_APPROX_BYTES_PER_TOKEN
const GROK_REVIEW_ACTION_BYTES = 16_000 * GROK_REVIEW_APPROX_BYTES_PER_TOKEN
const GROK_REVIEW_APPROVAL_REASON_BYTES = 512 * GROK_REVIEW_APPROX_BYTES_PER_TOKEN
const GROK_REVIEW_RECENT_TOOL_LIMIT = 40

const GROK_REVIEW_SHELL_HEADS = new Set(['sh', 'bash', 'zsh', 'dash', 'fish'])
const GROK_REVIEW_WRAPPER_HEADS = new Set(['sudo', 'env', 'command', 'nice', 'nohup'])

export interface GrokTranscriptEntry {
  readonly kind: 'user' | 'tool'
  readonly text: string
}

export interface GrokTranscriptSnapshot {
  readonly nodes: number[]
  readonly entries: GrokTranscriptEntry[]
}

function utf8Prefix(text: string, maxBytes: number): string {
  let end = Math.min(text.length, maxBytes)
  while (end > 0 && Buffer.byteLength(text.slice(0, end), 'utf8') > maxBytes) end -= 1
  return text.slice(0, end)
}

function utf8Suffix(text: string, maxBytes: number): string {
  let start = Math.max(0, text.length - maxBytes)
  while (start < text.length && Buffer.byteLength(text.slice(start), 'utf8') > maxBytes) start += 1
  return text.slice(start)
}

/** Preserve both ends without splitting a UTF-8 code point. */
export function bounded(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text
  const marker = '\n[truncated]\n'
  const retainedBytes = Math.max(0, maxBytes - Buffer.byteLength(marker, 'utf8'))
  const prefixBytes = Math.ceil(retainedBytes / 2)
  return `${utf8Prefix(text, prefixBytes)}${marker}${utf8Suffix(text, retainedBytes - prefixBytes)}`
}

/** Keep untrusted transcript text from creating trusted role labels. */
function neutralizeTranscriptLine(line: string): string {
  const heading = line.trimStart()
  if (heading.startsWith('#') || /^(USER|TOOL):/i.test(heading)) {
    return `${line.slice(0, line.length - heading.length)}\\${heading}`
  }
  return line
}

function formatLabeledEntry(kind: GrokTranscriptEntry['kind'], text: string): string {
  const label = kind === 'user' ? 'USER' : 'TOOL'
  const lines = text.split('\n').map(neutralizeTranscriptLine)
  return [`${label}: ${lines[0] ?? ''}`, ...lines.slice(1).map(line => `  ${line}`)].join('\n')
}

function shellWords(segment: string): string[] {
  return segment.trim().split(/\s+/).filter(word => word.length > 0)
}

function commandHead(word: string): string {
  const base = word.split(/[/\\]/).pop() ?? word
  return base.toLowerCase()
}

function unquoteWord(word: string): string {
  if (word.length >= 2) {
    const start = word[0]
    const end = word[word.length - 1]
    if ((start === '"' && end === '"') || (start === "'" && end === "'")) return word.slice(1, -1)
  }
  return word
}

function skipCommandWrappers(words: readonly string[]): string[] {
  let index = 0
  while (index < words.length && GROK_REVIEW_WRAPPER_HEADS.has(commandHead(words[index] ?? ''))) index += 1
  return words.slice(index)
}

function isRootRm(segment: string): boolean {
  const words = skipCommandWrappers(shellWords(segment))
  if (words.length === 0 || commandHead(words[0] ?? '') !== 'rm') return false
  return words.slice(1).some(word => {
    const target = unquoteWord(word)
    return target === '/' || target === '/*'
  })
}

function isShellSubstitutedDownload(command: string): boolean {
  const words = skipCommandWrappers(shellWords(command))
  if (words.length === 0 || !GROK_REVIEW_SHELL_HEADS.has(commandHead(words[0] ?? ''))) return false
  if (!words.includes('-c')) return false
  return /(?:\$\(|`)\s*(?:sudo\s+)?(?:curl|wget)\b/i.test(command)
}

function isDownloaderToShell(command: string): boolean {
  if (/\b(curl|wget)\b/i.test(command) && /<\(/.test(command)) return true
  if (isShellSubstitutedDownload(command)) return true
  const pieces = command.split('|')
  let sawDownloader = false
  for (const piece of pieces) {
    const head = commandHead(skipCommandWrappers(shellWords(piece))[0] ?? '')
    if (head === 'curl' || head === 'wget') sawDownloader = true
    if (sawDownloader && GROK_REVIEW_SHELL_HEADS.has(head)) return true
  }
  return false
}

/** Local pre-model deny for patterns whose intent is unambiguously dangerous. */
export function hardDeniedCommand(command: string): boolean {
  const blob = command.toLowerCase()
  if (blob.includes('mkfs') || blob.includes('dd if=') || blob.includes(':(){ :|:& };:')) return true
  if (isDownloaderToShell(command)) return true
  for (const segment of command.split(/(?:&&|\|\||;|\n)/)) {
    for (const piece of segment.split('|')) {
      if (isRootRm(piece)) return true
    }
  }
  return false
}

export function actionCommand(request: ApprovalReviewRequest): string {
  if (typeof request.action.arguments !== 'object' || request.action.arguments === null
    || Array.isArray(request.action.arguments)) return ''
  const command = (request.action.arguments as Record<string, unknown>).command
  return typeof command === 'string' ? command : ''
}

function sandboxMode(request: ApprovalReviewRequest): string {
  if (typeof request.action.arguments !== 'object' || request.action.arguments === null
    || Array.isArray(request.action.arguments)) return 'unspecified'
  const mode = (request.action.arguments as Record<string, unknown>).sandbox_permissions
  return typeof mode === 'string' && mode.length > 0 ? mode : 'unspecified'
}

function recordedDecisions(agent: ApprovalReviewAgent): string[] {
  const records: string[] = []
  for (const event of agent.session.events) {
    if (event.type !== 'approval/decided') continue
    const id = String(event.data.id)
    if (id.startsWith('auto-review-')) continue
    records.push(JSON.stringify({ id, decision: event.data.outcome }))
  }
  return records
}

/** Project direct user turns and assistant tool calls; tool output is never a user anchor. */
export function grokTranscriptSnapshot(agent: ApprovalReviewAgent, startNode = 0): GrokTranscriptSnapshot {
  const nodes = [...agent.session.surface.nodes]
  const entries: GrokTranscriptEntry[] = []
  for (const node of nodes.slice(startNode)) {
    const event = agent.session.events[node]
    if (event === undefined) continue
    if (event.type === 'user/message') {
      if (event.data.source.kind !== 'user') continue
      const text = event.data.content
        .filter((block): block is ContentBlock & { type: 'text' } => block.type === 'text')
        .map(block => block.text.trim())
        .filter(part => part.length > 0)
        .join('\n')
      if (text.length > 0) entries.push({ kind: 'user', text })
      continue
    }
    if (event.type !== 'assistant/message') continue
    for (const block of event.data.message.content) {
      if (block.type !== 'tool-call') continue
      entries.push({ kind: 'tool', text: `${block.name}(${block.arguments})` })
    }
  }
  return { nodes, entries }
}

function isNodePrefix(prefix: readonly number[], nodes: readonly number[]): boolean {
  return prefix.length <= nodes.length && prefix.every((node, index) => nodes[index] === node)
}

function selectGrokTranscript(entries: readonly GrokTranscriptEntry[]): string[] {
  const rendered = entries.map(entry => {
    const cap = entry.kind === 'tool' ? GROK_REVIEW_TOOL_ENTRY_BYTES : GROK_REVIEW_MESSAGE_ENTRY_BYTES
    const text = formatLabeledEntry(entry.kind, bounded(entry.text, cap))
    return { entry, text, size: Buffer.byteLength(text, 'utf8') }
  })
  const included = new Set<number>()
  let messageBytes = 0
  let toolBytes = 0
  const users = rendered
    .map((item, index) => ({ ...item, index }))
    .filter(item => item.entry.kind === 'user')
  const includeUser = (item: typeof users[number] | undefined): void => {
    if (item === undefined || included.has(item.index)) return
    if (messageBytes + item.size > GROK_REVIEW_MESSAGE_BUDGET_BYTES) return
    included.add(item.index)
    messageBytes += item.size
  }
  includeUser(users[0])
  includeUser(users.at(-1))
  for (const user of [...users].reverse()) includeUser(user)

  let recentTools = 0
  for (let index = rendered.length - 1; index >= 0; index -= 1) {
    const item = rendered[index]
    if (item === undefined || item.entry.kind !== 'tool' || recentTools >= GROK_REVIEW_RECENT_TOOL_LIMIT) continue
    if (toolBytes + item.size > GROK_REVIEW_TOOL_BUDGET_BYTES) continue
    included.add(index)
    recentTools += 1
    toolBytes += item.size
  }
  return rendered.filter((_item, index) => included.has(index)).map(item => item.text)
}

function safeActionJson(request: ApprovalReviewRequest): string {
  let serialized: string
  try {
    serialized = JSON.stringify({
      tool: request.action.name,
      call_id: request.action.callId,
      arguments: request.action.arguments,
      ...request.reason === undefined ? {} : { approval_reason: bounded(request.reason, GROK_REVIEW_APPROVAL_REASON_BYTES) },
    }, null, 2)
  } catch {
    serialized = JSON.stringify({
      tool: request.action.name,
      call_id: request.action.callId,
      arguments: '[unserializable arguments]',
      ...request.reason === undefined ? {} : { approval_reason: bounded(request.reason, GROK_REVIEW_APPROVAL_REASON_BYTES) },
    }, null, 2)
  }
  return bounded(serialized, GROK_REVIEW_ACTION_BYTES)
}

export function grokReviewPrompt(
  request: ApprovalReviewRequest,
  state: GrokApprovalReviewSession,
): { prompt: string; nodes: number[] } {
  const current = grokTranscriptSnapshot(request.agent)
  const delta = state.messages.length > 0 && isNodePrefix(state.surfaceNodes, current.nodes)
  const snapshot = delta ? grokTranscriptSnapshot(request.agent, state.surfaceNodes.length) : current
  const transcript = selectGrokTranscript(snapshot.entries)
  const decisions = recordedDecisions(request.agent)
  return {
    nodes: current.nodes,
    prompt: [
      decisions.length > 0 ? `Harness-recorded permission decisions (trusted):\n${decisions.join('\n')}` : '',
      '## Recent conversation',
      delta ? 'New transcript entries since the previous approval review follow.' : '',
      transcript.length > 0 ? transcript.join('\n') : '<no new retained transcript entries>',
      '## End conversation',
      '## Trusted harness findings',
      `- sandbox_escalation: this action already reached native approval after a sandbox boundary. requested_mode=${sandboxMode(request)}. Evaluate the unsandboxed action, not the retry event.`,
      '## Proposed action',
      safeActionJson(request),
    ].filter(part => part.length > 0).join('\n'),
  }
}
