/**
 * AuraFinance // Speech Recognition & Synthesis Engine (speech.js)
 * Wraps browser Web Speech APIs for hands-free operations.
 */

class SpeechEngine {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.isVoiceEnabled = localStorage.getItem('aura_voice_feedback') !== 'false';
    
    this.initRecognition();
  }

  /**
   * Safe initialization of browser speech recognition
   */
  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech API (Speech Recognition) is not supported in this browser.");
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false; // Stop listening after one phrase
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
  }

  /**
   * Check browser speech recognition compatibility
   */
  isSpeechSupported() {
    return this.recognition !== null;
  }

  /**
   * Start listening for voice input
   */
  startListening(onResult, onEnd, onError) {
    if (!this.isSpeechSupported()) {
      onError("Speech Recognition not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (this.isListening) {
      this.stopListening();
    }

    this.isListening = true;

    this.recognition.onresult = (event) => {
      if (event.results && event.results[0]) {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
      }
    };

    this.recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      this.isListening = false;
      onError(event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      onEnd();
    };

    try {
      this.recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      this.isListening = false;
      onError(err.message);
    }
  }

  /**
   * Force stop the speech capture
   */
  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  /**
   * Text-to-Speech audio response synthesis
   */
  speak(text) {
    if (!this.isVoiceEnabled) return;
    if (!('speechSynthesis' in window)) {
      console.warn("Speech Synthesis is not supported in this browser.");
      return;
    }

    // Cancel current speaking queues
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05; // Slightly faster for responsiveness
    utterance.pitch = 1.0;
    
    // Choose a high quality female voice if available, or defaults
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.startsWith('en') && 
      (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Zira'))
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Toggle vocal feedback states
   */
  toggleVoiceFeedback() {
    this.isVoiceEnabled = !this.isVoiceEnabled;
    localStorage.setItem('aura_voice_feedback', this.isVoiceEnabled);
    return this.isVoiceEnabled;
  }
}

// Instantiate global speech controller
const speechController = new SpeechEngine();
// Force load voices cache (browser async lazy-load safeguard)
if ('speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
