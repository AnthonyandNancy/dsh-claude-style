import { COMPOSER_CARD_SELECTOR, COMPOSER_INPUT_SELECTOR, COMPOSER_PLACEHOLDER_SELECTOR, COMPOSER_SELECTOR, COMPOSER_STACK_SELECTOR, COMPOSER_STAT_SELECTOR, COMPOSER_VARIANT_ATTRIBUTE, CONVERSATION_SCROLL_SELECTOR, CONVERSATION_SESSION_ATTRIBUTE, CONVERSATION_SESSION_SELECTOR, CONVERSATION_VIEW_STORAGE_PREFIX, DIALOG_TRIGGER_SELECTOR, FOOT_AREA_SELECTOR, FOREGROUND_SELECTOR, MENU_ROLE_SELECTOR, MODAL_DIALOG_SELECTOR, MODEL_SLOT_SELECTOR, PERMISSION_TRIGGER_SELECTOR, PHASE_ATTRIBUTE, RIGHTBAR_TOGGLE_SELECTOR, SIDEBAR_BRAND_SELECTOR, SIDEBAR_CHAT_SELECTOR, SIDEBAR_NEW_SESSION_SELECTOR, SIDEBAR_ROOT_SELECTOR, SIDEBAR_TOGGLE_SELECTOR, WINDOWS_MENU_SELECTOR } from '@dsh-claude-style/contracts/dom'
import type { HostAssistantStep, HostChatSnapshot, HostChatTarget, HostServiceLookup, HostOutlineTurn, HostRunningCall, HostSession, HostSessionsService, HostTurn, HostUiConversationService, HostUiSessionService } from '@dsh-claude-style/contracts/services'
import { observeMatches, observeSize, subscribeMutations } from './bus'
import { closestFrom, shown } from './dom'
import { entryInlineSize } from './size'
import { skin } from './skin'

/**
 * The host's client context (cordis), handed to `apply` and to every feature.
 * Services come by name; their shapes are the host's own and stay untyped
 * here until the contract module types them (D3).
 */
export interface HostContext {
  /** The loader's fiber; its boot entry id names this plugin's settings namespace (D75). */
  readonly fiber?: { entry?: { id?: unknown } }
  /** A service by name, or undefined when the host carries none (D12). */
  get(name: string): HostValue
  /** Listen to a context event (`connection/reset`); the function it returns stops listening. */
  on?(name: string, listener: () => void): () => void
  /** Run `effect` now; the function it returns runs when the context is disposed. */
  effect(effect: () => () => void, label?: string): void
  /** Run `callback` in a scope once every named service exists; a host without it has no late services. */
  inject?(names: string[], callback: (scope: HostContext) => void): HostFiber
}

/**
 * A value read off a host service or snapshot: a session, a catalog group, a
 * chat node. Its shape is the host's own; the contract module types the ones
 * the skin reads by name (D3, `contracts/services.ts`).
 */
export type HostValue = any

/** A host locale namespace's translate seat (`locale.bind(namespace)`): a key and its parameters to text. */
export type { HostText } from '@dsh-claude-style/contracts/services'

/** The scope `inject` opened: disposing it runs the effects registered in it. */
export interface HostFiber {
  dispose(): void
}

/**
 * Whether the page is off screen, answered by the skin's visibility owner
 * through the seam (packages/engine/src/skin.ts, D73).
 */
export function pageHidden(): boolean {
  return skin().pageHidden()
}

/**
 * Whether `element` is still the document's first match: it is connected, it
 * matches itself, and no earlier sibling subtree holds a match. The sibling
 * walk is short for these seats (a header, a card, a footer), which the host
 * mounts once and replaces whole.
 */
function stillFirstMatch(element: Element, selector: string) {
  if (!element.isConnected || !element.matches(selector)) return false
  for (let node: Element | null = element; node !== null; node = node.parentElement) {
    for (let earlier = node.previousElementSibling; earlier !== null; earlier = earlier.previousElementSibling) {
      if (earlier.matches(selector) || earlier.querySelector(selector) !== null) return false
    }
  }
  return true
}

/** The batch count the one shared body watch has seen: an absent seat is retried once per batch. */
let matchEpoch = 0
/** Whether the shared body watch is open. One is enough for every seat, and it is never closed. */
let matchEpochWatched = false

