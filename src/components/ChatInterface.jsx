import React, { useState, useEffect } from 'react';
import { Loader2, Settings, MessageSquare } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { auth, storage, db } from "../firebase-config";
import { Timestamp } from "firebase/firestore";

// Firebase configuration



const MultiLLMChat = () => {
  // State variables
  const [selectedProvider, setSelectedProvider] = useState('Groq');
  const [selectedModel, setSelectedModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxLength, setMaxLength] = useState(512);
  const [topP, setTopP] = useState(0.9);
  const [context, setContext] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [savedChats, setSavedChats] = useState([]);

  // LLM providers configuration
  const providers = {
    Groq: {
      models: ["llama3-8b-8192", "mixtral-8x7b-32768", "whisper-large-v3", "gemma-7b-it"],
      apiKey: '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',
      endpoint: "https://api.groq.com/openai/v1/chat/completions"
    },
    NVIDIA: {
      models: ["mistralai/mixtral-8x7b-instruct-v0.1", "meta/llama3-70b-instruct", "microsoft/phi-3-mini-4k-instruct"],
      apiKey: "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",
      endpoint: "https://api.nvidia.com/v1/chat/completions"
    },
    "Hugging Face": {
      models: ["meta-llama/Meta-Llama-3-8B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3", "facebook/mbart-large-50-many-to-one-mmt"],
      apiKey: process.env.REACT_APP_HF_API_KEY,
      endpoint: "https://api-inference.huggingface.co/models"
    }
  };

  // Effect for authentication and fetching saved chats
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        const q = query(
          collection(db, `chats`),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        onSnapshot(q, (querySnapshot) => {
          const chats = [];
          querySnapshot.forEach((doc) => {
            chats.push({ id: doc.id, ...doc.data() });
          });
          setSavedChats(chats);
        });
      }
    });
  
    // Cleanup the listener on component unmount
    return () => unsubscribe();
  }, []);
  

  // Function to handle sending messages
  const handleSendMessage = async () => {
    if (!selectedModel) {
      setError("Please select a model.");
      return;
    }

    setIsLoading(true);
    setError('');
    const currentProvider = providers[selectedProvider];
    
    try {
      let response;
      let assistantMessage;

      // API call logic based on the selected provider
      if (selectedProvider === 'Groq') {
        response = await fetch(currentProvider.endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentProvider.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { role: "system", content: context || "You are a helpful assistant." },
              ...chatHistory.map(msg => ({
                role: msg.role,
                content: msg.content
              })),
              { role: "user", content: message }
            ],
            temperature,
            max_tokens: maxLength
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
          assistantMessage = data.choices[0].message.content;
        } else {
          throw new Error('Invalid response format from Groq API');
        }
      } else if (selectedProvider === 'NVIDIA') {
        // NVIDIA API call logic
        // ... (similar structure to Groq, with NVIDIA-specific parameters)
      } else if (selectedProvider === 'Hugging Face') {
        // Hugging Face API call logic
        // ... (similar structure to Groq, with Hugging Face-specific parameters)
      }

      if (assistantMessage) {
        const newChatHistory = [
          ...chatHistory,
          { role: 'user', content: message },
          { role: 'assistant', content: assistantMessage }
        ];
        setChatHistory(newChatHistory);
        setMessage('');

        // Save chat to Firebase
        if (user) {
          await addDoc(collection(db, `chats`), {
            provider: selectedProvider,
            model: selectedModel,
            history: newChatHistory,
            createdAt: Timestamp.fromDate(new Date()),
          });
        }
      } else {
        throw new Error('No response received from the API');
      }

    } catch (error) {
      console.error('Error:', error);
      setError(error.message || 'Failed to get response from the model');
    } finally {
      setIsLoading(false);
    }
  };

  // Render function
  return (
    <div className="min-h-screen bg-gray-100 p-8 flex gap-4">
      {/* Left Panel with Tabs */}
      <div className="w-1/4 bg-white rounded-lg shadow-md p-6">
        <Tabs defaultValue="parameters">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="parameters">
              <Settings className="w-4 h-4 mr-2" />
              Parameters
            </TabsTrigger>
            <TabsTrigger value="history">
              <MessageSquare className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>
          <TabsContent value="parameters">
            <h2 className="font-bold text-lg mb-6">LLM Parameters</h2>
            <div className="space-y-6">
              {/* Provider Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Provider</label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={selectedProvider}
                  onChange={(e) => {
                    setSelectedProvider(e.target.value);
                    setSelectedModel('');
                    setError('');
                  }}
                >
                  {Object.keys(providers).map(provider => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              </div>

              {/* Model Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Model</label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    setError('');
                  }}
                >
                  <option value="">Select Model</option>
                  {providers[selectedProvider].models.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>

              {/* Temperature Slider */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Temperature: {temperature}
                </label>
                <input
                  type="range"
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                />
              </div>

              {/* Max Length Slider */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Max Length: {maxLength}
                </label>
                <input
                  type="range"
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  min="64"
                  max="4096"
                  step="8"
                  value={maxLength}
                  onChange={(e) => setMaxLength(parseInt(e.target.value))}
                />
              </div>

              {/* Top P Slider (NVIDIA only) */}
              {selectedProvider === 'NVIDIA' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Top P: {topP}
                  </label>
                  <input
                    type="range"
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={topP}
                    onChange={(e) => setTopP(parseFloat(e.target.value))}
                  />
                </div>
              )}

              {/* System Context */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">System Context</label>
                <textarea
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Enter system context..."
                />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="history">
            <h2 className="font-bold text-lg mb-6">Chat History</h2>
            <div className="space-y-4">
              {savedChats.map((chat) => (
                <div key={chat.id} className="p-3 bg-gray-100 rounded-lg">
                  <p className="font-semibold">{chat.model}</p>
                  <p className="text-sm text-gray-500">{chat.createdAt.toDate().toLocaleString()}</p>
                  <button
                    onClick={() => {
                      setChatHistory(chat.history);
                      setSelectedProvider(chat.provider);
                      setSelectedModel(chat.model);
                    }}
                    className="mt-2 px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                  >
                    Load
                  </button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Chat Panel */}
      <div className="w-3/4 bg-white rounded-lg shadow-md p-6">
        <h2 className="font-bold text-lg mb-6">Chat</h2>
        
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Chat History */}
        <div className="h-[600px] overflow-y-auto p-4 space-y-4 border border-gray-200 rounded-lg mb-4">
          {chatHistory.map((chat, index) => (
            <div
              key={index}
              className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] p-3 rounded-lg ${
                  chat.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                {chat.content}
              </div>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isLoading && message.trim() && handleSendMessage()}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !message.trim()}
            className={`w-24 px-4 py-2 rounded-md text-white font-medium ${
              isLoading || !message.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              'Send'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiLLMChat;