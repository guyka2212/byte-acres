// Accounts, classes and the class leaderboard, through Supabase. Every player
// has an account (email and password). Only a build without
// VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (development and the
// offline test build) plays without one. The publishable key is meant to be
// public: row level security is what protects the data.

import type { SupabaseClient, User } from '@supabase/supabase-js'

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
export const cloudConfigured = !!(URL_ && KEY)

export type Role = 'personal' | 'teacher' | 'student'

export interface Profile {
  displayName: string
  role: Role
  /** a badge shown next to the name; only the project owner can give one */
  badge: 'developer' | null
  /** the field shown on the public leaderboard; null: the best one */
  leaderboardFarm: string | null
  /** null: the default for the kind of account (students hidden, everyone else shown) */
  onLeaderboard: boolean | null
}
export interface LeaderRow {
  displayName: string; badge: string | null; role: Role; farmName: string
  score: number; unlocks: number; gold: number; playedSeconds: number; isMe: boolean
}
export interface MyFarm { id: string; name: string; kind: 'personal' | 'class' | 'demo'; score: number }
export interface ClassRow { id: string; name: string; code: string; teacherId: string; createdAt: string }
export interface MyClass extends ClassRow { myName?: string; teaching: boolean }
export interface Member { userId: string; displayName: string; joinedAt: string }
export interface Rank {
  userId: string; displayName: string; isTeacher: boolean; isMe: boolean
  score: number; unlocks: number; gold: number; playedSeconds: number; updatedAt: string | null
}
export interface CloudFarm { id: string; kind: 'personal' | 'class' | 'demo'; classId: string | null; name: string; playedSeconds: number; updatedAt: string; score: number }

export interface AccountState {
  status: 'off' | 'loading' | 'signed-out' | 'signed-in'
  email: string | null
  userId: string | null
  profile: Profile | null
  message: string | null
  /** which field the message is about, when it's about one */
  messageField?: 'email' | 'password' | 'name'
}