/** Open the one body watch the cached seats read: the first cacheFirstMatch call does it. */
function openMatchEpochWatch() {
  if (matchEpochWatched) return
  matchEpochWatched = true
  // The bump runs inside the batch's own callback: a reader that writes what the
  // frame paints asks for that timing (`beforePaint`, D40) and must see the
  // batch's nodes rather than the previous batch's answer (#189). This callback
  // moves a counter, so the earlier turn costs one addition.
  subscribeMutations(document.body, { subtree: true, childList: true, beforePaint: true }, () => {
    matchEpoch += 1
  })
}

/**
 * The first match of `selector`, resolved once and kept while it stays the
 * first match (D40): unrelated mutation batches keep reusing the element, and
 * the document is queried again only when the host replaced the element or
 * mounted one before it. The answer is the one a query gives — an earlier match
 * invalidates the kept element.
 *
 * An answer of "nothing matched" is kept for the rest of the batch, then retried
 * once after a later batch. The query walks the whole document, and the seats
 * asked for here are absent on most of the pages a pass runs over — the hero
 * root on a conversation page, the settings nav list away from the dialog — so
 * a query re-issued per pass paid a document walk for an answer that only the
 * host's own mounting can change.
 *
 * One body watch serves every cached seat, opened by the first reader and never
 * closed: a seat created inside `install()` would otherwise add a subscription
 * per enable. The watch moves an epoch rather than clearing each reader by hand;
 * an absent reader retries after a later batch, while a kept element validates
 * its own place without querying the document again.
 *
 * Exported for the seats one feature alone reads (a header, a slot, a meter):
 * the mechanism lives once, the selector stays with its reader.
 */
export function cacheFirstMatch<T extends Element>(selector: string) {
  openMatchEpochWatch()
  let kept: T | null = null
  let answered = false
  let seenEpoch = matchEpoch
  return () => {
    if (seenEpoch !== matchEpoch) {
      if (kept === null) answered = false
      seenEpoch = matchEpoch
    }
    if (kept !== null && stillFirstMatch(kept, selector)) return kept
    if (kept === null && answered) return null
    kept = document.querySelector<T>(selector)
    answered = true
    return kept
  }
}

function cacheFirst<T extends Element>(selector: string) {
  return cacheFirstMatch<T>(selector)
}

/**
 * The host's access-mode trigger: the button its permission slot renders.
 * Every slot render site carries a `[data-slot="<key>"]` wrapper (D3), and
 * the skin inserts its own buttons inside that wrapper, so those are skipped.
 */
export const findAccessTrigger = cacheFirst<HTMLButtonElement>(PERMISSION_TRIGGER_SELECTOR)

/** The answer findHeroRoot keeps, and the batch it was taken in. */
let heroRoot: HTMLElement | null = null
let heroRootEpoch = -1
let heroRootAnswered = false

/**
 * The host's hero-phase conversation root: the page before a session is chosen.
 * A sub-agent's docked conversation renders the same composer, so a blank one
 * carries the marker too; it is not the page's start screen, and the home page's
 * own features (the ripple and the mascot among them) must not mount against it.
 * Kept per mutation batch, as the other host seats are (D9, D40).
 */
export function findHeroRoot() {
  openMatchEpochWatch()
  if (heroRootEpoch !== matchEpoch) {
    heroRoot = null
    heroRootAnswered = false
    heroRootEpoch = matchEpoch
  }
  if (heroRootAnswered) return heroRoot
  heroRootAnswered = true
  const roots = document.querySelectorAll<HTMLElement>(`[${PHASE_ATTRIBUTE}="hero"]`)
  for (let i = 0; i < roots.length; i += 1) {
    if (roots[i].closest(SIDEBAR_CHAT_SELECTOR) === null) {
      heroRoot = roots[i]
      break
    }
  }
  return heroRoot
}

/** The sidebar footer, where the account row and the plugin footer entries live. */
export const findFootArea = cacheFirst<HTMLElement>(FOOT_AREA_SELECTOR)

/**
 * The modal dialog the host has up, or null. The host portals its overlays onto
 * <body>, so no scope narrower than the document reaches one; the wrapper that
 * carries such a panel is `role="presentation"`, and the dialog inside it is
 * what says a surface of the reader's own is up.
 */
export const findHostModal = cacheFirst<HTMLElement>(MODAL_DIALOG_SELECTOR)

/**
 * The sidebar's own column. The skin's sidebar-side nodes live inside it, so a
 * sweep for its own strays is scoped here instead of the whole document; the
 * host mounts this column once and replaces it whole.
 */
