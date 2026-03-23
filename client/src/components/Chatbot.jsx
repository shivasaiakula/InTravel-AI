import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X, User, Bot, Mic, MicOff, Sparkles } from 'lucide-react';
import './Chatbot.css';

const QUICK_REPLIES = [
  'Best time to visit Goa?',
  'Budget trip to Ladakh',
  'Honeymoon in Kerala',
  'Top hidden gems in India',
];

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "Namaste! 🙏 I'm your AI Travel Assistant. Ask me anything about India travel — itineraries, weather, budget tips, or hidden gems!", sender: 'bot' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text = input) => {
    if (!text.trim()) return;
    const userMsg = { text, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await axios.post('/api/ai/chat', { message: text });
      setMessages(prev => [...prev, { text: data.reply, sender: 'bot' }]);
    } catch (error) {
      // Smart local fallback responses
      const fallbacks = [
        `Great question about ${text.split(' ')[0]}! The best time to visit most of India is October to March, when the weather is pleasant across all regions.`,
        `For a budget trip, I recommend staying in guesthouses (₹500-1500/night), eating at local dhabas, and using trains for inter-city travel. This can cut costs by 60%!`,
        `Some hidden gems in India include Spiti Valley (HP), Hampi (Karnataka), Ziro Valley (Arunachal), and Chopta (Uttarakhand). Want to know more about any of these?`,
      ];
      const reply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      setMessages(prev => [...prev, { text: reply, sender: 'bot' }]);
    }
    setLoading(false);
  };

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Voice not supported in this browser'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
    };
    recognition.start();
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  return (
    <>
      {/* Toggle Button */}
      <motion.button
        className={`chat-toggle ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <AnimatePresence mode="wait">
          {isOpen
            ? <motion.span key="x" initial={{ rotate: -90 }} animate={{ rotate: 0 }}><X size={24} /></motion.span>
            : <motion.span key="msg" initial={{ rotate: 90 }} animate={{ rotate: 0 }}><MessageCircle size={26} /></motion.span>
          }
        </AnimatePresence>
      </motion.button>

      {/* Unread dot */}
      {!isOpen && (
        <div className="chat-unread-dot" />
      )}

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="chat-container glass-card"
            initial={{ opacity: 0, y: 50, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            {/* Header */}
            <div className="chat-header">
              <div className="chat-header-left">
                <div className="chat-avatar"><Bot size={18} /></div>
                <div>
                  <h3>AI Travel Assistant</h3>
                  <span className="chat-status"><span className="status-dot" /> Online</span>
                </div>
              </div>
              <button className="chat-close" onClick={() => setIsOpen(false)}><X size={18} /></button>
            </div>

            {/* Messages */}
            <div className="chat-messages">
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  className={`message ${msg.sender}-msg`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                >
                  <div className="msg-icon">
                    {msg.sender === 'user' ? <User size={13} /> : <Bot size={13} />}
                  </div>
                  <div className="msg-text">{msg.text}</div>
                </motion.div>
              ))}
              {loading && (
                <div className="message bot-msg">
                  <div className="msg-icon"><Bot size={13} /></div>
                  <div className="msg-text typing-indicator">
                    <span /><span /><span />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Replies */}
            {messages.length < 3 && (
              <div className="quick-replies">
                {QUICK_REPLIES.map(q => (
                  <button key={q} className="quick-reply" onClick={() => handleSend(q)}>{q}</button>
                ))}
              </div>
            )}

            {/* Input Area */}
            <div className="chat-input-area">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask about India travel..."
              />
              <button
                className={`voice-btn ${listening ? 'listening' : ''}`}
                onClick={listening ? stopVoice : startVoice}
                title="Voice Input"
              >
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button disabled={loading || !input.trim()} onClick={() => handleSend()} className="send-btn">
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
