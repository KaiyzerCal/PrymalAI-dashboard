import React, { useState, useEffect, useRef } from 'react'
import { MessageSquare, Mic, MicOff, Volume2, VolumeX, Send, ChevronDown, Trash2 } from 'lucide-react'
import { supabase, FUNCTION_BASE } from '@/lib/supabase'

type MessageRole = 'user' | 'assistant'

interface ChatMessage {
  role: MessageRole
  content: string
}

interface DisplayMessage extends ChatMessage {
  isError?: boolean
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition
    webkitSpeechRecognition: new () => ISpeechRecognition
  }
}

// Render markdown to React elements — supports images, bold, links, lists, code
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  function parseInline(s: string): React.ReactNode[] {
    const parts: React.ReactNode[] = []
    // Pattern: images ![alt](url), links [text](url), bold **text**, code `text`
    const re = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|(\*\*[^*]+\*\*)|(```[\s\S]*?```|`[^`]+`)/g
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) parts.push(s.slice(last, m.index))
      if (m[1] !== undefined) {
        // Image
        parts.push(
          <img
            key={m.index}
            src={m[2]}
            alt={m[1]}
            style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '6px', display: 'block' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )
      } else if (m[3] !== undefined) {
        // Link
        parts.push(
          <a key={m.index} href={m[4]} target="_blank" rel="noopener noreferrer"
            style={{ color: '#00d4ff', textDecoration: 'underline' }}>
            {m[3]}
          </a>
        )
      } else if (m[5] !== undefined) {
        // Bold
        parts.push(<strong key={m.index}>{m[5].replace(/\*\*/g, '')}</strong>)
      } else if (m[6] !== undefined) {
        // Code
        parts.push(
          <code key={m.index}
            style={{ background: 'rgba(0,212,255,0.1)', padding: '1px 4px', borderRadius: '3px', fontSize: '0.85em' }}>
            {m[6].replace(/^```[\w]*\n?|```$|^`|`$/g, '')}
          </code>
        )
      }
      last = m.index + m[0].length
    }
    if (last < s.length) parts.push(s.slice(last))
    return parts
  }

  while (i < lines.length) {
    const line = lines[i]
    // Heading
    if (line.startsWith('### ')) {
      elements.push(<p key={i} style={{ fontWeight: 700, fontSize: '0.9em', marginTop: '8px', color: '#00d4ff' }}>{parseInline(line.slice(4))}</p>)
    } else if (line.startsWith('## ')) {
      elements.push(<p key={i} style={{ fontWeight: 700, fontSize: '0.95em', marginTop: '8px', color: '#00d4ff' }}>{parseInline(line.slice(3))}</p>)
    } else if (line.startsWith('# ')) {
      elements.push(<p key={i} style={{ fontWeight: 700, marginTop: '8px', color: '#00d4ff' }}>{parseInline(line.slice(2))}</p>)
    // List item
    } else if (/^[-*] /.test(line)) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
          <span style={{ color: '#00d4ff', flexShrink: 0 }}>•</span>
          <span>{parseInline(line.slice(2))}</span>
        </div>
      )
    } else if (/^\d+\. /.test(line)) {
      const num = line.match(/^(\d+)\. /)![1]
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
          <span style={{ color: '#00d4ff', flexShrink: 0 }}>{num}.</span>
          <span>{parseInline(line.replace(/^\d+\. /, ''))}</span>
        </div>
      )
    // Horizontal rule
    } else if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid rgba(0,212,255,0.15)', margin: '6px 0' }} />)
    // Empty line
    } else if (line.trim() === '') {
      if (elements.length > 0) elements.push(<div key={i} style={{ height: '4px' }} />)
    // Normal text
    } else {
      elements.push(<p key={i} style={{ margin: 0 }}>{parseInline(line)}</p>)
    }
    i++
  }

  return <>{elements}</>
}

const INITIAL_MESSAGE: DisplayMessage = {
  role: 'assistant',
  content: 'Hi — I\'m Prymal. Ask me anything about your agents, approvals, emails, or calendar. I can also take actions on your behalf.',
}

const CORRUPTION_PATTERNS = [
  'agent capabilities updated',
  'complete working implementations',
  'all tiers now have',
]

function hasCorruptedContent(text: string): boolean {
  const lower = text.toLowerCase()
  return CORRUPTION_PATTERNS.some(pattern => lower.includes(pattern))
}

function isBadMessage(msg: unknown): boolean {
  if (!msg || typeof msg !== 'object') return true
  if (!('role' in msg) || !('content' in msg)) return true
  if (typeof msg.content !== 'string' || typeof msg.role !== 'string') return true
  if (msg.role !== 'user' && msg.role !== 'assistant') return true
  if (hasCorruptedContent(msg.content)) return true
  return false
}

function loadSavedHistory(): ChatMessage[] {
  try {
    const saved = sessionStorage.getItem('prymal_chat_history')
    if (!saved) return []
    const parsed = JSON.parse(saved)
    if (!Array.isArray(parsed)) return []
    // Reject if ANY message is bad
    if (parsed.some(isBadMessage)) {
      sessionStorage.removeItem('prymal_chat_history')
      return []
    }
    return parsed
  } catch {
    sessionStorage.removeItem('prymal_chat_history')
    return []
  }
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([INITIAL_MESSAGE])
  const [history, setHistory] = useState<ChatMessage[]>(loadSavedHistory())
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [listening, setListening] = useState(false)
  const [unread, setUnread] = useState(0)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Save history to storage whenever it changes
  useEffect(() => {
    if (history.length > 0) {
      sessionStorage.setItem('prymal_chat_history', JSON.stringify(history))
    }
  }, [history])

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayMessages])

  // Clear unread when opened
  useEffect(() => {
    if (open) setUnread(0)
  }, [open])

  function initRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return null
    const r = new SR()
    r.continuous = false
    r.interimResults = false
    r.lang = 'en-US'
    r.onresult = (e: SpeechRecognitionEvent) => {
      const t = e.results[0][0].transcript
      setInput(prev => (prev ? prev + ' ' : '') + t)
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    return r
  }

  function toggleMic() {
    if (!recognitionRef.current) recognitionRef.current = initRecognition()
    if (!recognitionRef.current) {
      alert('Speech recognition requires Chrome or Edge.')
      return
    }
    if (listening) {
      recognitionRef.current.stop()
    } else {
      recognitionRef.current.start()
      setListening(true)
    }
  }

  function speak(text: string) {
    if (!ttsEnabled || !text) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 1.05
    window.speechSynthesis.speak(utt)
  }

  function toggleTts() {
    setTtsEnabled(prev => {
      if (prev) window.speechSynthesis.cancel()
      return !prev
    })
  }

  function clearChat() {
    sessionStorage.removeItem('prymal_chat_history')
    setDisplayMessages([INITIAL_MESSAGE])
    setHistory([])
  }

  async function send() {
    const msg = input.trim()
    if (!msg || loading) return

    setInput('')

    // Add user message to UI
    const userDisplayMsg: DisplayMessage = { role: 'user', content: msg }
    setDisplayMessages(prev => [...prev, userDisplayMsg])

    // Add user message to history
    const userHistoryMsg: ChatMessage = { role: 'user', content: msg }
    const newHistory = [...history, userHistoryMsg].slice(-20)
    setHistory(newHistory)

    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const res = await fetch(`${FUNCTION_BASE}/prymal-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: msg,
          history: newHistory,
        }),
      })

      // Handle HTTP errors
      if (!res.ok) {
        const errorMsg = `Server error (HTTP ${res.status})`
        setDisplayMessages(prev => [...prev, { role: 'assistant', content: errorMsg, isError: true }])
        setLoading(false)
        return
      }

      // Parse response
      let data: unknown
      try {
        data = await res.json()
      } catch {
        const errorMsg = 'Invalid response from server'
        setDisplayMessages(prev => [...prev, { role: 'assistant', content: errorMsg, isError: true }])
        setLoading(false)
        return
      }

      // Validate response structure
      if (!data || typeof data !== 'object' || !('reply' in data)) {
        const error = (data as Record<string, unknown>)?.error ?? 'Unknown error'
        const errorMsg = typeof error === 'string' ? error : 'Server error'
        setDisplayMessages(prev => [...prev, { role: 'assistant', content: errorMsg, isError: true }])
        setLoading(false)
        return
      }

      const reply = (data as Record<string, unknown>).reply
      if (typeof reply !== 'string') {
        const errorMsg = 'Invalid response format'
        setDisplayMessages(prev => [...prev, { role: 'assistant', content: errorMsg, isError: true }])
        setLoading(false)
        return
      }

      // SUCCESS: Add AI response to both display and history
      const assistantDisplayMsg: DisplayMessage = { role: 'assistant', content: reply }
      setDisplayMessages(prev => [...prev, assistantDisplayMsg])

      const assistantHistoryMsg: ChatMessage = { role: 'assistant', content: reply }
      setHistory(prev => [...prev, assistantHistoryMsg].slice(-20))

      speak(reply)
      if (!open) setUnread(prev => prev + 1)
    } catch (err) {
      const errorMsg = `Connection error: ${(err as Error).message}`
      setDisplayMessages(prev => [...prev, { role: 'assistant', content: errorMsg, isError: true }])
    }

    setLoading(false)
    inputRef.current?.focus()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.25) 0%, rgba(0,212,255,0.08) 100%)',
            border: '1px solid rgba(0,212,255,0.4)',
            boxShadow: '0 0 32px rgba(0,212,255,0.2), 0 4px 24px rgba(0,0,0,0.6)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = '0 0 48px rgba(0,212,255,0.35), 0 4px 24px rgba(0,0,0,0.6)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = '0 0 32px rgba(0,212,255,0.2), 0 4px 24px rgba(0,0,0,0.6)'
          }}
        >
          <MessageSquare size={22} style={{ color: '#00d4ff' }} />
          {unread > 0 && (
            <span
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: '#00d4ff', color: '#060b14' }}
            >
              {unread}
            </span>
          )}
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl overflow-hidden"
          style={{
            width: '400px',
            height: '560px',
            background: 'rgba(6,11,20,0.97)',
            border: '1px solid rgba(0,212,255,0.15)',
            boxShadow: '0 0 60px rgba(0,212,255,0.12), 0 24px 64px rgba(0,0,0,0.8)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(0,212,255,0.08)' }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: '#00d4ff', boxShadow: '0 0 6px #00d4ff', animation: 'pulse-dot 2s infinite' }}
              />
              <span className="text-xs font-bold tracking-widest" style={{ color: '#00d4ff' }}>PRYMAL AI</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="p-1.5 rounded-lg transition-all"
                style={{ color: '#00d4ff' }}
                title="Clear chat"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={toggleTts}
                className="p-1.5 rounded-lg transition-all"
                style={{ color: ttsEnabled ? '#00d4ff' : 'rgba(0,212,255,0.5)' }}
                title={ttsEnabled ? 'Disable TTS' : 'Enable TTS'}
              >
                {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg transition-all"
                style={{ color: '#00d4ff' }}
                title="Close chat"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>

          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
            style={{
              background: 'rgba(0,0,0,0.2)',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(0,212,255,0.3) transparent',
            }}
          >
            {displayMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{
                    maxWidth: msg.role === 'user' ? '75%' : '88%',
                    background: msg.role === 'user'
                      ? 'rgba(0,212,255,0.2)'
                      : msg.isError
                      ? 'rgba(255,100,100,0.2)'
                      : 'rgba(0,212,255,0.1)',
                    color: msg.isError ? '#ff6464' : msg.role === 'user' ? '#00d4ff' : '#fff',
                    borderLeft: msg.isError ? '2px solid #ff6464' : 'none',
                    lineHeight: '1.5',
                  }}
                >
                  {msg.role === 'assistant' && !msg.isError
                    ? renderMarkdown(msg.content)
                    : msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 text-sm text-gray-400">Thinking...</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div
            className="px-4 py-3 flex gap-2 flex-shrink-0 items-end"
            style={{ borderTop: '1px solid rgba(0,212,255,0.08)' }}
          >
            <button
              onClick={toggleMic}
              disabled={loading}
              className="p-2 rounded-lg transition-all flex-shrink-0"
              style={{
                color: listening ? '#00d4ff' : 'rgba(0,212,255,0.5)',
                cursor: !loading ? 'pointer' : 'not-allowed',
              }}
              title={listening ? 'Stop listening' : 'Start listening'}
            >
              {listening ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask me anything..."
              className="flex-1 bg-transparent text-sm text-white resize-none focus:outline-none"
              style={{ color: '#fff', maxHeight: '100px' }}
              disabled={loading}
              rows={1}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="p-2 rounded-lg transition-all flex-shrink-0"
              style={{
                color: input.trim() && !loading ? '#00d4ff' : 'rgba(0,212,255,0.3)',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              }}
              title="Send message"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
