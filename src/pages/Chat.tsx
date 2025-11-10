import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getChatServiceFindings, type ChatFinding } from '@/lib/api';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'error';
  timestamp: Date;
}

interface Notification {
  id: string;
  type: string;
  severity: string;
  title: string;
  exposed?: string;
  value?: string;
  timestamp: Date;
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hi! I'm running on Ollama. Ask me anything, or try to find my vulnerabilities for security testing!",
      role: 'assistant',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState('tinydolphin');
  const [temperature, setTemperature] = useState(0.7);
  const [contextLength, setContextLength] = useState(4096);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showFindings, setShowFindings] = useState(false);
  const [findings, setFindings] = useState<ChatFinding[]>([]);
  const [findingsLoading, setFindingsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadFindings = async () => {
    setFindingsLoading(true);
    try {
      const data = await getChatServiceFindings();
      setFindings(data);
    } catch (error) {
      console.error('Failed to load findings:', error);
    } finally {
      setFindingsLoading(false);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (showFindings) {
      loadFindings();
    }
  }, [showFindings]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date(),
    };

    const userInput = input;
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8006/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: userInput,
          model: model,
          temperature: temperature,
          num_ctx: contextLength,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.response) {
        const assistantMessage: Message = {
          id: Date.now().toString(),
          content: data.response,
          role: 'assistant',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Handle vulnerability detection
        if (data.vulnerability) {
          const notification: Notification = {
            id: Date.now().toString(),
            type: data.vulnerability.type,
            severity: data.vulnerability.severity,
            title: data.vulnerability.title,
            exposed: data.vulnerability.exposed,
            value: data.vulnerability.value,
            timestamp: new Date(),
          };
          setNotifications((prev) => [...prev, notification]);
          
          // Auto-remove notification after 8 seconds
          setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
          }, 8000);
        }
      } else if (data.error) {
        const errorMessage: Message = {
          id: Date.now().toString(),
          content: `Error: ${data.error}`,
          role: 'error',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\nMake sure:\n1. Ollama is running: ollama serve\n2. Backend service is running on port 8006`,
        role: 'error',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-700">
      {/* Notifications Container - iPhone Style */}
      <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none p-4">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className="mb-3 pointer-events-auto animate-in slide-in-from-top-2 duration-300"
          >
            <div className={`rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl ${
              notification.severity === 'CRITICAL' 
                ? 'bg-gradient-to-r from-red-600 to-red-700' 
                : 'bg-gradient-to-r from-yellow-600 to-yellow-700'
            }`}>
              <div className="px-5 py-4 text-white">
                <div className="flex items-start gap-3">
                  <div className="text-2xl flex-shrink-0">
                    {notification.severity === 'CRITICAL' ? '🚨' : '⚠️'}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-sm mb-1">{notification.title}</h3>
                    <p className="text-xs opacity-90">
                      Type: <span className="font-mono font-bold">{notification.type}</span>
                    </p>
                    {notification.exposed && (
                      <p className="text-xs opacity-90 mt-1">
                        Exposed: <span className="font-mono">{notification.exposed}</span>
                      </p>
                    )}
                    {notification.value && (
                      <p className="text-xs opacity-90 mt-1 break-all font-mono bg-black/20 p-2 rounded mt-2">
                        {notification.value}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="h-1 bg-black/20 animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">🤖 Ollama Chat</h1>
            <p className="text-sm opacity-90">Powered by Ollama (tinydolphin)</p>
            {findings.length > 0 && (
              <p className="text-xs mt-2 text-red-200">🔴 {findings.length} VULNERABILITY(IES) LOGGED</p>
            )}
          </div>
          <Button
            onClick={() => setShowFindings(!showFindings)}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {showFindings ? '✕ Hide' : '📋 Findings'} {findings.length > 0 && `(${findings.length})`}
          </Button>
        </div>
      </div>

      {showFindings && (
        <div className="bg-gray-100 border-b border-gray-300 p-4 max-h-64 overflow-y-auto">
          {findingsLoading ? (
            <p className="text-center text-gray-600">Loading findings...</p>
          ) : findings.length === 0 ? (
            <p className="text-center text-gray-600">No vulnerabilities detected yet</p>
          ) : (
            <div className="space-y-3">
              {findings.map((finding, idx) => (
                <div key={idx} className={`p-3 rounded border-l-4 ${
                  finding.severity === 'CRITICAL' 
                    ? 'bg-red-50 border-red-500' 
                    : 'bg-yellow-50 border-yellow-500'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-semibold text-sm">
                        {finding.type}
                        <span className={`ml-2 text-xs font-bold ${
                          finding.severity === 'CRITICAL' ? 'text-red-600' : 'text-yellow-600'
                        }`}>
                          {finding.severity}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 mt-1">
                        <strong>Payload:</strong> {finding.payload.substring(0, 60)}...
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        <strong>Exposed:</strong> {Object.keys(finding.exposed_data).join(', ')}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(finding.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings */}
      <div className="bg-white px-6 py-3 border-b border-gray-200 flex gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Model:</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={isLoading}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="tinydolphin">tinydolphin</option>
            <option value="neural-chat">neural-chat</option>
            <option value="mistral">mistral</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Temperature:</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            disabled={isLoading}
            className="w-24"
          />
          <span className="text-sm text-gray-600 w-8">{temperature.toFixed(1)}</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Context:</label>
          <input
            type="range"
            min="128"
            max="8192"
            step="256"
            value={contextLength}
            onChange={(e) => setContextLength(parseInt(e.target.value))}
            disabled={isLoading}
            className="w-24"
          />
          <span className="text-sm text-gray-600 w-12">{contextLength}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 animate-in slide-in-from-bottom-2 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role !== 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-lg">
                🤖
              </div>
            )}
            <div
              className={`max-w-md lg:max-w-2xl px-4 py-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-none'
                  : message.role === 'error'
                  ? 'bg-red-100 text-red-800 rounded-bl-none border border-red-300'
                  : 'bg-gray-100 text-gray-900 rounded-bl-none'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
            </div>
            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-lg">
                👤
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 animate-in slide-in-from-bottom-2">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-lg">
              🤖
            </div>
            <div className="bg-gray-100 text-gray-900 px-4 py-3 rounded-lg rounded-bl-none">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4 shadow-lg">
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-full px-6"
          >
            {isLoading ? '⏳' : '➤'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Chat;