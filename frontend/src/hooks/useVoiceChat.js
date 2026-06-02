import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Browser-native voice for Swapna:
 *   - Speech-to-text via Web Speech API (SpeechRecognition)
 *   - Text-to-speech via speechSynthesis
 *
 * Zero backend cost. Works on Chrome / Edge / Safari (incl. mobile).
 * Firefox has no SpeechRecognition support — the mic button hides
 * itself in that case. TTS works everywhere modern.
 *
 * Returned API:
 *   - listening:    true while the mic is open
 *   - speaking:     true while Swapna is reading a reply aloud
 *   - speechSupported: STT available in this browser
 *   - ttsSupported:    TTS available in this browser
 *   - startListening({ onResult, onError, onEnd })
 *   - stopListening()
 *   - speak(text)
 *   - cancelSpeech()
 */
const getSpeechRecognition = () => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

const getSpeechSynthesis = () => {
  if (typeof window === 'undefined') return null;
  return window.speechSynthesis || null;
};

// Strip markdown markers that read awkwardly when spoken aloud. Keep
// the words; drop the punctuation noise.
const cleanForSpeech = (text) =>
  (text || '')
    .replace(/```[\s\S]*?```/g, ' ')              // fenced code blocks
    .replace(/`([^`]+)`/g, '$1')                   // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')       // [link](url) → link
    .replace(/^\s*[-*]\s+/gm, '')                  // bullet markers
    .replace(/[*_~#>]/g, '')                       // emphasis / heading markers
    .replace(/\s+/g, ' ')
    .trim();

export const useVoiceChat = ({ lang = 'en-IN' } = {}) => {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);

  const SR = getSpeechRecognition();
  const synth = getSpeechSynthesis();

  const speechSupported = Boolean(SR);
  const ttsSupported = Boolean(synth);

  // Cancel any in-flight TTS when the hook unmounts so a stale reply
  // doesn't keep talking after the user closes the widget.
  useEffect(() => {
    return () => {
      try {
        synth?.cancel();
      } catch {
        /* ignore */
      }
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, [synth]);

  const startListening = useCallback(
    ({ onResult, onError, onEnd } = {}) => {
      if (!SR) {
        onError?.(new Error('Voice input is not supported in this browser.'));
        return;
      }
      try {
        const rec = new SR();
        rec.lang = lang;
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        rec.continuous = false;

        rec.onresult = (e) => {
          // The first final result is what we want.
          const transcript = e.results?.[0]?.[0]?.transcript || '';
          onResult?.(transcript.trim());
        };
        rec.onerror = (e) => {
          // "no-speech" is a benign timeout — fire onEnd, not onError,
          // so the UI doesn't flash a scary error for silent inputs.
          if (e.error === 'no-speech' || e.error === 'aborted') {
            setListening(false);
            onEnd?.();
            return;
          }
          setListening(false);
          onError?.(new Error(e.error || 'Voice input failed.'));
        };
        rec.onend = () => {
          setListening(false);
          onEnd?.();
        };
        recognitionRef.current = rec;
        rec.start();
        setListening(true);
      } catch (err) {
        setListening(false);
        onError?.(err);
      }
    },
    [SR, lang]
  );

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const speak = useCallback(
    (text) => {
      if (!synth || !text) return;
      const clean = cleanForSpeech(text);
      if (!clean) return;

      // Stop anything currently being said; queueing would let
      // Swapna talk over herself if the user sends rapid messages.
      try {
        synth.cancel();
      } catch {
        /* ignore */
      }

      const u = new SpeechSynthesisUtterance(clean);
      u.lang = lang;
      u.rate = 1.0;
      u.pitch = 1.0;
      u.volume = 1.0;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      utteranceRef.current = u;
      synth.speak(u);
    },
    [synth, lang]
  );

  const cancelSpeech = useCallback(() => {
    try {
      synth?.cancel();
    } catch {
      /* ignore */
    }
    setSpeaking(false);
  }, [synth]);

  return {
    listening,
    speaking,
    speechSupported,
    ttsSupported,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
  };
};

export default useVoiceChat;