export const findSidebarRoot = cacheFirst<HTMLElement>(SIDEBAR_ROOT_SELECTOR)

/**
 * The sidebar's own width, as a change of boxes rather than of structure
 * (D40). The root is mounted once and replaced whole, so the subscription is
 * rebound to whichever root stands now; a root that leaves the document stops
 * reporting.
 *
 * @returns the function that stops the subscription.
 */
export function observeSidebarWidth(listener: () => void) {
  let stopSize: (() => void) | null = null
  let watched: HTMLElement | null = null
  let width = 0
  /**
   * The width the last delivery reported. The host rerenders its sidebar shell
   * on every frame of a drag, and the skin's own part marks follow it; only a
   * box that actually moved is a width change, whichever root carries it.
   */
  let reported = 0
  /** Bind the size subscription to the root standing now; a new root reports its own box. */
  function watch() {
    const root = findSidebarRoot()
    if (root === watched) return
    if (stopSize !== null) stopSize()
    stopSize = null
    watched = root
    width = 0
    if (root === null) return
    stopSize = observeSize(root, (entries) => {
      const next = entryInlineSize(entries[entries.length - 1])
      // The first entry reports the box the root already has. It is a change
      // only when a previous root carried another width, and a replaced root's
      // own mount is then that previous root's number rather than a new one.
      if (width === 0) {
        width = next
        if (reported === 0 || Math.abs(next - reported) < 0.5) return
      } else if (Math.abs(next - width) < 0.5) return
      width = next
      reported = next
      listener()
    })
  }
  const roots = observeMatches<HTMLElement>(SIDEBAR_ROOT_SELECTOR, watch)
  watch()
  return () => {
    roots.release()
    if (stopSize !== null) stopSize()
    stopSize = null
    watched = null
    reported = 0
  }
}

/**
 * The sidebar's brand row and its collapse toggle, and the desktop window's own
 * menu button beside them: the seats the surface switch and the header band are
 * placed against (features/surface, features/header-band). Each is absent on
 * most pages — no desktop window in a browser, no toggle in the collapsed rail —
 * so the answer is kept rather than queried per pass.
 */
export const findSidebarBrand = cacheFirst<HTMLElement>(SIDEBAR_BRAND_SELECTOR)
/** The New session button, after which the skin seats its standalone search button. */
export const findSidebarNewSession = cacheFirst<HTMLElement>(SIDEBAR_NEW_SESSION_SELECTOR)
export const findSidebarToggle = cacheFirst<HTMLElement>(SIDEBAR_TOGGLE_SELECTOR)
export const findWindowsMenu = cacheFirst<HTMLElement>(WINDOWS_MENU_SELECTOR)

/**
 * The right panel's own collapse control, while that panel is open. It hangs
 * from a transformed, clipped subtree, so the skin draws its own control in the
 * header's row and presses this one; the same read answers whether the panel is
 * open at all.
 */
export const findRightbarToggle = cacheFirst<HTMLElement>(RIGHTBAR_TOGGLE_SELECTOR)

/**
 * The open host menu card: the host portals its menus to `<body>`, and every
 * card the skin builds itself carries a `dsh-claude-` class (D3). The account
 * row and the hero menu ask this same question on every pass, so it is read
 * once here and kept until the page's structure changes — a menu opening or
 * closing is a node arriving or leaving (D40).
 */
export const findHostMenu = cacheFirst<HTMLElement>(`${MENU_ROLE_SELECTOR}:not([class*="dsh-claude-"])`)

/** The page's first menu or modal dialog, shown or not, kept per batch (D40). */
const findForegroundNode = cacheFirst<HTMLElement>(FOREGROUND_SELECTOR)

/**
 * The first menu or modal dialog the reader is facing, the host's or the skin's:
 * the foreground a key or a pointer must not act behind. A node kept mounted
 * while hidden — an overlay root another plugin leaves in the document, a dialog
 * between its exit frames — holds nothing, and the next shown one counts.
 */
export function findForeground(): HTMLElement | null {
  const first = findForegroundNode()
  if (first === null) return null
  if (shown(first)) return first
  const all = document.querySelectorAll<HTMLElement>(FOREGROUND_SELECTOR)
  for (let i = 0; i < all.length; i += 1) {
    if (shown(all[i])) return all[i]
  }
  return null
}

/**
 * The host's composer card — the element the skin's composer rules hang on —
 * and the placeholder its editor draws. The card's variant is the skin's own
 * marking (D9); every reader goes through these, so the selectors live once.
 */