let sb: SupabaseClient | null = null
export async function supabase(): Promise<SupabaseClient> {
  if (sb) return sb
  const { createClient } = await import('@supabase/supabase-js')
  sb = createClient(URL_!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  return sb
}

const OFFLINE = "Couldn't reach the server. Check your connection and try again."

class Account {
  state: AccountState = {
    status: cloudConfigured ? 'loading' : 'off', email: null, userId: null, profile: null, message: null,
  }
  private listeners = new Set<() => void>()
  private started: Promise<void> | null = null
  user: User | null = null

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  getState = () => this.state
  private set(p: Partial<AccountState>) { this.state = { ...this.state, ...p }; this.listeners.forEach(l => l()) }

  /** start watching the session (once per page) */
  start(): Promise<void> {
    if (!cloudConfigured) return Promise.resolve()
    this.started ??= (async () => {
      const c = await supabase()
      c.auth.onAuthStateChange((_event, session) => { void this.adopt(session?.user ?? null) })
      const { data } = await c.auth.getSession()
      await this.adopt(data.session?.user ?? null)
    })().catch(() => this.set({ status: 'signed-out', message: OFFLINE }))
    return this.started
  }

  private async adopt(user: User | null) {
    if (user?.id === this.user?.id && this.state.status === 'signed-in') return
    this.user = user
    if (!user) { this.set({ status: 'signed-out', email: null, userId: null, profile: null }); return }
    const profile = await this.loadProfile()
    this.set({ status: 'signed-in', email: user.email ?? null, userId: user.id, profile, message: null, messageField: undefined })
  }

  private async loadProfile(): Promise<Profile | null> {
    const c = await supabase()
    const { data } = await c.from('profiles').select('display_name, role, badge, leaderboard_farm, on_leaderboard').eq('user_id', this.user!.id).maybeSingle()
    return data ? {
      displayName: data.display_name as string, role: data.role as Role, badge: (data.badge as Profile['badge']) ?? null,
      leaderboardFarm: (data.leaderboard_farm as string | null) ?? null, onLeaderboard: (data.on_leaderboard as boolean | null) ?? null,
    } : null
  }

  private fail(message: string, field?: AccountState['messageField']) {
    this.set({ message, messageField: field })
    return false
  }
  clearMessage() { this.set({ message: null, messageField: undefined }) }

  /** a new account: email, password, the name others see, and what it's for. No verification email for now */
  async signUp(o: { email: string; password: string; displayName: string; role: Role }): Promise<boolean> {
    const email = o.email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return this.fail("That doesn't look like an email address.", 'email')
    if (o.password.length < 8) return this.fail('Use at least 8 characters for the password.', 'password')
    if (!o.displayName.trim()) return this.fail('Type the name others will see.', 'name')
    const c = await supabase()
    const { data, error } = await c.functions.invoke('sign-up', { body: { email, password: o.password, displayName: o.displayName.trim(), role: o.role } })
    if (error) {
      // the function answers problems with a message and the field they're about
      let body: { message?: string; field?: AccountState['messageField'] } | null = null
      try { body = await (error as { context?: Response }).context?.json() } catch { /* not JSON: a network problem */ }
      return this.fail(body?.message ?? OFFLINE, body?.field)
    }
    if (!(data as { ok?: boolean })?.ok) return this.fail(OFFLINE)
    return this.signIn(email, o.password)
  }

  async signIn(email: string, password: string): Promise<boolean> {
    const c = await supabase()
    const { data, error } = await c.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      if (/invalid login|invalid credentials/i.test(error.message)) return this.fail('That email and password don’t match an account.', 'password')
      return this.fail(friendly(error))
    }
    await this.adopt(data.user)
    return true
  }

  async changePassword(password: string): Promise<boolean> {
    if (password.length < 8) return this.fail('Use at least 8 characters for the password.', 'password')
    const c = await supabase()
    const { error } = await c.auth.updateUser({ password })
    if (error) return this.fail(/same/i.test(error.message) ? "That's the password you already have." : OFFLINE, 'password')
    this.clearMessage()
    return true
  }

  async signOut(everywhere = false) {
    const c = await supabase()
    await c.auth.signOut({ scope: everywhere ? 'global' : 'local' })
    this.set({ status: 'signed-out' })
  }

  async setRole(role: Role) {
    const c = await supabase()
    const { error } = await c.from('profiles').update({ role }).eq('user_id', this.user!.id)
    if (error) { this.set({ message: "Couldn't save that. Try again." }); return false }
    this.set({ profile: { ...this.state.profile!, role }, message: null })
    return true
  }

  async setDisplayName(name: string) {
    const c = await supabase()
    const clean = name.trim().slice(0, 32)
    if (!clean) return false
    const { error } = await c.from('profiles').update({ display_name: clean }).eq('user_id', this.user!.id)
    if (error) return false
    this.set({ profile: { ...this.state.profile!, displayName: clean } })
    return true
  }

  /** which field counts on the public leaderboard, and whether to be on it at all */
  async setLeaderboard(o: { farm?: string | null; show?: boolean | null }): Promise<boolean> {
    const c = await supabase()
    const patch: Record<string, unknown> = {}
    if (o.farm !== undefined) patch.leaderboard_farm = o.farm
    if (o.show !== undefined) patch.on_leaderboard = o.show
    const { error } = await c.from('profiles').update(patch).eq('user_id', this.user!.id)
    if (error) { this.set({ message: "Couldn't save that. Try again." }); return false }
    this.set({
      profile: {
        ...this.state.profile!,
        ...(o.farm !== undefined ? { leaderboardFarm: o.farm } : {}),
        ...(o.show !== undefined ? { onLeaderboard: o.show } : {}),
      },
    })
    return true
  }

  /** every field of mine in the cloud that could count on the leaderboard */
  async myFarms(): Promise<MyFarm[]> {
    const c = await supabase()
    const { data, error } = await c.from('farms').select('id, name, kind, score').neq('kind', 'demo').order('score', { ascending: false })
    if (error) throw error
    return (data ?? []).map(f => ({ id: f.id, name: f.name, kind: f.kind, score: Number(f.score) }))
  }

  /** the public leaderboard; anyone may read it, signed in or not */
  async globalLeaderboard(limit = 50): Promise<LeaderRow[]> {
    const c = await supabase()
    const { data, error } = await c.rpc('global_leaderboard', { p_limit: limit })
    if (error) throw error
    return ((data ?? []) as Record<string, unknown>[]).map(r => ({
      displayName: r.display_name as string, badge: (r.badge as string | null) ?? null, role: r.role as Role, farmName: r.farm_name as string,
      score: Number(r.score), unlocks: Number(r.unlocks), gold: Number(r.gold), playedSeconds: Number(r.played_seconds), isMe: !!r.is_me,
    }))
  }

  async deleteAccount(): Promise<boolean> {
    const c = await supabase()
    const { error } = await c.functions.invoke('delete-account', { method: 'POST' })
    if (error) { this.set({ message: "Couldn't delete the account. Try again in a minute." }); return false }
    await c.auth.signOut({ scope: 'local' })
    return true
  }

  // ---------- classes

  async myClasses(): Promise<MyClass[]> {
    const c = await supabase()
    const [{ data: classes, error }, { data: mine }] = await Promise.all([
      c.from('classes').select('id, name, code, teacher_id, created_at').order('created_at', { ascending: false }),
      c.from('class_members').select('class_id, display_name').eq('user_id', this.user!.id),
    ])
    if (error) throw error
    const names = new Map((mine ?? []).map(m => [m.class_id as string, m.display_name as string]))
    return (classes ?? []).map(k => ({
      id: k.id, name: k.name, code: k.code, teacherId: k.teacher_id, createdAt: k.created_at,
      teaching: k.teacher_id === this.user!.id, myName: names.get(k.id),
    }))
  }

  async createClass(name: string): Promise<ClassRow> {
    const c = await supabase()
    const { data, error } = await c.rpc('create_class', { p_name: name.trim() })
    if (error) throw new Error(/only teachers/.test(error.message) ? 'Only teacher accounts can open a class.' : /too many/.test(error.message) ? 'You have the most classes an account can have. Delete an old one first.' : "Couldn't open the class. Try again.")
    const k = data as { id: string; name: string; code: string; teacher_id: string; created_at: string }
    return { id: k.id, name: k.name, code: k.code, teacherId: k.teacher_id, createdAt: k.created_at }
  }

  async joinClass(code: string, displayName: string): Promise<{ id: string; name: string }> {
    const c = await supabase()
    const { data, error } = await c.rpc('join_class', { p_code: code.replace(/\s/g, ''), p_display_name: displayName.trim() })
    if (error) {
      throw new Error(/no class/.test(error.message) ? "There's no class with that code. Check it with your teacher."
        : /you teach/.test(error.message) ? "That's your own class. Open it from your classes."
        : /full/.test(error.message) ? 'That class is full.'
        : "Couldn't join. Try again.")
    }
    const row = (data as { id: string; name: string }[])[0]
    return row
  }

  async classById(id: string): Promise<MyClass | null> {
    return (await this.myClasses()).find(k => k.id === id) ?? null
  }

  async members(classId: string): Promise<Member[]> {
    const c = await supabase()
    const { data, error } = await c.from('class_members').select('user_id, display_name, joined_at').eq('class_id', classId).order('display_name')
    if (error) throw error
    return (data ?? []).map(m => ({ userId: m.user_id, displayName: m.display_name, joinedAt: m.joined_at }))
  }

  async leaderboard(classId: string): Promise<Rank[]> {
    const c = await supabase()
    const { data, error } = await c.rpc('class_leaderboard', { p_class: classId })
    if (error) throw error
    return ((data ?? []) as Record<string, unknown>[]).map(r => ({
      userId: r.user_id as string, displayName: r.display_name as string, isTeacher: !!r.is_teacher, isMe: !!r.is_me,
      score: Number(r.score), unlocks: Number(r.unlocks), gold: Number(r.gold), playedSeconds: Number(r.played_seconds),
      updatedAt: (r.updated_at as string | null) ?? null,
    }))
  }

  async renameClass(id: string, name: string) {
    const c = await supabase()
    const { error } = await c.from('classes').update({ name: name.trim() }).eq('id', id)
    if (error) throw error
  }

  async deleteClass(id: string) {
    const c = await supabase()
    const { error } = await c.from('classes').delete().eq('id', id)
    if (error) throw error
  }

  async removeMember(classId: string, userId: string) {
    const c = await supabase()
    const { error } = await c.from('class_members').delete().eq('class_id', classId).eq('user_id', userId)
    if (error) throw error
  }

  // ---------- farms in the cloud

  async personalFarms(): Promise<CloudFarm[]> {
    const c = await supabase()
    const { data, error } = await c.from('farms').select('id, kind, class_id, name, played_seconds, updated_at, score')
      .eq('kind', 'personal').order('updated_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(f => ({ id: f.id, kind: f.kind, classId: f.class_id, name: f.name, playedSeconds: Number(f.played_seconds), updatedAt: f.updated_at, score: Number(f.score) }))
  }

  async deleteFarm(id: string) {
    const c = await supabase()
    const { error } = await c.from('farms').delete().eq('id', id)
    if (error) throw error
  }
}

export function friendly(error: { message: string; name?: string; status?: number }) {
  if (/rate limit|too many/i.test(error.message) || error.status === 429) return 'Too many sign-in emails. Wait a few minutes and try again.'
  if (error.name === 'AuthRetryableFetchError' || !error.status || !navigator.onLine) {
    return "Couldn't reach the server. Check your connection and try again."
  }
  return "Couldn't send the email. Check the address and try again."
}

export const account = new Account()
