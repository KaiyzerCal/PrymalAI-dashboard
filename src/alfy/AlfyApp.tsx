// The collapsed Alfy web surface: three screens plus settings, per the
// "three screens, no more" spec. Wired to the live tables and approval flow.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, FUNCTION_BASE } from '@/lib/supabase'
import { useClient } from '@/hooks/useClient'
import './alfy.css'

type Tab = 'today' | 'handled' | 'knows'

interface Approval {
	id: string
	action_type: string
	summary: string
	draft_content: string
	status: string
	created_at: string
	approved_content: string | null
	batch_id: string | null
}
interface Contact {
	id: string
	contact_name: string | null
	contact_email: string
	context_summary: string | null
	birthday: string | null
	last_interaction: string | null
}
interface Standing {
	id: string
	goal_text: string
	status: string
	created_at: string
	last_run_at: string | null
	last_result: string | null
}

const ACTION_LABELS: Record<string, string> = {
	send_email: 'Email',
	create_event: 'Calendar',
	respond_to_review: 'Review reply',
	book_reservation: 'Reservation',
	book_appointment: 'Appointment',
	book_flight: 'Flight',
	pay_bill: 'Bill',
	drive_report: 'Report',
	social_post: 'Post',
}

function when(iso: string) {
	const d = new Date(iso)
	const today = new Date()
	const sameDay = d.toDateString() === today.toDateString()
	const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
	return sameDay ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`
}

export function AlfyApp() {
	const { tab: tabParam } = useParams()
	const navigate = useNavigate()
	const tab: Tab = tabParam === 'handled' || tabParam === 'knows' ? tabParam : 'today'
	const { client, update } = useClient()

	const [pending, setPending] = useState<Approval[]>([])
	const [done, setDone] = useState<Approval[]>([])
	const [people, setPeople] = useState<Contact[]>([])
	const [standing, setStanding] = useState<Standing[]>([])
	const [about, setAbout] = useState('')
	const [aboutSaved, setAboutSaved] = useState(false)
	const [busy, setBusy] = useState<string | null>(null)
	const [settingsOpen, setSettingsOpen] = useState(false)
	const [editing, setEditing] = useState<string | null>(null)
	const [editText, setEditText] = useState('')

	const load = useCallback(async () => {
		if (!client) return
		const [p, d, c, s] = await Promise.all([
			supabase.from('prymal_approval_queue').select('*').eq('client_id', client.id)
				.eq('status', 'pending').order('created_at', { ascending: false }).limit(30),
			supabase.from('prymal_approval_queue').select('*').eq('client_id', client.id)
				.neq('status', 'pending').order('created_at', { ascending: false }).limit(30),
			supabase.from('prymal_contact_memory').select('*').eq('client_id', client.id)
				.order('last_interaction', { ascending: false, nullsFirst: false }).limit(50),
			supabase.from('prymal_standing_instructions').select('*').eq('client_id', client.id)
				.neq('status', 'cancelled').order('created_at', { ascending: false }),
		])
		setPending((p.data as Approval[]) ?? [])
		setDone((d.data as Approval[]) ?? [])
		setPeople((c.data as Contact[]) ?? [])
		setStanding((s.data as Standing[]) ?? [])
	}, [client])

	useEffect(() => { load() }, [load])
	useEffect(() => { setAbout(client?.knowledge_base ?? '') }, [client])

	// Answer by text, watch it update here
	useEffect(() => {
		if (!client) return
		const ch = supabase
			.channel('alfy-queue')
			.on('postgres_changes',
				{ event: '*', schema: 'public', table: 'prymal_approval_queue', filter: `client_id=eq.${client.id}` },
				() => load())
			.subscribe()
		return () => { supabase.removeChannel(ch) }
	}, [client, load])

	async function resolve(id: string, replyText: string) {
		setBusy(id)
		const { data: { session } } = await supabase.auth.getSession()
		await fetch(`${FUNCTION_BASE}/prymal-approval-flow`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${session?.access_token}`,
			},
			body: JSON.stringify({ approval_id: id, reply_text: replyText }),
		})
		setBusy(null)
		setEditing(null)
		load()
	}

	async function revoke(id: string) {
		await supabase.from('prymal_standing_instructions').update({ status: 'cancelled' }).eq('id', id)
		load()
	}

	async function saveAbout() {
		await update({ knowledge_base: about })
		setAboutSaved(true)
		setTimeout(() => setAboutSaved(false), 2000)
	}

	const brief = pending.length
		? `${pending.length === 1 ? 'One thing needs' : `${pending.length} things need`} your yes${standing.filter(s => s.status === 'active').length ? `, and I'm watching ${standing.filter(s => s.status === 'active').length} more` : ''}.`
		: "Nothing needs your yes right now. I'll text you when something does."

	return (
		<div className="alfy">
			<header style={{ background: 'var(--card)', borderBottom: '1px solid var(--hairline)' }}>
				<div style={{ maxWidth: '48rem', margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
					<span className="display" style={{ fontSize: '1.25rem' }}>AskAlfy</span>
					<button className="btn btn-ghost" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(o => !o)}>
						Settings
					</button>
				</div>
				<nav style={{ maxWidth: '48rem', margin: '0 auto', padding: '0 1.5rem', display: 'flex', gap: '0.25rem' }} aria-label="Screens">
					{(['today', 'handled', 'knows'] as Tab[]).map(t => (
						<button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => navigate(`/alfy/${t}`)}>
							{t === 'today' ? 'Today' : t === 'handled' ? 'Handled' : 'Alfy knows'}
						</button>
					))}
				</nav>
			</header>

			<main style={{ maxWidth: '48rem', margin: '0 auto', padding: '2rem 1.5rem', display: 'grid', gap: '1.25rem' }}>
				{settingsOpen && (
					<section className="card" aria-label="Settings">
						<p className="label">Settings</p>
						<div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.9375rem' }}>
							<span>Connections, billing, and your phone number live in the <a href="/dashboard/settings">full settings page</a>.</span>
							<span style={{ color: 'var(--secondary)' }}>Cancel any time — one click there, or just text Alfy "cancel".</span>
						</div>
					</section>
				)}

				{tab === 'today' && (
					<>
						<section className="card">
							<p className="label">The brief</p>
							<p style={{ margin: '0.75rem 0 0' }}>{brief}<br /><span style={{ color: 'var(--secondary)' }}>— A</span></p>
						</section>

						{pending.map(item => (
							<section key={item.id} className="card">
								<p className="label">{ACTION_LABELS[item.action_type] ?? item.action_type}</p>
								<h2 className="h2" style={{ marginTop: '0.5rem' }}>{item.summary}</h2>
								<p style={{ background: 'var(--linen)', border: '1px solid var(--hairline)', borderRadius: '1rem', padding: '0.75rem 1rem', color: 'var(--secondary)', whiteSpace: 'pre-wrap' }}>
									{item.draft_content}
								</p>
								{editing === item.id ? (
									<div style={{ display: 'grid', gap: '0.5rem' }}>
										<textarea rows={4} value={editText} onChange={e => setEditText(e.target.value)} />
										<div style={{ display: 'flex', gap: '0.5rem' }}>
											<button className="btn btn-primary" disabled={busy === item.id} onClick={() => resolve(item.id, `EDIT ${editText}`)}>Send edited</button>
											<button className="btn btn-ghost" onClick={() => setEditing(null)}>Back</button>
										</div>
									</div>
								) : (
									<div style={{ display: 'flex', gap: '0.5rem' }}>
										<button className="btn btn-primary" disabled={busy === item.id} onClick={() => resolve(item.id, 'APPROVE')}>
											{busy === item.id ? 'Working…' : 'Approve'}
										</button>
										<button className="btn btn-outline" disabled={busy === item.id} onClick={() => { setEditing(item.id); setEditText(item.draft_content) }}>Edit</button>
										<button className="btn btn-ghost" disabled={busy === item.id} onClick={() => resolve(item.id, 'REJECT')}>Skip</button>
									</div>
								)}
							</section>
						))}

						{standing.filter(s => s.status === 'active').length > 0 && (
							<section className="card">
								<p className="label">Watching</p>
								<ul style={{ margin: '0.75rem 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: '0.5rem', color: 'var(--secondary)' }}>
									{standing.filter(s => s.status === 'active').map(s => (
										<li key={s.id}>{s.goal_text}</li>
									))}
								</ul>
							</section>
						)}
					</>
				)}

				{tab === 'handled' && (
					<section className="card">
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
							<p className="label">Handled</p>
							{done.length > 0 && (
								<p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
									{done.length} handled · {done.filter(r => r.status === 'approved').length} with your yes
								</p>
							)}
						</div>
						{done.length === 0 && <p style={{ color: 'var(--secondary)' }}>Nothing here yet — approvals you give will show up as plain-language receipts.</p>}
						<ul style={{ margin: '0.5rem 0 0', padding: 0, listStyle: 'none' }}>
							{done.map(row => (
								<li key={row.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.875rem 0', borderBottom: '1px solid var(--hairline)', alignItems: 'flex-start' }}>
									<span className="check" aria-hidden="true">
										{row.status === 'approved' ? (
											<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
										) : (
											<svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
										)}
									</span>
									<div>
										<p style={{ margin: 0 }}>{row.summary}</p>
										<p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--muted)' }}>
											{row.status === 'approved' ? 'you approved' : 'you skipped'}, {when(row.created_at)}
										</p>
									</div>
								</li>
							))}
						</ul>
					</section>
				)}

				{tab === 'knows' && (
					<>
						<section className="card">
							<p className="label">People</p>
							{people.length === 0 && <p style={{ color: 'var(--secondary)' }}>As you and Alfy work together, the people who matter show up here in plain words.</p>}
							<ul style={{ margin: '0.5rem 0 0', padding: 0, listStyle: 'none' }}>
								{people.map(p => (
									<li key={p.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--hairline)' }}>
										<strong>{p.contact_name ?? p.contact_email}</strong>
										{p.context_summary && <span style={{ color: 'var(--secondary)' }}> — {p.context_summary}</span>}
										{p.birthday && <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}> · birthday {p.birthday}</span>}
									</li>
								))}
							</ul>
						</section>

						<section className="card" style={{ background: 'var(--fern-tint)', borderColor: 'rgba(78,125,104,0.25)' }}>
							<p className="label" style={{ color: 'var(--fern)' }}>Trust</p>
							<ul style={{ margin: '0.75rem 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: '0.75rem' }}>
								{standing.map(s => (
									<li key={s.id}>
										{s.goal_text}
										<span style={{ color: 'var(--secondary)' }}> — since {new Date(s.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} · </span>
										<button className="btn btn-ghost" style={{ minHeight: 'auto', padding: 0, textDecoration: 'underline', color: 'var(--fern)' }} onClick={() => revoke(s.id)}>revoke</button>
									</li>
								))}
								<li style={{ color: 'var(--secondary)' }}>Everything else waits for your yes.</li>
							</ul>
						</section>

						<section className="card">
							<label className="label" htmlFor="alfy-about">Tell Alfy about yourself</label>
							<textarea id="alfy-about" rows={4} style={{ marginTop: '0.75rem' }} value={about}
								placeholder="Plain words. Anything that helps — who matters, what you always forget, how you like things done."
								onChange={e => setAbout(e.target.value)} />
							<div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
								<button className="btn btn-primary" onClick={saveAbout}>Save</button>
								{aboutSaved && <span style={{ color: 'var(--fern)', fontSize: '0.8125rem' }}>Saved — Alfy will remember.</span>}
							</div>
						</section>
					</>
				)}
			</main>
		</div>
	)
}
