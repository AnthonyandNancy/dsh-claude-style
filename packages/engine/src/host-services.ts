import type { HostAccountService } from '@dsh-claude-style/contracts/account'
import type { HostBundleListAnswer, HostConfigFormsService, HostConversationService, HostInventoryAnswer, HostLocaleService, HostModelDirectoriesService, HostPluginBundle, HostServiceLookup, HostSessionRenameAnswer, HostSessionsService, HostShortcutsService, HostSlotOptions, HostSlotsService, HostUiSessionService, HostWorkspaceViewStore, HostWorkspacesService } from '@dsh-claude-style/contracts/services'
import type { HostContext, HostFiber, HostValue } from './host'

/**
 * The host's client services, each read here once (D3).
 *
 * A feature asks for what it does with a service, not for the service's name:
 * the name, the shape it is read as, and the answer where the host carries none
 * live in this module, so a host that renames one is answered here.
 */
/** The session list, and the binding each session's chat is read through. */
export function hostSessions(lookup: HostServiceLookup | null | undefined): HostSessionsService | null {
  const sessions = lookup?.get('sessions') as HostSessionsService | undefined
  return sessions ?? null
}

/** The shown session's own state: which session it is, and how its turn is going. */
export function hostUiSession(lookup: HostServiceLookup | null | undefined): HostUiSessionService | null {
  const uiSession = lookup?.get('uiSession') as HostUiSessionService | undefined
  return uiSession ?? null
}

/** One session's model directory: the catalog, its load and the pick. */
export function hostModelDirectories(lookup: HostServiceLookup | null | undefined): HostModelDirectoriesService | null {
  const directories = lookup?.get('modelDirectories') as HostModelDirectoriesService | undefined
  return directories ?? null
}

/** The shell's language, and the namespaces it translates. */
export function hostLocale(lookup: HostServiceLookup | null | undefined): HostLocaleService | null {
  const locale = lookup?.get('locale') as HostLocaleService | undefined
  return locale ?? null
}

/** One session's conversation service, the chat target's own reader. */
export function hostConversation(lookup: HostServiceLookup | null | undefined): HostConversationService | null {
  const conversation = lookup?.get('conversation') as HostConversationService | undefined
  return conversation ?? null
}

/** The reader's own keyboard shortcuts. */
export function hostShortcuts(lookup: HostServiceLookup | null | undefined): HostShortcutsService | null {
  const shortcuts = lookup?.get('shortcuts') as HostShortcutsService | undefined
  return shortcuts ?? null
}

/** The slot registry, read from the scope that injected it (D75). */
export function hostSlots(lookup: HostServiceLookup): HostSlotsService | null {
  const slots = lookup.get('slots') as HostSlotsService | undefined
  return slots ?? null
}

/** One component handed to a host slot, under the declaration it is registered with. */
export interface SlotEntry {
  options: HostSlotOptions & { name: string }
  component: unknown
}

/**
 * Run `use` with the slot registry once the host serves it, in the scope that
 * injected it (D75): the plugin's own context does not hand the registry out.
 * Disposing the returned scope runs the effects `use` registered in it; a host
 * without late services has no registry and gets null.
 */
export function withSlots(ctx: HostContext, use: (slots: HostSlotsService, scope: HostContext) => void): HostFiber | null {
  if (typeof ctx.inject !== 'function') return null
  return ctx.inject(['slots'], scope => {
    const slots = hostSlots(scope)
    if (slots === null || typeof slots.inject !== 'function') return
    use(slots, scope)
  })
}

/**
 * Hand components to host slots, each as soon as its slot is declared (D42).
 * Disposing the returned scope takes every entry back, or an entry outlives its
 * feature and keeps rendering.
 */
export function registerSlotEntries(ctx: HostContext, entries: readonly SlotEntry[], label: string): HostFiber | null {
  return withSlots(ctx, (slots, scope) => {
    for (const entry of entries) {
      scope.effect(() => slots.inject(entry.options.name, () => slots.register(entry.options, entry.component)), label)
    }
  })
}

/** The client remote: the endpoint every service behind it is reached through. */
export function hostRemote(lookup: HostServiceLookup | null | undefined): HostValue {
  return lookup?.get('remote')
}

/** The account service behind the remote. */
export function hostRemoteAccount(lookup: HostServiceLookup | null | undefined): HostAccountService | null {
  const account = lookup?.get('remote.account') as HostAccountService | undefined
  return account ?? null
}

/** The session service behind the remote: the list, and the shown session. */
export function hostRemoteSession(lookup: HostServiceLookup | null | undefined): HostValue {
  return lookup?.get('remote.session')
}