const COMPOSER_CARD = COMPOSER_CARD_SELECTOR
const COMPOSER_PLACEHOLDER = COMPOSER_PLACEHOLDER_SELECTOR

/** The composer cards, kept current by the bus instead of queried every pass (D40). */
export function observeComposerCards() {
  return observeMatches<HTMLElement>(COMPOSER_CARD)
}

/** The composer placeholders, kept current by the bus (D40); the skin's synthetic one is a match too. */
export function observeComposerPlaceholders() {
  return observeMatches<HTMLElement>(COMPOSER_PLACEHOLDER)
}

export const findComposerCard = cacheFirst<HTMLElement>(COMPOSER_CARD)

/**
 * The host's model slot in the composer row: the box the host renders its own
 * model seat into. It is React's, and the skin only appends its own nodes
 * beside the host's root (features/model/seat-box.ts,
 * features/context-stats/meter-ring.ts), so both features read it here.
 */
const MODEL_SLOT = MODEL_SLOT_SELECTOR

/** The model slot inside `scope`: the row a card's own composer render draws. */
export function findModelSlotIn(scope: ParentNode) {
  return scope.querySelector<HTMLElement>(MODEL_SLOT)
}

/** The answer findPrimaryModelSlot keeps, and the batch it was taken in. */
let primaryModelSlot: HTMLElement | null = null
let primaryModelSlotEpoch = -1
let primaryModelSlotAnswered = false

/**
 * The model slot of the page's MAIN composer: the first card that is not a
 * sub-agent's docked conversation. A docked conversation draws a card of its
 * own — the same composer render, its own model slot — and the skin's model seat
 * stands in one card only: the main one. Reading the document's first slot
 * instead would put the seat in whichever card the host mounted first, and the
 * shell the reader types into would lose it (issue #189).
 *
 * Kept per mutation batch, as the other seats are (D40): cards mount and unmount
 * with the sidebar, and the kept slot is dropped in the batch that changed them.
 */
export function findPrimaryModelSlot() {
  openMatchEpochWatch()
  if (primaryModelSlotEpoch !== matchEpoch) {
    primaryModelSlot = null
    primaryModelSlotAnswered = false
    primaryModelSlotEpoch = matchEpoch
  }
  if (primaryModelSlotAnswered) return primaryModelSlot
  primaryModelSlotAnswered = true
  primaryModelSlot = mainModelSlot()
  return primaryModelSlot
}

function mainModelSlot() {
  const cards = document.querySelectorAll<HTMLElement>(COMPOSER_CARD)
  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i]
    if (card.closest(SIDEBAR_CHAT_SELECTOR) !== null) continue
    const slot = card.querySelector<HTMLElement>(MODEL_SLOT)
    if (slot !== null) return slot
  }
  return document.querySelector<HTMLElement>(MODEL_SLOT)
}

/** The composer card `node` sits in, or null; `variant` narrows it to one variant. */
export function closestComposerCard(node: EventTarget | null | undefined, variant?: string) {
  if (variant === undefined) return closestFrom(node, COMPOSER_CARD)
  return closestFrom(node, `${COMPOSER_CARD}[${COMPOSER_VARIANT_ATTRIBUTE}="${variant}"]`)
}

export function findComposerPlaceholder(card: Element) {
  return card.querySelector<HTMLElement>(COMPOSER_PLACEHOLDER)
}

/**
 * The host's statistics in the composer stack: the element the marked figures
 * share. Null when the host draws none, which every reader tolerates.
 */
export function findComposerStats() {
  const figure = document.querySelector<HTMLElement>(COMPOSER_STAT_SELECTOR)
  return figure === null ? null : figure.parentElement
}

/**
 * The host's context meter inside `card`'s dock line, or null when the page
 * carries none.
 *
 * The dock is the card's next sibling (a notice line, when there is one, sits
 * before it), and the meter is the dialog trigger in it that draws a ring of
 * `<circle>`s — the statistics pills draw none. The composer pass marks the
 * node it finds, and the statistics feature reads the meter while that pass is
 * not installed, so the answer is taken here rather than in either of them.
 */
