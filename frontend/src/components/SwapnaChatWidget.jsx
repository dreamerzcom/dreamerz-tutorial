import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Send, Mic, MicOff, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { apiUrl } from '../config/api';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { MarkdownContent } from './MarkdownContent';

/**
 * Swapna — DreamerZ help chatbot.
 *
 * Floating bottom-right button that opens a slide-in chat panel.
 * Renders globally (mounted in App.js) so it's accessible from every
 * page except a few we explicitly hide it on (admin, journey player).
 *
 * Text + voice in both directions:
 *   - text:   type → Send → fetch /api/swapna/chat → render reply
 *   - voice in: mic → SpeechRecognition → fills the text box
 *   - voice out: when "auto-speak" is on, every reply is read aloud
 *                via speechSynthesis
 *
 * State is local to the widget — chat history doesn't persist across
 * page reloads. (Persistence + history sync would be a future
 * enhancement; the current model treats every session as fresh.)
 */
const STORAGE_KEY = 'swapna:auto_speak';

const WELCOME = {
  role: 'assistant',
  content:
    "Hi! I'm Swapna, your DreamerZ helper. Ask me about courses, how to sign up, or how to find anything on the site. You can also tap the mic to talk.",
};

// Routes where the widget should stay hidden — admin, journey player
// (lesson reading is already busy), and the trial-expired page.
const HIDE_ON_PATTERNS = [
  /^\/admin($|\/)/,
  /^\/learn\/[^/]+\/[^/]+$/, // /learn/<category>/<course> — the journey player
  /^\/trial-expired/,
];

const shouldHideOnRoute = (pathname) =>
  HIDE_ON_PATTERNS.some((re) => re.test(pathname));

export const SwapnaChatWidget = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [autoSpeak, setAutoSpeak] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage?.getItem(STORAGE_KEY) === '1';
  });
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const {
    listening,
    speaking,
    speechSupported,
    ttsSupported,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
  } = useVoiceChat({ lang: 'en-IN' });

  // Auto-scroll to the latest message whenever messages change.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // Focus the input when the panel opens.
  useEffect(() => {
    if (open) {
      // Tiny delay lets the animation finish before focus jumps the page.
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Persist the auto-speak preference.
  useEffect(() => {
    try {
      window.localStorage?.setItem(STORAGE_KEY, autoSpeak ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [autoSpeak]);

  // Stop any in-flight TTS when the panel closes.
  useEffect(() => {
    if (!open) {
      cancelSpeech();
      stopListening();
    }
  }, [open, cancelSpeech, stopListening]);

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = (text || '').trim();
      if (!trimmed || sending) return;

      setError(null);
      const userTurn = { role: 'user', content: trimmed };
      const nextMessages = [...messages, userTurn];
      setMessages(nextMessages);
      setInput('');
      setSending(true);

      try {
        // Send the last 10 turns as history. The welcome message is
        // metadata for the user — never replay it to the model.
        const history = nextMessages
          .filter((m) => m !== WELCOME)
          .slice(-10, -1) // exclude the just-added user turn
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch(apiUrl('/api/swapna/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed, history }),
        });

        if (res.status === 429) {
          throw new Error("You're sending messages too quickly. Wait a moment.");
        }
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        const data = await res.json();
        const reply = (data?.reply || '').trim();
        if (!reply) throw new Error('Empty reply from Swapna.');

        setMessages((m) => [...m, { role: 'assistant', content: reply }]);
        if (autoSpeak && ttsSupported) {
          speak(reply);
        }
      } catch (e) {
        setError(e.message || 'Could not reach Swapna.');
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content:
              "I couldn't reach the server. Try again in a moment, or email dreamerz.support@gmail.com if it persists.",
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [messages, sending, autoSpeak, ttsSupported, speak]
  );

  const handleMicClick = useCallback(() => {
    if (listening) {
      stopListening();
      return;
    }
    if (speaking) cancelSpeech();
    startListening({
      onResult: (transcript) => {
        if (transcript) {
          // Auto-send voice messages — feels more natural than
          // requiring a second tap.
          sendMessage(transcript);
        }
      },
      onError: (err) => {
        setError(err?.message || 'Voice input failed.');
      },
    });
  }, [listening, speaking, stopListening, cancelSpeech, startListening, sendMessage]);

  const toggleAutoSpeak = useCallback(() => {
    setAutoSpeak((v) => {
      const next = !v;
      if (!next) cancelSpeech();
      return next;
    });
  }, [cancelSpeech]);

  if (shouldHideOnRoute(location.pathname)) return null;

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Swapna help chat"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-primary text-white rounded-full shadow-xl shadow-primary/30 px-4 py-3 hover:bg-primary/90 transition-all"
        >
          <Sparkles className="w-5 h-5" />
          <span className="font-semibold text-sm hidden sm:inline">Ask Swapna</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Swapna help chat"
          className="fixed bottom-0 right-0 sm:bottom-5 sm:right-5 z-50 w-full sm:w-96 h-[80vh] sm:h-[600px] sm:max-h-[80vh] bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 sm:rounded-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary to-indigo-500 text-white">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-sm leading-tight">Swapna</h2>
                <p className="text-[11px] text-white/80 leading-tight truncate">
                  DreamerZ help assistant
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {ttsSupported && (
                <button
                  type="button"
                  onClick={toggleAutoSpeak}
                  title={autoSpeak ? 'Voice replies on' : 'Voice replies off'}
                  aria-pressed={autoSpeak}
                  className="p-2 rounded-lg hover:bg-white/15"
                >
                  {autoSpeak ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4 opacity-60" />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="p-2 rounded-lg hover:bg-white/15"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50 dark:bg-slate-950"
          >
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-primary text-white rounded-br-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-sm'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <MarkdownContent variant="light">{m.content}</MarkdownContent>
                  ) : (
                    <p className="whitespace-pre-wrap m-0">{m.content}</p>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                    <span
                      className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: '120ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: '240ms' }}
                    />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Error strip */}
          {error && (
            <div className="bg-rose-50 border-t border-rose-200 text-rose-700 text-xs px-3 py-1.5">
              {error}
            </div>
          )}

          {/* Input bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="flex items-center gap-1.5 px-2 py-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            {speechSupported && (
              <button
                type="button"
                onClick={handleMicClick}
                title={listening ? 'Stop listening' : 'Speak'}
                aria-pressed={listening}
                className={`p-2 rounded-lg ${
                  listening
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                listening ? 'Listening…' : 'Ask Swapna anything about DreamerZ'
              }
              disabled={sending || listening}
              maxLength={2000}
              className="flex-1 bg-transparent text-sm px-2 py-2 outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
              aria-label="Type your question"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="p-2 rounded-lg bg-primary text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default SwapnaChatWidget;
