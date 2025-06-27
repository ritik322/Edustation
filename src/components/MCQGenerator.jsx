import React, { useState } from 'react';
// Import the local generateMCQs function directly
import { generateMCQs } from './document-utils';

const MCQGenerator = ({ pdfContent, onMCQsGenerated }) => {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState({
    numQuestions: 3,
    subject: '',
    tone: 'formal'
  });

  const handleGenerateMCQs = async () => {
    if (!pdfContent) {
      setError('No PDF content available');
      return;
    }
  
    setGenerating(true);
    setError(null);
  
    try {
      // Only use the first 1000 characters (or adjust as needed)
      const contentSubset = pdfContent.slice(0, 1000);
  
      // Call the function directly without a fetch
      const quizData = await generateMCQs({
        text: contentSubset,
        number: settings.numQuestions,
        subject: settings.subject,
        tone: settings.tone
      });
  
      // Transform the response if needed
      const formattedMCQs = Object.values(quizData).map((q) => ({
        id: q.no,
        question: q.mcq,
        options: Object.values(q.options),
        correctAnswer: Object.keys(q.options).indexOf(q.correct),
        correctLetter: q.correct,
      }));
  
      onMCQsGenerated(formattedMCQs);
    } catch (err) {
      setError(err.message);
      console.error('MCQ Generation Error:', err);
    } finally {
      setGenerating(false);
    }
  };
  

  return (
    <div className="w-full mb-4 bg-white rounded-lg shadow-md">
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold">Generate MCQs from PDF</h2>
      </div>
      
      <div className="p-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Number of Questions
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={settings.numQuestions}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  numQuestions: parseInt(e.target.value),
                }))
              }
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Subject Area</label>
            <input
              type="text"
              value={settings.subject}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  subject: e.target.value,
                }))
              }
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., History, Mathematics, Science"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Question Style</label>
            <select
              value={settings.tone}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  tone: e.target.value,
                }))
              }
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="formal">Formal</option>
              <option value="informal">Casual</option>
            </select>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={handleGenerateMCQs}
            disabled={generating || !settings.subject || !pdfContent}
            className={`w-full px-4 py-2 rounded text-white ${
              generating || !settings.subject || !pdfContent
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {generating ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                Generating Questions...
              </div>
            ) : (
              'Generate MCQs'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MCQGenerator;