export function findDockedContextMeter(card: Element | null) {
  const dock = card === null ? null : card.nextElementSibling
  if (dock === null) return null
  const triggers = dock.querySelectorAll<HTMLElement>(DIALOG_TRIGGER_SELECTOR)
  for (let i = 0; i < triggers.length; i++) {
    const trigger = triggers[i]
    if (trigger.querySelector(':scope > svg > circle') === null) continue
    let node: HTMLElement = trigger
    while (node.parentElement !== null && node.parentElement !== dock) node = node.parentElement
    return node
  }
  return null
}

/** The editable draft inside `scope`: the element the caret and the send flight read. */
export function findComposerInput(scope: ParentNode = document) {
  return scope.querySelector<HTMLElement>(COMPOSER_INPUT_SELECTOR)
}

/**
 * The composer seat around `scope`: a pointer or key inside it is the reader
 * typing, which the scroll owner reads as intent that is not a scroll (D40).
 */
export function findComposerSeat(scope: ParentNode = document) {
  return scope.querySelector<HTMLElement>(COMPOSER_SELECTOR)
}

/** The session scroller: the element the host hangs its own follow off (D40). */
export const findConversationScroller = cacheFirst<HTMLElement>(CONVERSATION_SCROLL_SELECTOR)

/** The shown conversation: the element carrying its session id, and the id itself. */
const CONVERSATION_SESSION_ATTR = CONVERSATION_SESSION_ATTRIBUTE
const CONVERSATION_SESSION = `[${CONVERSATION_SESSION_ATTR}]`

/**
 * The shown conversation, kept while it stays the document's first match: a
 * session switch mounts the next one, and an earlier match invalidates the
 * kept element as a fresh query would answer with it.
 */
export const findConversationSession = cacheFirst<HTMLElement>(CONVERSATION_SESSION_SELECTOR)

export function closestConversationSession(node: EventTarget | null | undefined) {
  return closestFrom(node, CONVERSATION_SESSION)
}

export function conversationSessionId(host: Element | null | undefined) {
  if (host === null || host === undefined) return null
  const id = host.getAttribute(CONVERSATION_SESSION_ATTR)
  return typeof id === 'string' ? id : null
}

/** The view id the host saved for this session; null means chat or no usable saved value. */
export function conversationViewPreference(sessionId: string | null | undefined): string | null {
  if (typeof sessionId !== 'string' || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(CONVERSATION_VIEW_STORAGE_PREFIX + sessionId)
    if (raw === null) return null
    const stored: unknown = JSON.parse(raw)
    if (typeof stored !== 'object' || stored === null || !('view' in stored)) return null
    return typeof stored.view === 'string' ? stored.view : null
  } catch {
    // The host reads an unavailable store or malformed JSON as no saved view too.
    return null
  }
}

/**
 * The host's composer stack (ui-conversation's `.composerStack`): the composer
 * card with the cards stacked above it, and on the new-session page the hero
 * around them.
 */
export const COMPOSER_STACK = COMPOSER_STACK_SELECTOR

/** The selected session id, as the host's `uiSession` service publishes it; null while the shell shows none. */
export function currentSessionId(ctx: HostContext): string | null {
  const uiSession = ctx.get('uiSession') as HostUiSessionService | undefined
  const key = uiSession?.current?.value?.key
  return typeof key === 'string' ? key : null
}

/**
 * A card's toolbar row: the flex line the host draws under the input field,
 * carrying the leading tools and the trailing model slot. The host gives the
 * row no stable hook, and the skin's sheet only reaches rows the part walk
 * named (sidebar chat sits outside the walk's regions), so docked cards keep
 * the host's own wrapping row unless its wrapper is matched here. The row is
 * the card's own child that holds the model slot: a structural read, not the
 * host's generated class names (D3).
 */
export function findComposerRowIn(card: Element): HTMLElement | null {
  const slot = findModelSlotIn(card)
  if (slot === null) return null
  for (let i = 0; i < card.children.length; i += 1) {
    const child = card.children[i]
    if (child.contains(slot)) return child as HTMLElement
  }
  return null
}

export function currentSession(ctx: HostContext): HostSession | null {
  const id = currentSessionId(ctx)
  if (id === null) return null
  return sessionById(ctx, id)
}

/** The session the host binds to one id, or null while it binds none. */
export function sessionById(ctx: HostContext, sessionId: string): HostSession | null {
  const sessions = ctx.get('sessions') as HostSessionsService | undefined
  if (sessions === undefined || sessions === null) return null
  const binding = sessions.binding(sessionId)
  if (binding === undefined || binding === null) return null
  return binding.session === undefined ? null : binding.session
}

