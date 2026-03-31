import React, { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  Image as ImageIcon,
  Download,
  Sparkles,
  FileText,
  Volume2,
  Megaphone,
  Copy,
  Check,
  ArrowRight,
  Menu,
  X,
  ExternalLink,
  Share2,
  Moon,
  Sun,
  History,
  MessageSquare,
  Upload,
  Trash2,
  Mic,
  MicOff,
  FileSearch,
  Code,
  Type as TypeIcon,
  FileUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const OPENROUTER_MODEL = "google/gemini-2.0-flash-001";

type Tab = 'chat' | 'vision' | 'insight' | 'voice' | 'ads' | 'doc' | 'code' | 'grammar';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  image?: string;
  timestamp: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('aura-dark-mode');
    return saved ? JSON.parse(saved) : true;
  });

  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('aura-chat-history');
    return saved ? JSON.parse(saved) : [];
  });
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const [visionPrompt, setVisionPrompt] = useState('');
  const [visionResult, setVisionResult] = useState<string | null>(null);
  const [isVisionLoading, setIsVisionLoading] = useState(false);
  const [isImageRendering, setIsImageRendering] = useState(false);

  const [insightText, setInsightText] = useState('');
  const [insightResult, setInsightResult] = useState<string | null>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);

  const [voiceText, setVoiceText] = useState('');
  const [voiceAudio, setVoiceAudio] = useState<string | null>(null);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [adProduct, setAdProduct] = useState('');
  const [adDesc, setAdDesc] = useState('');
  const [adResults, setAdResults] = useState<any[]>([]);
  const [adCampaignImage, setAdCampaignImage] = useState<string | null>(null);
  const [lastAdInfo, setLastAdInfo] = useState<{ product: string, desc: string } | null>(null);
  const [isAdsLoading, setIsAdsLoading] = useState(false);
  const [isAdImageLoading, setIsAdImageLoading] = useState(false);

  const [docFile, setDocFile] = useState<{ name: string, data: string, mimeType: string } | null>(null);
  const [docQuestion, setDocQuestion] = useState('');
  const [docResult, setDocResult] = useState<string | null>(null);
  const [isDocLoading, setIsDocLoading] = useState(false);

  const [codeText, setCodeText] = useState('');
  const [codeResult, setCodeResult] = useState<string | null>(null);
  const [isCodeLoading, setIsCodeLoading] = useState(false);

  const [grammarText, setGrammarText] = useState('');
  const [grammarResult, setGrammarResult] = useState<string | null>(null);
  const [isGrammarLoading, setIsGrammarLoading] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    localStorage.setItem('aura-chat-history', JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    localStorage.setItem('aura-dark-mode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleChat = async () => {
    if (!chatInput.trim() && !uploadedImage) return;

    const userMessage: Message = {
      role: 'user',
      text: chatInput,
      image: uploadedImage || undefined,
      timestamp: Date.now()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setUploadedImage(null);
    setIsChatLoading(true);

    try {
      const messages = chatMessages.map(msg => ({
        role: msg.role,
        content: msg.image
          ? [
            { type: "text", text: msg.text || "এই ছবিটি সম্পর্কে বলুন।" },
            { type: "image_url", image_url: { url: msg.image } }
          ]
          : msg.text
      }));

      messages.push({
        role: "user",
        content: uploadedImage
          ? [
            { type: "text", text: chatInput || "এই ছবিটি সম্পর্কে বলুন।" },
            { type: "image_url", image_url: { url: uploadedImage } }
          ]
          : chatInput
      });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, model: OPENROUTER_MODEL })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "সমস্যা হয়েছে");

      const assistantMessage: Message = {
        role: 'assistant',
        text: data.choices[0].message.content || "দুঃখিত, আমি বুঝতে পারিনি।",
        timestamp: Date.now()
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      showToast(err.message || "সমস্যা হয়েছে", 'error');
    } finally {
      setIsChatLoading(false);
    }
  };

  const clearChat = () => {
    setChatMessages([]);
    showToast('✓ চ্যাট হিস্ট্রি মুছে ফেলা হয়েছে', 'success');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('আপনার ব্রাউজার ভয়েস ইনপুট সাপোর্ট করে না', 'error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'bn-BD';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setIsListening(true);
      showToast('শুনছি... কথা বলুন', 'success');
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      setChatInput(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        showToast('মাইক্রোফোন পারমিশন দেওয়া নেই।', 'error');
      } else {
        showToast('ভয়েস ইনপুটে সমস্যা হয়েছে', 'error');
      }
    };

    recognition.onend = () => { setIsListening(false); };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const generateAudioBlob = async (text: string) => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "TTS Error");

      const base64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return createWavBlob(bytes, 24000);
      }
    } catch (err: any) {
      console.error("TTS Generation Error:", err);
    }
    return null;
  };

  const speakText = async (text: string) => {
    showToast('AI কথা বলছে...', 'success');
    const wavBlob = await generateAudioBlob(text);
    if (wavBlob) {
      const url = URL.createObjectURL(wavBlob);
      const audio = new Audio(url);
      audio.play();
    } else {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'bn-BD';
      window.speechSynthesis.speak(utterance);
    }
  };

  const downloadVoiceAudio = async (text: string) => {
    showToast('অডিও ফাইল তৈরি হচ্ছে...', 'success');
    const wavBlob = await generateAudioBlob(text);
    if (wavBlob) {
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aura-voice-${Date.now()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('✓ ডাউনলোড শুরু হয়েছে', 'success');
    } else {
      showToast('অডিও ডাউনলোডে সমস্যা হয়েছে', 'error');
    }
  };

  const createWavBlob = (pcmData: Uint8Array, sampleRate: number) => {
    const buffer = new ArrayBuffer(44 + pcmData.length);
    const view = new DataView(buffer);
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + pcmData.length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, pcmData.length, true);
    const pcmView = new Uint8Array(buffer, 44);
    pcmView.set(pcmData);
    return new Blob([buffer], { type: 'audio/wav' });
  };

  const handleShare = async (title: string, text: string, url?: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (err) {
        console.error("Share error:", err);
      }
    } else {
      copyToClipboard(url || text);
      showToast('লিঙ্ক কপি করা হয়েছে', 'success');
    }
  };

  // ✅ FIXED: Image generation - server always returns base64, never a raw URL
  const generateImage = async (retryCount = 0) => {
    if (!visionPrompt.trim()) return showToast('ইমেজের বর্ণনা লিখুন', 'error');
    setIsVisionLoading(true);
    setIsImageRendering(true);
    if (retryCount === 0) setVisionResult(null);

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: visionPrompt })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ইমেজ তৈরি করতে সমস্যা হয়েছে।");

      // ✅ Server now always returns base64 — check for it first
      if (data.imageBase64) {
        const mimeType = data.mimeType || 'image/png';
        setVisionResult(`data:${mimeType};base64,${data.imageBase64}`);
        showToast('✓ ইমেজ জেনারেট সম্পন্ন!', 'success');
        return;
      }

      // Legacy: inline parts from Gemini/HuggingFace
      if (data.candidates?.[0]?.content?.parts) {
        for (const part of data.candidates[0].content.parts) {
          if (part.inlineData?.data && part.inlineData.data.length > 100) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            setVisionResult(`data:${mimeType};base64,${part.inlineData.data}`);
            showToast('✓ ইমেজ জেনারেট সম্পন্ন!', 'success');
            return;
          }
        }
      }

      throw new Error("ইমেজ ডাটা পাওয়া যায়নি। আবার চেষ্টা করুন।");

    } catch (err: any) {
      console.error("Image generation error:", err);
      setIsImageRendering(false);

      if ((err.message?.includes('429') || err.status === 429) && retryCount < 2) {
        const delay = (retryCount + 1) * 5000;
        showToast(`লিমিট শেষ হয়েছে, ${delay / 1000} সেকেন্ড পর আবার চেষ্টা হচ্ছে...`, 'error');
        await new Promise(resolve => setTimeout(resolve, delay));
        return generateImage(retryCount + 1);
      }

      showToast(err.message || "ইমেজ তৈরি করতে সমস্যা হয়েছে।", 'error');
    } finally {
      setIsVisionLoading(false);
    }
  };

  const generateSummary = async () => {
    if (insightText.length < 30) return showToast('কমপক্ষে ৩০ অক্ষরের টেক্সট দিন', 'error');
    setIsInsightLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Summarize this text in Bengali. Be clear and accurate:\n\n${insightText}` }],
          model: OPENROUTER_MODEL
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "সমস্যা হয়েছে");
      setInsightResult(data.choices[0].message.content);
      showToast('✓ সারমর্ম তৈরি সম্পন্ন!', 'success');
    } catch (err: any) {
      showToast(err.message || "সমস্যা হয়েছে", 'error');
    } finally {
      setIsInsightLoading(false);
    }
  };

  const generateVoice = () => {
    if (!voiceText.trim()) return showToast('টেক্সট লিখুন', 'error');
    setIsVoiceLoading(true);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(voiceText);
    const voices = window.speechSynthesis.getVoices();
    const bnVoice = voices.find(v => v.lang.includes('bn') || v.name.includes('Bengali'));
    if (bnVoice) utterance.voice = bnVoice;
    utterance.onend = () => {
      setIsVoiceLoading(false);
      showToast('✓ ভয়েস সম্পন্ন!', 'success');
    };
    utterance.onerror = () => {
      setIsVoiceLoading(false);
      showToast('ভয়েস তৈরিতে সমস্যা হয়েছে', 'error');
    };
    window.speechSynthesis.speak(utterance);
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDocFile({
          name: file.name,
          data: (reader.result as string).split(',')[1],
          mimeType: file.type
        });
        showToast(`✓ ${file.name} আপলোড হয়েছে`, 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeDoc = async () => {
    if (!docFile) return showToast('প্রথমে একটি ফাইল আপলোড করুন', 'error');
    if (!docQuestion.trim()) return showToast('আপনার প্রশ্ন লিখুন', 'error');
    setIsDocLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: [
              { type: "text", text: `Based on the provided document, answer this question in Bengali: ${docQuestion}` },
              { type: "image_url", image_url: { url: `data:${docFile.mimeType};base64,${docFile.data}` } }
            ]
          }],
          model: OPENROUTER_MODEL
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "সমস্যা হয়েছে");
      setDocResult(data.choices[0].message.content);
      showToast('✓ অ্যানালাইসিস সম্পন্ন!', 'success');
    } catch (err: any) {
      showToast(err.message || "সমস্যা হয়েছে", 'error');
    } finally {
      setIsDocLoading(false);
    }
  };

  const handleCodeAction = async (action: 'fix' | 'explain' | 'optimize') => {
    if (!codeText.trim()) return showToast('কোড লিখুন', 'error');
    setIsCodeLoading(true);
    const prompts = {
      fix: `Fix any errors in this code and provide the corrected version with a brief explanation in Bengali:\n\n${codeText}`,
      explain: `Explain this code step-by-step in Bengali:\n\n${codeText}`,
      optimize: `Optimize this code for better performance and explain the changes in Bengali:\n\n${codeText}`
    };
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompts[action] }],
          model: OPENROUTER_MODEL
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "সমস্যা হয়েছে");
      setCodeResult(data.choices[0].message.content);
      showToast('✓ সম্পন্ন!', 'success');
    } catch (err: any) {
      showToast(err.message || "সমস্যা হয়েছে", 'error');
    } finally {
      setIsCodeLoading(false);
    }
  };

  const checkGrammar = async () => {
    if (!grammarText.trim()) return showToast('টেক্সট লিখুন', 'error');
    setIsGrammarLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Check and fix the grammar and spelling of this text (Bengali or English). Provide the corrected version and a brief explanation of the fixes in Bengali:\n\n${grammarText}` }],
          model: OPENROUTER_MODEL
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "সমস্যা হয়েছে");
      setGrammarResult(data.choices[0].message.content);
      showToast('✓ গ্রামার চেক সম্পন্ন!', 'success');
    } catch (err: any) {
      showToast(err.message || "সমস্যা হয়েছে", 'error');
    } finally {
      setIsGrammarLoading(false);
    }
  };

  const generateAds = async (retryCount = 0) => {
    if (!adProduct.trim()) return showToast('পণ্যের নাম দিন', 'error');
    setIsAdsLoading(true);
    setIsAdImageLoading(true);
    if (retryCount === 0) {
      setAdResults([]);
      setAdCampaignImage(null);
    }
    setLastAdInfo({ product: adProduct, desc: adDesc });

    try {
      const textPromise = fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Generate 4 professional ad variants for ${adProduct}. Description: ${adDesc}. Mix Bengali and English naturally. Focus on high conversion. Return ONLY a JSON object with a "variants" array containing objects with "type", "text", and "cta" fields.` }],
          model: OPENROUTER_MODEL
        })
      }).then(res => res.json());

      const imagePromise = fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `Create a professional, high-quality commercial advertisement hero image for ${adProduct}. Context: ${adDesc}` })
      }).then(res => res.json());

      const [textData, imageData] = await Promise.all([textPromise, imagePromise]);

      const rawText = textData.choices[0].message.content;
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const data = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
      setAdResults(data.variants);

      // ✅ Handle new imageBase64 format
      if (imageData.imageBase64) {
        const mimeType = imageData.mimeType || 'image/png';
        setAdCampaignImage(`data:${mimeType};base64,${imageData.imageBase64}`);
      } else if (imageData.candidates?.[0]?.content?.parts) {
        for (const part of imageData.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            setAdCampaignImage(`data:image/png;base64,${part.inlineData.data}`);
            break;
          }
        }
      }

      showToast('✓ বিজ্ঞাপন ও ইমেজ তৈরি সম্পন্ন!', 'success');
    } catch (err: any) {
      console.error("Ad generation error:", err);
      if ((err.message?.includes('429') || err.status === 429) && retryCount < 1) {
        showToast("লিমিট শেষ হয়েছে, কিছুক্ষণ পর আবার চেষ্টা হচ্ছে...", 'error');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return generateAds(retryCount + 1);
      }
      showToast(err.message || "সমস্যা হয়েছে", 'error');
    } finally {
      setIsAdsLoading(false);
      setIsAdImageLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('✓ কপি হয়েছে', 'success');
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
      showToast('✓ ডাউনলোড শুরু হয়েছে', 'success');
    } catch (err) {
      window.open(url, '_blank');
      showToast('ডাউনলোড করতে সমস্যা হয়েছে, নতুন ট্যাবে ওপেন করা হলো', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-bg text-foreground selection:bg-accent/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center shadow-lg shadow-accent/20">
            <Sparkles className="text-white" size={18} />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-foreground">Aura <span className="text-accent">AI</span></span>
        </div>

        <div className="hidden md:flex items-center gap-6">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-lg bg-surface-2 border border-border text-foreground/70 hover:text-foreground transition-all"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <a href="#features" className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors">ফিচার</a>
          <a href="#pricing" className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors">মূল্য</a>
          <button className="px-5 py-2 rounded-lg border border-border text-sm font-medium text-foreground/70 hover:border-accent hover:text-accent transition-all">লগইন</button>
          <button className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-bold shadow-lg shadow-accent/20 hover:scale-105 transition-all">ফ্রি শুরু করুন</button>
        </div>

        <div className="flex items-center gap-4 md:hidden">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-lg bg-surface-2 border border-border text-foreground/70"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="text-foreground/70" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-bg pt-24 px-6 md:hidden"
          >
            <div className="flex flex-col gap-6">
              <a href="#features" className="text-xl font-medium" onClick={() => setIsMenuOpen(false)}>ফিচার</a>
              <a href="#pricing" className="text-xl font-medium" onClick={() => setIsMenuOpen(false)}>মূল্য</a>
              <button className="w-full py-4 rounded-xl border border-border text-lg font-medium">লগইন</button>
              <button className="w-full py-4 rounded-xl bg-accent text-white text-lg font-bold">ফ্রি শুরু করুন</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-accent/10 blur-[120px] rounded-full -z-10" />
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold uppercase tracking-widest mb-8"
          >
            <Sparkles size={14} />
            Premium AI Productivity Suite
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-8xl font-display font-extrabold leading-[1.1] tracking-tight mb-8 text-foreground"
          >
            আপনার সৃজনশীলতাকে <br />
            <span className="grad-text">Aura AI</span> দিয়ে <br />
            নতুন মাত্রা দিন
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-foreground/70 max-w-2xl mx-auto mb-12 font-light leading-relaxed"
          >
            ইমেজ জেনারেশন, স্মার্ট সামারি, ভয়েস সিন্থেসিস এবং অ্যাড জেনারেশন — সব একটি প্ল্যাটফর্মে।
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-4"
          >
            <button className="px-8 py-4 rounded-xl bg-accent text-white font-bold text-lg shadow-xl shadow-accent/20 hover:scale-105 transition-all flex items-center gap-2">
              এখনই ব্যবহার করুন <ArrowRight size={20} />
            </button>
            <button className="px-8 py-4 rounded-xl border border-border text-lg font-medium hover:bg-white/5 transition-all">
              প্ল্যান দেখুন
            </button>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 max-w-6xl mx-auto">
        <div className="mb-16">
          <p className="text-accent text-xs font-bold uppercase tracking-[0.3em] mb-4">AI Tools</p>
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">শক্তিশালী AI ফিচারসমূহ</h2>
          <p className="text-muted text-lg max-w-xl font-light">আপনার প্রোডাক্টিভিটি বাড়াতে Aura AI-এর সব টুলস ব্যবহার করুন।</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { id: 'chat', label: '💬 Chat', icon: MessageSquare },
            { id: 'vision', label: '🎨 Art', icon: ImageIcon },
            { id: 'doc', label: '📄 Doc AI', icon: FileSearch },
            { id: 'code', label: '💻 Code', icon: Code },
            { id: 'grammar', label: '✍️ Grammar', icon: TypeIcon },
            { id: 'insight', label: '📝 Insight', icon: FileText },
            { id: 'voice', label: '🔊 Voice', icon: Volume2 },
            { id: 'ads', label: '📣 AdGen', icon: Megaphone },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                ? 'bg-accent text-white shadow-lg shadow-accent/20'
                : 'bg-surface border border-border text-foreground/60 hover:text-foreground hover:border-accent/50'
                }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tool Panels */}
        <div className="glass rounded-3xl p-8 card-glow">
          <AnimatePresence mode="wait">
            {activeTab === 'chat' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col h-[600px]"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                    <History size={18} className="text-accent" /> চ্যাট হিস্ট্রি
                  </h3>
                  <button onClick={clearChat} className="text-xs text-accent-3 hover:underline flex items-center gap-1">
                    <Trash2 size={14} /> হিস্ট্রি মুছুন
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 custom-scrollbar">
                  {chatMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-muted space-y-4">
                      <MessageSquare size={48} className="opacity-20" />
                      <p className="text-foreground/50">আজকের দিনটি কেমন কাটছে? কিছু জিজ্ঞাসা করুন।</p>
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] p-4 rounded-2xl space-y-2 ${msg.role === 'user'
                        ? 'bg-accent text-white rounded-tr-none'
                        : 'bg-surface-2 border border-border rounded-tl-none'
                        }`}>
                        {msg.image && (
                          <img src={msg.image} alt="Uploaded" className="rounded-lg max-h-48 w-auto mb-2" />
                        )}
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                        {msg.role === 'assistant' && (
                          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                            <button onClick={() => speakText(msg.text)} className="p-1.5 rounded-lg hover:bg-white/10 transition-all" title="শুনুন">
                              <Volume2 size={14} />
                            </button>
                            <button onClick={() => downloadVoiceAudio(msg.text)} className="p-1.5 rounded-lg hover:bg-white/10 transition-all" title="অডিও ডাউনলোড">
                              <Download size={14} />
                            </button>
                            <button onClick={() => copyToClipboard(msg.text)} className="p-1.5 rounded-lg hover:bg-white/10 transition-all" title="কপি">
                              <Copy size={14} />
                            </button>
                            <button onClick={() => handleShare('Aura AI Response', msg.text)} className="p-1.5 rounded-lg hover:bg-white/10 transition-all" title="শেয়ার">
                              <Share2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-surface-2 border border-border p-4 rounded-2xl rounded-tl-none">
                        <Loader2 className="animate-spin text-accent" size={18} />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="space-y-4">
                  {uploadedImage && (
                    <div className="relative inline-block">
                      <img src={uploadedImage} alt="Preview" className="h-20 w-20 object-cover rounded-xl border border-accent" />
                      <button onClick={() => setUploadedImage(null)} className="absolute -top-2 -right-2 bg-accent-3 text-white rounded-full p-1">
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  <div className="relative flex items-center gap-2">
                    <label className="p-4 rounded-xl bg-surface-2 border border-border text-muted hover:text-white cursor-pointer transition-all">
                      <Upload size={20} />
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                    <button
                      onClick={toggleListening}
                      className={`p-4 rounded-xl border transition-all ${isListening
                        ? 'bg-accent-3 border-accent-3 text-white animate-pulse'
                        : 'bg-surface-2 border-border text-muted hover:text-white'
                        }`}
                      title={isListening ? 'থামান' : 'ভয়েস ইনপুট'}
                    >
                      {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                      placeholder={isListening ? "শুনছি..." : "আপনার প্রশ্ন লিখুন..."}
                      className="flex-1 bg-bg border border-border rounded-xl p-4 text-sm focus:outline-none focus:border-accent"
                    />
                    <button
                      onClick={handleChat}
                      disabled={isChatLoading || (!chatInput.trim() && !uploadedImage)}
                      className="p-4 rounded-xl bg-accent text-white disabled:opacity-50 transition-all"
                    >
                      <ArrowRight size={20} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'vision' && (
              <motion.div
                key="vision"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <textarea
                    value={visionPrompt}
                    onChange={(e) => setVisionPrompt(e.target.value)}
                    placeholder="ইমেজের বর্ণনা লিখুন... যেমন: 'সূর্যাস্তের আলোয় পাহাড়ের পাদদেশে একটি ছোট ঘর'"
                    className="w-full bg-bg border border-border rounded-2xl p-6 text-lg focus:outline-none focus:border-accent transition-all min-h-[120px]"
                  />
                </div>
                <button
                  onClick={generateImage}
                  disabled={isVisionLoading}
                  className="w-full md:w-auto px-10 py-4 rounded-xl bg-accent text-white font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  {isVisionLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
                  ইমেজ তৈরি করুন
                </button>

                {visionResult && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 space-y-4">
                    <div className="relative group aspect-square max-w-2xl bg-surface-2 rounded-2xl overflow-hidden border border-border shadow-2xl">
                      {isImageRendering && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg/90 z-20 backdrop-blur-md">
                          <div className="relative">
                            <Loader2 className="animate-spin text-accent mb-4" size={48} />
                            <div className="absolute inset-0 animate-ping bg-accent/20 rounded-full" />
                          </div>
                          <p className="text-sm font-bold text-accent animate-pulse text-center px-4">
                            হাই-কোয়ালিটি ইমেজ তৈরি হচ্ছে... <br />
                            <span className="text-[10px] text-muted font-normal">এতে ১ মিনিট পর্যন্ত সময় লাগতে পারে।</span>
                          </p>
                        </div>
                      )}
                      <img
                        src={visionResult}
                        alt="Generated"
                        className={`w-full h-full object-contain transition-opacity duration-700 ${isImageRendering ? 'opacity-0' : 'opacity-100'}`}
                        onLoad={() => setIsImageRendering(false)}
                        onError={() => {
                          setIsImageRendering(false);
                          showToast('ইমেজ লোড করতে সমস্যা হয়েছে', 'error');
                          setVisionResult(null);
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <button
                        onClick={() => downloadImage(visionResult, 'aura-vision.png')}
                        className="px-6 py-3 rounded-xl bg-surface-2 border border-border text-sm font-medium flex items-center gap-2 hover:border-accent-2 transition-all"
                      >
                        <Download size={16} /> PNG ডাউনলোড
                      </button>
                      <button
                        onClick={() => handleShare('Aura AI Art', 'Check out this image generated by Aura AI!', visionResult)}
                        className="px-6 py-3 rounded-xl bg-surface-2 border border-border text-sm font-medium flex items-center gap-2 hover:border-accent-2 transition-all"
                      >
                        <Share2 size={16} /> শেয়ার
                      </button>
                      <a
                        href={visionResult}
                        target="_blank"
                        rel="noreferrer"
                        className="px-6 py-3 rounded-xl bg-surface-2 border border-border text-sm font-medium flex items-center gap-2 hover:border-accent-2 transition-all"
                      >
                        <ExternalLink size={16} /> নতুন ট্যাবে দেখুন
                      </a>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {activeTab === 'doc' && (
              <motion.div
                key="doc"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-8 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-accent transition-all cursor-pointer relative">
                      <FileUp size={40} className="text-muted" />
                      <p className="text-sm text-muted">{docFile ? docFile.name : 'PDF বা Text ফাইল আপলোড করুন'}</p>
                      <input type="file" accept=".pdf,.txt" onChange={handleDocUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                    <textarea
                      value={docQuestion}
                      onChange={(e) => setDocQuestion(e.target.value)}
                      placeholder="ফাইল সম্পর্কে আপনার প্রশ্ন লিখুন..."
                      className="w-full bg-bg border border-border rounded-xl p-4 text-sm focus:outline-none focus:border-accent min-h-[100px]"
                    />
                    <button
                      onClick={analyzeDoc}
                      disabled={isDocLoading || !docFile}
                      className="w-full px-10 py-4 rounded-xl bg-accent text-white font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-50"
                    >
                      {isDocLoading ? <Loader2 className="animate-spin" /> : <FileSearch size={18} />}
                      অ্যানালাইসিস করুন
                    </button>
                  </div>
                  <div className="bg-bg border border-border rounded-2xl p-6 min-h-[300px] overflow-y-auto">
                    <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">Analysis Result</h4>
                    {docResult ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{docResult}</p>
                    ) : (
                      <p className="text-sm text-muted italic">ফাইল আপলোড করে প্রশ্ন করলে এখানে উত্তর দেখা যাবে।</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'code' && (
              <motion.div
                key="code"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <textarea
                      value={codeText}
                      onChange={(e) => setCodeText(e.target.value)}
                      placeholder="এখানে আপনার কোড পেস্ট করুন..."
                      className="w-full bg-bg border border-border rounded-xl p-4 text-sm font-mono focus:outline-none focus:border-accent min-h-[300px]"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => handleCodeAction('fix')} disabled={isCodeLoading} className="flex-1 px-4 py-3 rounded-xl bg-accent-3 text-white text-xs font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-50">
                        {isCodeLoading ? <Loader2 className="animate-spin size-3" /> : <Code size={14} />} Fix Errors
                      </button>
                      <button onClick={() => handleCodeAction('explain')} disabled={isCodeLoading} className="flex-1 px-4 py-3 rounded-xl bg-accent-2 text-white text-xs font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-50">
                        {isCodeLoading ? <Loader2 className="animate-spin size-3" /> : <FileSearch size={14} />} Explain
                      </button>
                      <button onClick={() => handleCodeAction('optimize')} disabled={isCodeLoading} className="flex-1 px-4 py-3 rounded-xl bg-accent-4 text-black text-xs font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-50">
                        {isCodeLoading ? <Loader2 className="animate-spin size-3" /> : <Sparkles size={14} />} Optimize
                      </button>
                    </div>
                  </div>
                  <div className="bg-bg border border-border rounded-2xl p-6 min-h-[300px] overflow-y-auto">
                    <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">Result</h4>
                    {codeResult ? (
                      <div className="space-y-4">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono">{codeResult}</p>
                        <button onClick={() => copyToClipboard(codeResult)} className="px-4 py-2 rounded-lg bg-surface-2 border border-border text-xs font-medium flex items-center gap-2 hover:border-accent transition-all">
                          <Copy size={14} /> Copy Result
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted italic">কোড লিখে অ্যাকশন বাটনে ক্লিক করলে এখানে আউটপুট দেখা যাবে।</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'grammar' && (
              <motion.div
                key="grammar"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <textarea
                      value={grammarText}
                      onChange={(e) => setGrammarText(e.target.value)}
                      placeholder="এখানে আপনার টেক্সট লিখুন (বাংলা বা ইংরেজি)..."
                      className="w-full bg-bg border border-border rounded-xl p-4 text-sm focus:outline-none focus:border-accent min-h-[200px]"
                    />
                    <button onClick={checkGrammar} disabled={isGrammarLoading} className="w-full px-10 py-4 rounded-xl bg-accent text-white font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-50">
                      {isGrammarLoading ? <Loader2 className="animate-spin" /> : <TypeIcon size={18} />}
                      গ্রামার চেক করুন
                    </button>
                  </div>
                  <div className="bg-bg border border-border rounded-2xl p-6 min-h-[200px] overflow-y-auto">
                    <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">Corrected Text</h4>
                    {grammarResult ? (
                      <div className="space-y-4">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{grammarResult}</p>
                        <button onClick={() => copyToClipboard(grammarResult)} className="px-4 py-2 rounded-lg bg-surface-2 border border-border text-xs font-medium flex items-center gap-2 hover:border-accent transition-all">
                          <Copy size={14} /> Copy Corrected Text
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted italic">টেক্সট লিখে চেক বাটনে ক্লিক করলে এখানে সংশোধিত ভার্সন দেখা যাবে।</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'insight' && (
              <motion.div
                key="insight"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <textarea
                  value={insightText}
                  onChange={(e) => setInsightText(e.target.value)}
                  placeholder="এখানে বড় কোনো টেক্সট পেস্ট করুন... AI সহজ ভাষায় সারমর্ম বুঝিয়ে দেবে।"
                  className="w-full bg-bg border border-border rounded-2xl p-6 text-lg focus:outline-none focus:border-accent transition-all min-h-[200px]"
                />
                <button onClick={generateSummary} disabled={isInsightLoading} className="w-full md:w-auto px-10 py-4 rounded-xl bg-accent-2 text-white font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-50">
                  {isInsightLoading ? <Loader2 className="animate-spin" /> : <FileText size={18} />}
                  সারমর্ম তৈরি করুন
                </button>

                {insightResult && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 p-6 bg-bg border border-border rounded-2xl space-y-4">
                    <p className="whitespace-pre-wrap leading-relaxed">{insightResult}</p>
                    <div className="flex flex-wrap gap-4">
                      <button onClick={() => copyToClipboard(insightResult)} className="px-6 py-3 rounded-xl bg-surface-2 border border-border text-sm font-medium flex items-center gap-2 hover:border-accent transition-all">
                        <Copy size={16} /> কপি করুন
                      </button>
                      <button onClick={() => downloadFile(insightResult, 'aura-insight-summary.txt', 'text/plain')} className="px-6 py-3 rounded-xl bg-surface-2 border border-border text-sm font-medium flex items-center gap-2 hover:border-accent-2 transition-all">
                        <Download size={16} /> টেক্সট ডাউনলোড
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {activeTab === 'voice' && (
              <motion.div
                key="voice"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <textarea
                  value={voiceText}
                  onChange={(e) => setVoiceText(e.target.value)}
                  placeholder="এখানে যেকোনো টেক্সট লিখুন যা ভয়েসে শুনতে চান..."
                  className="w-full bg-bg border border-border rounded-2xl p-6 text-lg focus:outline-none focus:border-accent transition-all min-h-[120px]"
                />
                <div className="flex flex-wrap gap-4">
                  <button onClick={generateVoice} disabled={isVoiceLoading} className="flex-1 md:flex-none px-10 py-4 rounded-xl bg-accent-3 text-white font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-50">
                    {isVoiceLoading ? <Loader2 className="animate-spin" /> : <Volume2 size={18} />}
                    ভয়েস শুনুন
                  </button>
                  <button onClick={() => downloadVoiceAudio(voiceText)} disabled={isVoiceLoading || !voiceText.trim()} className="flex-1 md:flex-none px-10 py-4 rounded-xl border border-accent-3 text-accent-3 font-bold flex items-center justify-center gap-2 hover:bg-accent-3/10 transition-all disabled:opacity-50">
                    <Download size={18} /> অডিও ডাউনলোড
                  </button>
                </div>
                {isVoiceLoading && (
                  <div className="flex items-center gap-2 text-accent-3 animate-pulse">
                    <Loader2 className="animate-spin" size={16} />
                    <span>AI কথা বলছে...</span>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'ads' && (
              <motion.div
                key="ads"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted uppercase tracking-wider">পণ্যের নাম</label>
                    <input type="text" value={adProduct} onChange={(e) => setAdProduct(e.target.value)} placeholder="যেমন: Aura Smart Watch" className="w-full bg-bg border border-border rounded-xl p-4 text-sm focus:outline-none focus:border-accent" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted uppercase tracking-wider">পণ্যের বিবরণ</label>
                    <input type="text" value={adDesc} onChange={(e) => setAdDesc(e.target.value)} placeholder="যেমন: স্টাইলিশ ডিজাইন, ৭ দিনের ব্যাটারি" className="w-full bg-bg border border-border rounded-xl p-4 text-sm focus:outline-none focus:border-accent" />
                  </div>
                </div>
                <button onClick={generateAds} disabled={isAdsLoading} className="w-full md:w-auto px-10 py-4 rounded-xl bg-accent-4 text-black font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-50">
                  {isAdsLoading ? <Loader2 className="animate-spin" /> : <Megaphone size={18} />}
                  ফুল অ্যাড ক্যাম্পেইন তৈরি করুন
                </button>

                {(adResults.length > 0 || adCampaignImage) && (
                  <div className="space-y-12 pt-8 border-t border-border/30">
                    {lastAdInfo && (
                      <div className="space-y-2">
                        <h3 className="text-3xl font-display font-bold text-accent-4">{lastAdInfo.product}</h3>
                        <p className="text-muted italic">"{lastAdInfo.desc}"</p>
                      </div>
                    )}

                    {adCampaignImage && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold uppercase tracking-widest text-muted">Campaign Visual</h4>
                          <button onClick={() => downloadImage(adCampaignImage, 'aura-ad-visual.png')} className="text-accent-4 hover:underline text-xs font-bold flex items-center gap-1">
                            <Download size={14} /> ডাউনলোড ইমেজ
                          </button>
                        </div>
                        <div className="relative aspect-video w-full bg-surface-2 rounded-3xl overflow-hidden border border-border shadow-2xl group">
                          <motion.img
                            initial={{ scale: 1.1 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 10, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
                            src={adCampaignImage}
                            alt="Ad Visual"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                          <div className="absolute bottom-6 left-6 flex items-center gap-2">
                            <div className="w-2 h-2 bg-accent-4 rounded-full animate-pulse" />
                            <span className="text-[10px] font-bold text-white uppercase tracking-widest">Live Ad Preview</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {isAdImageLoading && !adCampaignImage && (
                      <div className="aspect-video w-full bg-surface-2 rounded-3xl flex flex-col items-center justify-center border border-dashed border-border">
                        <Loader2 className="animate-spin text-accent-4 mb-4" size={32} />
                        <p className="text-sm text-muted">বিজ্ঞাপনের ছবি তৈরি হচ্ছে...</p>
                      </div>
                    )}

                    <div className="space-y-6">
                      <h4 className="text-sm font-bold uppercase tracking-widest text-muted">Ad Copy Variants</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {adResults.map((ad, i) => (
                          <div key={i} className="group relative p-8 bg-surface-2 border border-border rounded-[2rem] space-y-4 hover:border-accent-4/50 transition-all card-glow">
                            <div className="flex justify-between items-start">
                              <span className="px-3 py-1 rounded-full bg-accent-4/10 text-[10px] font-bold uppercase tracking-widest text-accent-4 border border-accent-4/20">{ad.type}</span>
                              <div className="flex gap-2">
                                <button onClick={() => copyToClipboard(`${ad.text}\n\nCTA: ${ad.cta}`)} className="p-2 rounded-lg bg-bg border border-border text-muted hover:text-white transition-all" title="কপি করুন">
                                  <Copy size={14} />
                                </button>
                                <button onClick={() => downloadFile(`${ad.type} Ad Variant\n\n${ad.text}\n\nCTA: ${ad.cta}`, `aura-ad-variant-${i + 1}.txt`, 'text/plain')} className="p-2 rounded-lg bg-bg border border-border text-muted hover:text-accent-4 transition-all" title="ডাউনলোড করুন">
                                  <Download size={14} />
                                </button>
                              </div>
                            </div>
                            <div className="space-y-4">
                              <p className="text-base leading-relaxed font-light italic text-foreground/80">"{ad.text}"</p>
                              <div className="pt-4 border-t border-border/50">
                                <button className="w-full py-3 rounded-xl bg-accent-4 text-black font-bold text-sm shadow-lg shadow-accent-4/20 hover:scale-[1.02] transition-all">{ad.cta}</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6 max-w-4xl mx-auto text-center">
        <p className="text-accent text-xs font-bold uppercase tracking-[0.3em] mb-4">Pricing</p>
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-12 text-foreground">সহজ ও সাশ্রয়ী মূল্য</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="glass p-10 rounded-[2rem] border-border hover:scale-[1.02] transition-all">
            <h3 className="font-display text-2xl font-bold mb-2 text-foreground">Free</h3>
            <div className="text-5xl font-display font-extrabold mb-6 text-foreground">৳০ <span className="text-lg font-normal text-foreground/60">/ মাস</span></div>
            <ul className="text-left space-y-4 mb-10 text-foreground/70 text-sm">
              <li className="flex items-center gap-2"><Check size={16} className="text-accent-2" /> Vision AI আর্ট জেনারেশন</li>
              <li className="flex items-center gap-2"><Check size={16} className="text-accent-2" /> Voice সিন্থেসিস</li>
              <li className="flex items-center gap-2 text-accent-3"><X size={16} /> Insight সামারি</li>
              <li className="flex items-center gap-2 text-accent-3"><X size={16} /> AdGen বিজ্ঞাপন</li>
            </ul>
            <button className="w-full py-4 rounded-xl border border-border font-bold hover:bg-white/5 transition-all">ফ্রি শুরু করুন</button>
          </div>
          <div className="glass p-10 rounded-[2rem] border-accent shadow-2xl shadow-accent/10 relative hover:scale-[1.02] transition-all overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-accent" />
            <div className="absolute -top-12 -right-12 w-24 h-24 bg-accent/20 blur-3xl" />
            <h3 className="font-display text-2xl font-bold mb-2 text-foreground">Pro</h3>
            <div className="text-5xl font-display font-extrabold mb-6 text-foreground">৳৪৯৯ <span className="text-lg font-normal text-foreground/60">/ মাস</span></div>
            <ul className="text-left space-y-4 mb-10 text-sm text-foreground/70">
              <li className="flex items-center gap-2"><Check size={16} className="text-accent-2" /> সব AI টুলস আনলিমিটেড</li>
              <li className="flex items-center gap-2"><Check size={16} className="text-accent-2" /> হাই-কোয়ালিটি আউটপুট</li>
              <li className="flex items-center gap-2"><Check size={16} className="text-accent-2" /> Priority Support</li>
              <li className="flex items-center gap-2"><Check size={16} className="text-accent-2" /> কাস্টম এক্সপোর্ট অপশন</li>
            </ul>
            <button className="w-full py-4 rounded-xl bg-accent text-white font-bold shadow-lg shadow-accent/20 hover:scale-105 transition-all">Pro তে আপগ্রেড করুন</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-border text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-6 h-6 bg-accent rounded flex items-center justify-center">
            <Sparkles className="text-white" size={14} />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-foreground">Aura <span className="text-accent">AI</span></span>
        </div>
        <p className="text-foreground/60 text-sm mb-4">Premium AI Productivity Suite — Made with ❤️ in Bangladesh</p>
        <div className="flex justify-center gap-8 text-xs font-medium text-foreground/40">
          <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-foreground transition-colors">Contact Us</a>
        </div>
      </footer>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 right-8 z-[100] px-6 py-4 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-center gap-3 ${toast.type === 'success'
              ? 'bg-surface-2/90 border-accent-2/30 text-accent-2'
              : 'bg-surface-2/90 border-accent-3/30 text-accent-3'
              }`}
          >
            {toast.type === 'success' ? <Check size={18} /> : <X size={18} />}
            <span className="font-medium">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}