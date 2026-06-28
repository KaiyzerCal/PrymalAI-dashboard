import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Mic, MicOff, Volume2, VolumeX, Send, ChevronDown, Trash2, Settings } from 'lucide-react'
import { supabase, FUNCTION_BASE } from '@/lib/supabase'

function needsReconnect(text: string): boolean {
  return /settings.*integrations|go to settings|not connected|reconnect/i.test(text)
}

function isCorruptedMessage(content: unknown): boolean {
  if (typeof content !== 'string') return false
  const corruptionPatterns = [
    /agent\s+capabilities\s+updated/i,
    /complete\s+working\s+implementations/i,
    /all\s+tiers\s+now\s+have/i,
  ]
  return corruptionPatterns.some(pattern => pattern.test(content))
}

function isValidMessage(msg: unknown): msg is Message {
  if (!msg || typeof msg !== 'object') return false
  if (!('role' in msg) || !('content' in msg)) return false
  if (typeof msg.content !== 'string' || typeof msg.role !== 'string') return false
  if (msg.role !== 'user' && msg.role !== 'assistant') return false
  if (isCorruptedMessage(msg.content)) return false
  return true
}

function isValidHistory(history: unknown): history is Message[] {
  return Array.isArray(history) && history.every(isValidMessage)
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  _isError?: boolean
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

export function ChatWidget() {
  const INITIAL_MESSAGE: Message = { role: 'assistant', content: 'Hi — I\'m Prymal. Ask me anything about your agents, approvals, emails, or calendar. I can also take actions on your behalf.' }
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<Message[]>([])
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [listening, setListening] = useState(false)
  const [unread, setUnread] = useState(0)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const saved = sessionStorage.getItem('prymal_chat_messages')
    const savedHistory = sessionStorage.getItem('prymal_chat_history')

    if (saved) {
      try {
        const msgs = JSON.parse(saved)

        // Validate messages: all messages must be valid, including no corruption
        if (isValidHistory(msgs)) {
          // All messages valid, safe to load
          setMessages(msgs)
          if (savedHistory) {
            try {
              const hist = JSON.parse(savedHistory)
              if (isValidHistory(hist)) {
                setHistory(hist)
              }
            } catch {
              // History parsing failed, ignore it
            }
          }
        } else {
          // Any message invalid → clear everything
          sessionStorage.removeItem('prymal_chat_messages')
          sessionStorage.removeItem('prymal_chat_history')
          setMessages([INITIAL_MESSAGE])
          setHistory([])
        }
      } catch {
        // JSON parse failed, clear storage
        sessionStorage.removeItem('prymal_chat_messages')
        sessionStorage.removeItem('prymal_chat_history')
        setMessages([INITIAL_MESSAGE])
      }
    }

    setInitialized(true)
  }, [])

  useEffect(() => {
    if (!initialized) return
    // Only save messages that don't have the error flag to sessionStorage
    const displayMessages = messages.filter(m => !m._isError)
    sessionStorage.setItem('prymal_chat_messages', JSON.stringify(displayMessages))
  }, [messages, initialized])

  useEffect(() => {
    if (!initialized) return
    // Validate history before saving
    if (isValidHistory(history)) {
      sessionStorage.setItem('prymal_chat_history', JSON.stringify(history))
    }
  }, [history, initialized])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) setUnread(0)
  }, [open])

  function initRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return null
    const r: ISpeechRecognition = new SR()
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
    sessionStorage.removeItem('prymal_chat_messages')
    sessionStorage.removeItem('prymal_chat_history')
    setMessages([INITIAL_MESSAGE])
    setHistory([])
  }

  async function send() {
    const msg = input.trim()
    if (!msg || loading) return

    setInput('')
    const userMsg: Message = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${FUNCTION_BASE}/prymal-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ message: msg, history }),
      })

      // Check HTTP status first
      if (!res.ok) {
        const errMsg = `Server error (HTTP ${res.status})`
        setMessages(prev => [...prev, { role: 'assistant', content: errMsg, _isError: true }])
        setLoading(false)
        return
      }

      const text = await res.text()
      let data: Record<string, unknown> = {}
      try {
        data = JSON.parse(text)
      } catch {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Invalid response from server', _isError: true }])
        setLoading(false)
        return
      }

      // Must have 'reply' field for successful response
      if (!('reply' in data)) {
        const error = (data.error as string) ?? 'Unknown error'
        setMessages(prev => [...prev, { role: 'assistant', content: error, _isError: true }])
        setLoading(false)
        return
      }

      const reply = data.reply as string
      if (typeof reply !== 'string') {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Invalid response format', _isError: true }])
        setLoading(false)
        return
      }

      // Only successful AI responses go into history
      const assistantMsg: Message = { role: 'assistant', content: reply }
      setMessages(prev => [...prev, assistantMsg])
      setHistory(prev => {
        const updated = [...prev, userMsg, assistantMsg]
        return updated.slice(-20)
      })
      speak(reply)
      if (!open) setUnread(prev => prev + 1)
    } catch (err) {
      const errMsg = `Connection error: ${(err as Error).message}`
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg, _isError: true }])
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
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 48px rgba(0,212,255,0.35), 0 4px 24px rgba(0,0,0,0.6)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 32px rgba(0,212,255,0.2), 0 4px 24px rgba(0,0,0,0.6)' }}
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
                title="Clear chat"
                style={{ color: 'rgba(255,255,255,0.3)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(239,68,68,0.7)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)' }}
              >
                <Trash2 size={15} />
              </button>
              <button
                onClick={toggleTts}
                className="p-1.5 rounded-lg transition-all"
                title={ttsEnabled ? 'Mute agent voice' : 'Enable agent voice'}
                style={{ color: ttsEnabled ? '#00d4ff' : 'rgba(255,255,255,0.3)' }}
              >
                {ttsEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg transition-all"
                style={{ color: 'rgba(255,255,255,0.3)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)' }}
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {messages.map((m, i) => (
              <div key={i} className="flex flex-col" style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div
                  className="px-3.5 py-2.5 rounded-xl text-sm leading-relaxed"
                  style={
                    m.role === 'user'
                      ? {
                          background: 'linear-gradient(135deg, rgba(0,212,255,0.22) 0%, rgba(0,212,255,0.1) 100%)',
                          border: '1px solid rgba(0,212,255,0.3)',
                          color: '#e0f7ff',
                          borderBottomRightRadius: '4px',
                        }
                      : {
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          color: 'rgba(255,255,255,0.85)',
                          borderBottomLeftRadius: '4px',
                        }
                  }
                >
                  {m.content}
                </div>
                {m.role === 'assistant' && needsReconnect(m.content) && (
                  <button
                    onClick={() => { setOpen(false); navigate('/settings') }}
                    className="mt-1.5 flex items-center gap-1.5 self-start text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
                    style={{
                      background: 'rgba(0,212,255,0.08)',
                      border: '1px solid rgba(0,212,255,0.25)',
                      color: '#00d4ff',
                    }}
                  >
                    <Settings size={11} />
                    Go to Integrations
                  </button>
                )}
              </div>
            ))}
            {loading && (
              <div
                className="self-start px-3.5 py-2.5 rounded-xl text-sm"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  color: 'rgba(0,212,255,0.5)',
                  borderBottomLeftRadius: '4px',
                  fontStyle: 'italic',
                }}
              >
                Thinking…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div
            className="flex items-end gap-2 px-3 py-3 flex-shrink-0"
            style={{ borderTop: '1px solid rgba(0,212,255,0.08)' }}
          >
            <button
              onClick={toggleMic}
              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              title={listening ? 'Stop listening' : 'Speak'}
              style={
                listening
                  ? { background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)', color: '#f87171' }
                  : { background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)', color: 'rgba(0,212,255,0.6)' }
              }
            >
              {listening ? <MicOff size={15} /> : <Mic size={15} />}
            </button>

            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask Prymal anything…"
              rows={1}
              className="flex-1 resize-none rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none transition-all"
              style={{
                background: 'rgba(0,212,255,0.04)',
                border: '1px solid rgba(0,212,255,0.1)',
                maxHeight: '80px',
                lineHeight: '1.5',
              }}
              onFocus={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.3)' }}
              onBlur={e => { e.currentTarget.style.border = '1px solid rgba(0,212,255,0.1)' }}
            />

            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
              style={{
                background: 'linear-gradient(135deg, rgba(0,212,255,0.25) 0%, rgba(0,212,255,0.1) 100%)',
                border: '1px solid rgba(0,212,255,0.35)',
                color: '#00d4ff',
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
  )
}
