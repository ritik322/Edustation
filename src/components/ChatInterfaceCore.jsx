// src/components/ChatInterfaceCore.js
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, X, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown'; // <-- Import react-markdown

// API Configuration (Keep as before, remember environment variables for API key)
const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY; // Use  in production
const GROQ_API_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 1024;

const ChatInterfaceCore = ({ isExpanded, user }) => {
    // --- Update system prompt to encourage Markdown ---
    const [context] = useState(
        'You are DocuMind AI, a helpful assistant. Format your responses using Markdown when appropriate (e.g., for lists, bold text, code blocks, paragraphs).'
    );
    // --- End of updated prompt ---

    const [chatHistory, setChatHistory] = useState([
        { role: 'assistant', content: 'Hello! How can I help you today? Feel free to ask for explanations, summaries, or code examples.' }
    ]);
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    const handleSendMessage = async () => {
        if (!message.trim() || isLoading) return;
        if (!GROQ_API_KEY || GROQ_API_KEY.includes("YOUR_GROQ")) { // Basic check
            setError("Groq API Key not configured.");
            return;
        }

        setIsLoading(true);
        setError('');
        const userMsg = { role: 'user', content: message };
        const currentHistory = [...chatHistory, userMsg];
        setChatHistory(currentHistory);
        setMessage('');

        const apiMessages = [
            { role: "system", content: context },
            ...currentHistory.slice(-10).map(msg => ({
                role: msg.role,
                content: msg.content
            }))
        ];

        try {
            console.log("Sending to Groq:", { model: DEFAULT_MODEL, messages: apiMessages.length });
            const response = await fetch(GROQ_API_ENDPOINT, { /* ... fetch options ... */
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${GROQ_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  model: DEFAULT_MODEL,
                  messages: apiMessages,
                  temperature: DEFAULT_TEMPERATURE,
                  max_tokens: DEFAULT_MAX_TOKENS,
                })
             });

            if (!response.ok) { /* ... error handling ... */
                const errorData = await response.json().catch(() => ({}));
                console.error("Groq API Error Response:", errorData);
                throw new Error(`API error (${response.status}): ${errorData?.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const assistantMessageContent = data.choices?.[0]?.message?.content?.trim();

            if (assistantMessageContent) {
                const assistantMsg = { role: 'assistant', content: assistantMessageContent };
                setChatHistory(prev => [...prev, assistantMsg]);
            } else { /* ... error handling ... */
                console.error("Invalid response format from Groq:", data);
                throw new Error('No response content received from AI.');
             }

        } catch (e) { /* ... error handling ... */
            console.error("Error calling Groq API:", e);
            setError(e.message || 'Failed to get response from the AI.');
            setChatHistory(prev => [...prev, {role: 'system', content: `Error: ${e.message || 'Request Failed'}`}])
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-800 p-3">
            {/* Error Display */}
            {error && (
                <div className="bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-600 text-red-700 dark:text-red-200 px-3 py-1.5 rounded mb-2 text-xs flex justify-between items-center">
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="ml-2 p-0.5 rounded hover:bg-red-200 dark:hover:bg-red-800"><X size={14} /></button>
                </div>
            )}

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-3 custom-scrollbar">
                {chatHistory.map((chat, idx) => (
                    <div key={idx} className={`flex ${
                        chat.role === 'user' ? 'justify-end'
                        : chat.role === 'assistant' ? 'justify-start'
                        : 'justify-center' // For system/error messages
                    }`}>
                        <div className={`max-w-[85%] px-3 py-1.5 rounded-lg shadow-sm text-sm ${
                             chat.role === 'user' ? 'bg-indigo-500 text-white'
                             : chat.role === 'assistant' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                             : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 text-center italic'
                         }`}>
                            {/* --- Use ReactMarkdown for assistant messages --- */}
                            {chat.role === 'assistant' ? (
                                <article className="prose prose-sm dark:prose-invert max-w-none">
                                     {/* prose-sm makes text smaller, dark:prose-invert handles dark mode */}
                                     {/* max-w-none prevents prose from limiting width inside bubble */}
                                     <ReactMarkdown
                                        // Apply Tailwind classes generated by typography plugin
                                        // You can customize components further if needed
                                        // components={{
                                        //    p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                        //    // Customize other elements like code blocks, lists etc.
                                        // }}
                                     >
                                        {chat.content}
                                    </ReactMarkdown>
                                </article>
                            ) : (
                                // Render user/system messages as plain text (or wrap in <p> if needed)
                                typeof chat.content === 'string' ? chat.content.split('\n').map((line, i) => (
                                    <span key={i} className="block min-h-[1em]">{line || '\u00A0'}</span>
                                )) : JSON.stringify(chat.content)
                            )}
                            {/* --- End of Markdown handling --- */}
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="mt-auto flex gap-2 items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                {/* Input and Button remain the same */}
                 <input
                    type="text"
                    className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Type your message..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && !isLoading && handleSendMessage()}
                    disabled={isLoading}
                 />
                 <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !message.trim()}
                    className={`w-10 h-9 flex items-center justify-center rounded-md text-white font-medium transition-colors ${
                        isLoading || !message.trim()
                            ? 'bg-gray-400 dark:bg-gray-500 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600'
                    }`}
                     aria-label="Send message"
                 >
                     {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send size={18} />}
                 </button>
            </div>
        </div>
    );
};

export default ChatInterfaceCore;