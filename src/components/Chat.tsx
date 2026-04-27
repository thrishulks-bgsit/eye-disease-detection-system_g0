import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getHealthAssistantResponse } from '../services/aiService';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your Eye Health Assistant. How can I help you today? I can explain eye conditions, symptoms, and provide prevention tips.",
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await getHealthAssistantResponse(input, messages);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900">Health Assistant</h4>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI Powered</span>
            </div>
          </div>
        </div>
        <Sparkles className="w-5 h-5 text-blue-400" />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3 mb-4">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Disclaimer:</strong> This assistant provides general information only. It cannot diagnose conditions or prescribe treatments. Always seek professional medical advice.
          </p>
        </div>

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  msg.sender === 'user' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  msg.sender === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-100' 
                    : 'bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100'
                }`}>
                  {msg.text}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {loading && (
          <div className="flex justify-start">
            <div className="flex gap-3 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="text-xs text-slate-500 font-medium">Assistant is thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-6 border-t border-slate-100">
        <div className="relative flex items-center gap-3">
          <input
            type="text"
            placeholder="Ask about eye health, symptoms, or precautions..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white p-4 rounded-2xl transition-all shadow-lg shadow-blue-100"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