/**
 * One session's title, written through the host's own rename (`session.rename`,
 * the call behind the host's rename dialog). Null where the host carries no
 * session remote or no rename on it: a host older than the method keeps the
 * title its own header draws.
 */
export function hostRenameSession(lookup: HostServiceLookup | null | undefined, sessionId: string, title: string): Promise<HostSessionRenameAnswer> | null {
  const session = hostRemoteSession(lookup)
  if (session === null || session === undefined || typeof session.rename !== 'function') return null
  return session.rename({ sessionId, title }) as Promise<HostSessionRenameAnswer>
}

/** The permission presets the host serves, behind the remote. */
export function hostRemotePermissionPresets(lookup: HostServiceLookup | null | undefined): HostValue {
  return lookup?.get('remote.permissionPresets')
}

/** The workspace list, archived and live. */
export function hostWorkspaces(lookup: HostServiceLookup | null | undefined): HostWorkspacesService | null {
  const workspaces = lookup?.get('workspaces') as HostWorkspacesService | undefined
  return workspaces ?? null
}

/**
 * The workspace browser's viewing store: the grouping and the archived filter
 * behind the host's own view menu. The host registers its browser under
 * `sidebar.workspaces` with the store it creates, and that registration's
 * `create` answers the one instance the browser renders from, so a write here
 * is the menu's own. Null when the host carries no such registration or its
 * store is not the shape this reads: the caller stays off rather than mounting a
 * control that cannot drive the host (D12).
 */
export function hostWorkspaceView(lookup: HostContext | null | undefined): HostWorkspaceViewStore | null {
  const slots = lookup === null || lookup === undefined ? null : hostSlots(lookup)
  if (slots === null) return null
  const entries = slots.entries('sidebar.workspaces')
  for (let i = 0; i < entries.length; i++) {
    const declaration = entries[i].store
    if (declaration === undefined) continue
    const view = declaration.create() as unknown as HostWorkspaceViewStore
    if (view === null || typeof view !== 'object') continue
    if (typeof view.getSnapshot !== 'function') continue
    if (typeof view.actions?.setArchivedFilter !== 'function' || typeof view.actions?.setGroupBy !== 'function') continue
    return view
  }
  return null
}

/** The shell's workspace actions: open a session, start one. */
export function hostUiWorkspace(lookup: HostServiceLookup | null | undefined): HostValue {
  return lookup?.get('uiWorkspace')
}

/** The shell's plugin page navigation. */
export function hostPluginNavigation(lookup: HostServiceLookup | null | undefined): HostValue {
  return lookup?.get('pluginNavigation')
}

/** The shell's panel layout. */
export function hostLayout(lookup: HostServiceLookup | null | undefined): HostValue {
  return lookup?.get('layout')
}

/** The installed plugin inventory, behind the remote. */
export function hostRemotePluginInventory(lookup: HostServiceLookup | null | undefined): HostValue {
  return lookup?.get('remote.pluginInventory')
}

/** The plugin manager behind the remote. */
export function hostRemotePluginManager(lookup: HostServiceLookup | null | undefined): HostValue {
  return lookup?.get('remote.pluginManager')
}

/**
 * The bundles the profile carries, those that loaded: the inventory is read
 * first because the manager Remote is mounted whether or not the host manages
 * a profile, and only the inventory says whether it does.
 * @returns null where the host carries neither service; otherwise a promise for
 *          the list, empty when the host manages no profile, rejected when
 *          either service answers with an error.
 */
export function profileBundles(lookup: HostServiceLookup | null | undefined): Promise<HostPluginBundle[]> | null {
  const inventory = hostRemotePluginInventory(lookup)
  const manager = hostRemotePluginManager(lookup)
  if (!inventory || !manager) return null
  return inventory.list().then((answer: HostInventoryAnswer) => {
    if (!answer.ok) throw new Error(answer.error?.message ?? 'the plugin inventory answered without a reason')
    if (answer.value.managementAvailable !== true) return []
    return manager.listBundles().then((bundles: HostBundleListAnswer) => {
      if (!bundles.ok) throw new Error(bundles.error?.message ?? 'the plugin manager answered without a reason')
      return bundles.value.filter((bundle) => bundle.error === undefined)
    })
  })
}

/** The skill catalog behind the remote. */
export function hostRemoteSkills(lookup: HostServiceLookup | null | undefined): HostValue {
  return lookup?.get('remote.skills')
}

/** The host's settings-form service (`configForms`, D75); null where the host serves no namespaces to the browser. */
export function hostConfigForms(lookup: HostServiceLookup | null | undefined): HostConfigFormsService | null {
  const forms = lookup?.get('configForms') as HostConfigFormsService | undefined
  return typeof forms?.get === 'function' ? forms : null
}
