import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { collection, doc, getDoc } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { db, auth } from '../firebase-config';
import * as pdfjsLib from 'pdfjs-dist';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import { DocumentProcessor } from './document-utils';

const DocumentViewer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageText, setPageText] = useState('');
  const [summary, setSummary] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [processingAi, setProcessingAi] = useState(false);
  const [extractingText, setExtractingText] = useState(false);
  const [relevantChunks, setRelevantChunks] = useState([]);

  const docProcessor = useRef(new DocumentProcessor());
  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const [autoSummarize, setAutoSummarize] = useState(true);
  const [mcqs, setMCQs] = useState(null);
  const [mcqSettings, setMcqSettings] = useState({
    number: 3,
    tone: 'formal'
  });
  const [generatingMCQs, setGeneratingMCQs] = useState(false);
  const [userAnswers, setUserAnswers] = useState({});
  const [answerResults, setAnswerResults] = useState({});
  const [showExplanations, setShowExplanations] = useState({});

  useEffect(() => {
    loadDocument();
  }, [id]);

  const handleAnswerSelect = async (questionNo, answer) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionNo]: answer
    }));

    try {
      const result = await docProcessor.current.checkMCQAnswer(questionNo, answer, mcqs);
      setAnswerResults(prev => ({
        ...prev,
        [questionNo]: result
      }));
      setShowExplanations(prev => ({
        ...prev,
        [questionNo]: true
      }));
    } catch (error) {
      setError('Error checking answer: ' + error.message);
    }
  };

  const toggleExplanation = (questionNo) => {
    setShowExplanations(prev => ({
      ...prev,
      [questionNo]: !prev[questionNo]
    }));
  };

  const loadDocument = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, 'documents', id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error('Document not found');
      }

      const documentData = { id: docSnap.id, ...docSnap.data() };
      setDocument(documentData);

      const storage = getStorage();
      const fileRef = ref(storage, `documents/${auth.currentUser.uid}/${documentData.subject}/${documentData.name}`);
      const url = await getDownloadURL(fileRef);
      setPdfUrl(url);

      // Load PDF document
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPdfDoc(pdf);

      // Don't automatically process the first page here
      // The Viewer component will trigger handlePageChange
      setCurrentPage(1);
    } catch (err) {
      console.error('Error loading document:', err);
      setError('Error loading document. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = async (e) => {
    try {
      const newPage = e.currentPage + 1;
      setCurrentPage(newPage);
      setExtractingText(true);

      if (!pdfDoc) {
        console.warn('PDF document not loaded yet');
        return;
      }

      if (newPage < 1 || newPage > pdfDoc.numPages) {
        console.error(`Invalid page number: ${newPage}. Total pages: ${pdfDoc.numPages}`);
        return;
      }

      const result = await docProcessor.current.processPageContent(pdfDoc, newPage);

      setPageText(result.text);
      if (result.summary) {
        setSummary(result.summary);
      }
    } catch (error) {
      console.error('Error processing page:', error);
      setError('Error processing page content');
    } finally {
      setExtractingText(false);
    }
  };

  const handleGenerateMCQs = async () => {
    try {
      setGeneratingMCQs(true);
      const result = await docProcessor.current.generateMCQs(pageText, mcqSettings);
      setMCQs(result);
    } catch (error) {
      setError('Error generating MCQs: ' + error.message);
    } finally {
      setGeneratingMCQs(false);
    }
  };

  const toggleAutoSummarize = (enabled) => {
    setAutoSummarize(enabled);
    docProcessor.current.setAutoSummarize(enabled);
  };
  const handleQuestionSubmit = async () => {
    if (!question.trim()) return;

    try {
      setProcessingAi(true);
      setAnswer(null);
      setRelevantChunks([]);

      const { answer: answerText, relevantChunks: chunks } =
        await docProcessor.current.answerQuestion(question);

      setAnswer(answerText);
      setRelevantChunks(chunks);
    } catch (error) {
      console.error('Error processing question:', error);
      setError('Error processing question');
    } finally {
      setProcessingAi(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">

      {/* PDF Viewer Section */}
      <div className="flex-1 p-4 max-w-[65%]">
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">{document?.name}</h1>
            <button
              onClick={() => navigate('/home')}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Back to Home
            </button>
          </div>
        </div>

        {pdfUrl && (
          <div className="bg-white rounded-lg shadow-md p-4" style={{ height: 'calc(100vh - 200px)' }}>
            <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
              <Viewer
                fileUrl={pdfUrl}
                plugins={[defaultLayoutPluginInstance, pageNavigationPluginInstance]}
                onPageChange={handlePageChange}
              />
            </Worker>
          </div>
        )}
      </div>

      {/* Sidebar Section */}
      <div className="w-[35%] p-4 bg-white shadow-lg overflow-y-auto" style={{ height: 'calc(100vh - 32px)' }}>

        {/* Auto-Summarize Toggle */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">Page Summary</h2>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoSummarize}
              onChange={(e) => toggleAutoSummarize(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="ml-3 text-sm font-medium text-gray-700">Auto-summarize</span>
          </label>
        </div>

        {/* Question & Answer Section */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Ask a Question</h2>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Type your question here..."
              className="border p-2 rounded"
            />
            <button
              onClick={handleQuestionSubmit}
              disabled={processingAi || !question.trim()}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {processingAi ? 'Processing...' : 'Ask Question'}
            </button>
          </div>

          {/* Display Answer */}
          {answer && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-bold mb-2">Answer:</h3>
              <p className="text-gray-700">{answer}</p>
            </div>
          )}

          {/* Relevant Sections */}
          {relevantChunks.length > 0 && (
            <div className="mt-4">
              <h3 className="font-bold mb-2">Relevant Sections:</h3>
              <div className="space-y-2">
                {relevantChunks.map((chunk, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded border border-gray-200">
                    <p className="text-sm text-gray-600">{chunk}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* MCQ Generator */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Generate MCQs</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Number of Questions</label>
              <input
                type="number"
                min="1"
                max="10"
                value={mcqSettings.number}
                onChange={(e) => setMcqSettings((prev) => ({ ...prev, number: parseInt(e.target.value) }))}
                className="w-full p-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Question Style</label>
              <select
                value={mcqSettings.tone}
                onChange={(e) => setMcqSettings((prev) => ({ ...prev, tone: e.target.value }))}
                className="w-full p-2 border rounded"
              >
                <option value="formal">Formal</option>
                <option value="informal">Casual</option>
              </select>
            </div>
            <button
              onClick={handleGenerateMCQs}
              disabled={generatingMCQs || !pageText}
              className={`w-full px-4 py-2 rounded text-white ${generatingMCQs || !pageText ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
            >
              {generatingMCQs ? 'Generating...' : 'Generate MCQs'}
            </button>
          </div>

          {/* Updated MCQs Display Section */}
          {mcqs && (
            <div className="mt-4 space-y-4">
              {Object.entries(mcqs).map(([questionNo, question]) => (
                <div key={questionNo} className="p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium mb-2">{question.no}. {question.mcq}</p>
                  <div className="space-y-2 ml-4">
                    {Object.entries(question.options).map(([letter, text]) => (
                      <button
                        key={letter}
                        onClick={() => handleAnswerSelect(questionNo, letter)}
                        className={`w-full p-2 rounded text-left ${userAnswers[questionNo] === letter
                            ? answerResults[questionNo]?.isCorrect
                              ? 'bg-green-100 border-green-200'
                              : 'bg-red-100 border-red-200'
                            : letter === answerResults[questionNo]?.correctAnswer && userAnswers[questionNo]
                              ? 'bg-green-100 border-green-200'
                              : 'bg-white hover:bg-gray-50'
                          } border transition-colors`}
                      >
                        {letter}. {text}
                      </button>
                    ))}
                  </div>

                  {answerResults[questionNo] && (
                    <div className="mt-4">
                      <button
                        onClick={() => toggleExplanation(questionNo)}
                        className="text-blue-500 hover:text-blue-600 text-sm"
                      >
                        {showExplanations[questionNo] ? 'Hide Explanation' : 'Show Explanation'}
                      </button>

                      {showExplanations[questionNo] && (
                        <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm">
                          <p className="font-medium">Explanation:</p>
                          <p>{answerResults[questionNo].explanation}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Page Summary Section */}
        <div className="mt-6">
          <h2 className="text-xl font-bold mb-4">Page {currentPage} Summary</h2>
          {extractingText ? (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mr-2"></div>
              <span>Generating summary...</span>
            </div>
          ) : (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-700">{summary || 'No summary available'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;