/**
 * One session's chat target (ui-chat's `chat` target of uiConversation): the
 * loaded window's nodes, turns and turn navigation, as the host's own chat
 * view reads them. The host builds the target only for a subscriber or while
 * the shell shows that session's chat view, so a bare read on the trajectory
 * view sees nothing.
 */
export function findChatTarget(ctx: HostContext, sessionId: string): HostChatTarget | null {
  const conversation = ctx.get('uiConversation') as HostUiConversationService | undefined
  const sessions = ctx.get('sessions') as HostSessionsService | undefined
  if (!conversation || !sessions?.binding(sessionId)) return null
  return conversation.binding(sessionId).target('chat') ?? null
}

/**
 * What an open turn is doing, read off the host's chat snapshot: its newest
 * step's assistant output while that streams (`newest` is the kind of its
 * newest block, null before the first), else `{ kind: 'tools', call }` with the
 * call the host reports in flight — its block carries the tool's name and the
 * arguments it has received — else null: the turn waits on the model.
 */
export function readTurnActivity(snapshot: HostChatSnapshot, turn: HostTurn): TurnActivity | null {
  const step = turn.steps.length === 0 ? undefined : turn.steps[turn.steps.length - 1]
  const assistant = step === undefined ? undefined : step.data.get('assistant-step')
  if (assistant !== undefined && assistant.status === 'running') {
    const blocks = assistant.blocks
    return { kind: 'assistant', assistant, newest: blocks.length === 0 ? null : blocks[blocks.length - 1].kind }
  }
  // The host orders the calls in flight by where they stand in the turn, so the
  // last of this turn's is the one the model is on now.
  const calls = snapshot.legacy?.runningCalls ?? []
  let running: HostRunningCall | undefined
  for (let i = 0; i < calls.length; i++) {
    if (calls[i].turn === turn.turn) running = calls[i]
  }
  return running === undefined ? null : { kind: 'tools', call: running }
}

/** What an open turn is doing (readTurnActivity). */
export type TurnActivity = { kind: 'assistant', assistant: HostAssistantStep, newest: string | null } | { kind: 'tools', call: HostRunningCall }

export function currentPreset(session: HostSession): string | null {
  const snapshot = session.projections?.faceOf('permissions').getSnapshot()
  if (snapshot === undefined || snapshot === null) return null
  // The face hands back `{ currentValue }`, the shape the host's own picker reads.
  const value = (snapshot as { currentValue?: unknown }).currentValue
  return typeof value === 'string' ? value : null
}

/**
 * One session's whole-log turn outline (the host's `turnOutline` projection):
 * `{ turn, seq, prompt, response }` per started turn, or undefined where the
 * assembly does not mount that projection. `seq` is the turn's `turn/start`
 * event, which is what the host's own jump pages history through
 */
export function sessionOutline(ctx: HostContext, sessionId: string): HostOutlineTurn[] | undefined {
  const face = ctx.get('sessions')?.binding(sessionId)?.session?.projections?.faceOf('turnOutline')
  return typeof face?.getSnapshot === 'function' ? face.getSnapshot() : undefined
}

/**
 * The turn holding one event seq: the latest outline entry at or before it. An
 * outline that does not reach that far answers null, and the caller leaves the
 * reading position where it is.
 */
export function turnForSeq(outline: HostOutlineTurn[] | undefined, seq: number): number | null {
  if (!Array.isArray(outline)) return null
  let found: number | null = null
  for (const entry of outline) {
    if (entry === null || typeof entry !== 'object') continue
    if (!Number.isSafeInteger(entry.turn) || !Number.isSafeInteger(entry.seq)) continue
    if (entry.seq > seq) continue
    if (found === null || entry.turn > found) found = entry.turn
  }
  return found
}


export {
  hostSessions,
  hostUiSession,
  hostModelDirectories,
  hostLocale,
  hostConversation,
  hostShortcuts,
  hostSlots,
  withSlots,
  registerSlotEntries,
  hostRemote,
  hostRemoteAccount,
  hostRemoteSession,
  hostRenameSession,
  hostRemotePermissionPresets,
  hostWorkspaces,
  hostWorkspaceView,
  hostUiWorkspace,
  hostPluginNavigation,
  hostLayout,
  hostRemotePluginInventory,
  hostRemotePluginManager,
  profileBundles,
  hostRemoteSkills,
  hostConfigForms,
} from './host-services'
export type { SlotEntry } from './host-services'
