<<<<<<< HEAD
import React, { useState, useEffect, useRef, useCallback } from "react";
=======
import React, { useState, useEffect, useRef } from "react";
>>>>>>> b6d099355f5caa5e739a921b39eef8cfad6959a4
import { useParams, useNavigate } from "react-router-dom";
import { Worker, Viewer } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { pageNavigationPlugin } from "@react-pdf-viewer/page-navigation";
<<<<<<< HEAD
import { collection, doc, getDoc, addDoc, Timestamp } from "firebase/firestore";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { db, auth } from "../firebase-config";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.entry";

// PDF Viewer CSS
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import "@react-pdf-viewer/page-navigation/lib/styles/index.css";

// Utilities & Components
import { DocumentProcessor } from "./document-utils"; // Ensure this path is correct
import { Toaster, toast } from 'react-hot-toast';

// Resizable Panels
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

// MUI Icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import PsychologyIcon from '@mui/icons-material/Psychology';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SaveIcon from '@mui/icons-material/Save';
import SummarizeIcon from '@mui/icons-material/Summarize'; // New icon for summary
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'; // New icon for Q&A
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn'; // New icon for MCQ

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const DocumentViewer = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [document, setDocument] = useState(null);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [pdfDocProxy, setPdfDocProxy] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [summary, setSummary] = useState("");
    const [generatingSummary, setGeneratingSummary] = useState(false);
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState(null);
    const [processingAi, setProcessingAi] = useState(false);
    const [relevantChunks, setRelevantChunks] = useState([]);
    const [mcqs, setMCQs] = useState(null);
    const [mcqSettings, setMcqSettings] = useState({ number: 3, tone: "formal" });
    const [generatingMCQs, setGeneratingMCQs] = useState(false);
    const [userAnswers, setUserAnswers] = useState({}); // { [questionNo]: selectedOptionLetter }
    const [answerResults, setAnswerResults] = useState({}); // { [questionNo]: { isCorrect: bool, correctAnswer: letter, explanation: string } }
    const [showExplanations, setShowExplanations] = useState({}); // { [questionNo]: boolean }

    const docProcessor = useRef(new DocumentProcessor());
    const defaultLayoutPluginInstance = defaultLayoutPlugin();
    const pageNavigationPluginInstance = pageNavigationPlugin();

    // --- Document Loading ---
    const loadDocument = useCallback(async () => {
        if (!id || !auth.currentUser) {
            setError("Invalid request or not logged in.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const docRef = doc(db, "documents", id);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) throw new Error("Document not found");

            const documentData = { id: docSnap.id, ...docSnap.data() };
            if (!documentData.name || !documentData.subject || !documentData.userId || documentData.userId !== auth.currentUser.uid) {
                throw new Error("Invalid document data or unauthorized access");
            }
            setDocument(documentData);

            const storagePath = documentData.storagePath || `documents/${auth.currentUser.uid}/${documentData.subject}/${documentData.name}`;
            console.log("Attempting to fetch from storage path:", storagePath);

            const storage = getStorage();
            const fileRef = ref(storage, storagePath);
            const url = await getDownloadURL(fileRef);
            setPdfUrl(url);

            const loadingTask = pdfjsLib.getDocument({ url });
            const pdfProxy = await loadingTask.promise;
            setPdfDocProxy(pdfProxy);

            setCurrentPage(1);
            setSummary("");
            setMCQs(null);
            setAnswer(null);
            setRelevantChunks([]);
            setUserAnswers({});
            setAnswerResults({});
            setShowExplanations({});

        } catch (err) {
            console.error("Error loading document:", err);
            let friendlyError = "Error loading document. Please try again later.";
            if (err.code === 'storage/object-not-found') friendlyError = "Document file not found in storage.";
            else if (err.message === "Document not found") friendlyError = "Document record not found.";
            else if (err.message.includes("unauthorized")) friendlyError = "Unauthorized access.";
            setError(friendlyError);
            setPdfUrl(null);
            setDocument(null);
        } finally {
            setLoading(false);
        }
    }, [id]); // Dependency: only re-run when document ID changes

    useEffect(() => {
        loadDocument();
    }, [loadDocument]);

    // --- Page Change Handler ---
    const handlePageChange = (e) => {
        const newPageNumber = e.currentPage + 1;
        setCurrentPage(newPageNumber);
        // Clear page-specific AI results
        setSummary("");
        setMCQs(null);
        setAnswer(null);
        setRelevantChunks([]);
        setUserAnswers({});
        setAnswerResults({});
        setShowExplanations({});
        setQuestion("");
        // Optional: Toast notification for page change?
        // toast(`Mapsd to page ${newPageNumber}`);
    };


    // --- AI Feature Handlers (Keep existing logic, update UI feedback) ---
    const handleGenerateSummary = async () => {
        if (!pdfDocProxy) { toast.error("PDF not loaded yet."); return; }
        setGeneratingSummary(true);
        setSummary(""); setError(null);
        const toastId = toast.loading(`Generating summary for page ${currentPage}...`);
        try {
            const result = await docProcessor.current.processPageContent(pdfDocProxy, currentPage);
            if (result.summary) {
                setSummary(result.summary);
                toast.success(`Summary generated.`, { id: toastId });
            } else throw new Error("No summary returned.");
        } catch (error) {
            console.error("Error generating summary:", error);
            setError("Error generating summary");
            toast.error(`Failed: ${error.message}`, { id: toastId });
        } finally { setGeneratingSummary(false); }
    };

    const handleGenerateMCQs = async () => {
        if (!pdfDocProxy) { toast.error("PDF not loaded."); return; }
        setGeneratingMCQs(true);
        setMCQs(null); setUserAnswers({}); setAnswerResults({}); setShowExplanations({}); setError(null);
        const toastId = toast.loading(`Generating ${mcqSettings.number} MCQs for page ${currentPage}...`);
        try {
            const currentPageText = await docProcessor.current.extractPageText(pdfDocProxy, currentPage);
            if (!currentPageText) throw new Error("Could not extract text from page.");
            const result = await docProcessor.current.generateMCQs(currentPageText, mcqSettings);
            if (!result || Object.keys(result).length === 0) throw new Error("No MCQs generated. Check page content.");
            setMCQs(result);
            toast.success("MCQs generated!", { id: toastId });
        } catch (error) {
            console.error("Error generating MCQs:", error);
            setError("Error generating MCQs: " + error.message);
            toast.error(`Failed: ${error.message}`, { id: toastId });
        } finally { setGeneratingMCQs(false); }
    };

    const handleAnswerSelect = async (questionNo, selectedLetter) => {
        if (!mcqs || !mcqs[questionNo] || answerResults[questionNo]) return;
        setUserAnswers((prev) => ({ ...prev, [questionNo]: selectedLetter }));
        // No loading indicator here, it should be fast
        try {
            const result = await docProcessor.current.checkMCQAnswer(questionNo, selectedLetter, mcqs);
            setAnswerResults((prev) => ({ ...prev, [questionNo]: result }));
            setShowExplanations((prev) => ({ ...prev, [questionNo]: true })); // Auto-show explanation
        } catch (error) {
            console.error("Error checking MCQ answer:", error);
            toast.error("Could not verify answer.");
        }
    };

    const toggleExplanation = (questionNo) => {
        setShowExplanations((prev) => ({ ...prev, [questionNo]: !prev[questionNo] }));
    };

    const handleQuestionSubmit = async () => {
        if (!question.trim() || !pdfDocProxy) {
            toast.error(!pdfDocProxy ? "PDF not loaded." : "Please enter a question."); return;
        }
        setProcessingAi(true);
        setAnswer(null); setRelevantChunks([]); setError(null);
        const toastId = toast.loading("Thinking...");
        try {
            const currentPageText = await docProcessor.current.extractPageText(pdfDocProxy, currentPage);
            if (!currentPageText) throw new Error("Could not extract text to analyze.");
            await docProcessor.current.initializeVectorStore(currentPageText); // Ensure store is ready

            const { answer: answerText, relevantChunks: chunks } = await docProcessor.current.answerQuestion(question);
            if (!answerText) throw new Error("Could not find an answer on this page.");

            setAnswer(answerText);
            setRelevantChunks(chunks);
            toast.success("Answer found!", { id: toastId });
        } catch (error) {
            console.error("Error processing question:", error);
            setError("Error processing question: " + error.message);
            toast.error(`Failed: ${error.message}`, { id: toastId });
        } finally { setProcessingAi(false); }
    };

    // --- Quiz Submission ---
    const calculateScore = useCallback(() => {
        if (!mcqs) return 0;
        return Object.keys(mcqs).reduce((score, qNo) => {
            return score + (answerResults[qNo]?.isCorrect ? 1 : 0);
        }, 0);
    }, [answerResults, mcqs]);

    const handleQuizSubmit = async () => {
        if (!mcqs || Object.keys(userAnswers).length === 0 || !auth.currentUser) {
            toast.error("Please answer at least one question first."); return;
        }
        const toastId = toast.loading("Submitting quiz attempt...");
        try {
            const score = calculateScore();
            const totalQuestions = Object.keys(mcqs).length;
            const quizData = {
                userId: auth.currentUser.uid,
                documentId: id,
                documentName: document?.originalName || document?.name || 'Unknown Document',
                pageNumber: currentPage,
                userAnswers,
                answerResults,
                mcqsAttempted: mcqs, // Store the questions that were presented
                score,
                totalQuestions,
                submittedAt: Timestamp.now(),
            };
            await addDoc(collection(db, "quizAttempts"), quizData);
            toast.success(`Quiz submitted! Score: ${score}/${totalQuestions}`, { id: toastId, duration: 5000 });
            // Optionally: Disable MCQ section further after submission?
        } catch (error) {
            console.error("Error storing quiz data:", error);
            toast.error(`Failed to submit: ${error.message}`, { id: toastId });
        }
    };


    // --- Loading and Error States ---
    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-200 via-blue-100 to-indigo-200 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-500"></div>
                <p className="ml-4 text-lg font-medium text-gray-700 dark:text-gray-300">Loading Document...</p>
            </div>
        );
    }

    if (error) {
        return (
             <div className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-100 via-red-50 to-orange-100 dark:from-gray-900 dark:via-red-900/30 dark:to-orange-900/30 p-10">
                 <div className="bg-white dark:bg-gray-800/50 backdrop-blur-md border border-red-400 dark:border-red-600/50 text-red-700 dark:text-red-300 px-6 py-5 rounded-xl shadow-xl text-center max-w-md">
                     <p className="font-bold text-xl mb-3">Error Loading Document</p>
                     <p className="text-base mb-5">{error}</p>
                      <button
                         onClick={() => navigate("/")}
                         className="inline-flex items-center gap-2 bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                     >
                          <ArrowBackIcon fontSize="small"/> Back to Home
                      </button>
                 </div>
             </div>
        );
    }

    // --- Main Viewer Render ---
    return (
        <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-gray-100 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900">
            <Toaster position="bottom-center" toastOptions={{
                className: 'dark:bg-gray-700 dark:text-white', // Basic dark mode for toasts
            }} />

            <PanelGroup direction="horizontal" className="h-full w-full">
                {/* PDF Viewer Panel */}
                <Panel defaultSizePercentage={70} minSizePercentage={30} className="flex flex-col p-3 md:p-4 !overflow-hidden">
                    {/* Header with Glass Effect */}
                    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-lg shadow-md p-3 md:p-4 mb-3 shrink-0 border border-white/30 dark:border-gray-700/50">
                        <div className="flex flex-wrap justify-between items-center gap-2">
                            <h1 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white truncate flex-1 mr-4" title={document?.originalName || document?.name}>
                                {document?.originalName || document?.name || "Document"}
                            </h1>
                            <button
                                onClick={() => navigate("/")}
                                className="inline-flex items-center gap-1.5 bg-gray-500 text-white px-3 py-1.5 rounded-md hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 transition-colors text-xs font-medium shadow focus:outline-none focus:ring-2 focus:ring-gray-400"
                            >
                                <ArrowBackIcon fontSize="small"/> Back to Home
                            </button>
                        </div>
                    </div>

                    {/* Viewer Container */}
                    <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
                        {pdfUrl ? (
                            <div className="h-full w-full pdf-viewer-container"> {/* Added class for potential specific styling */}
                                <Worker workerUrl={pdfjsLib.GlobalWorkerOptions.workerSrc}>
                                    <Viewer
                                        fileUrl={pdfUrl}
                                        plugins={[defaultLayoutPluginInstance, pageNavigationPluginInstance]}
                                        onPageChange={handlePageChange}
                                        key={pdfUrl} // Re-mount viewer if URL changes
                                    />
                                </Worker>
                            </div>
                        ) : (
                            <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400 text-lg">
                                PDF could not be loaded.
                            </div>
                        )}
                    </div>
                </Panel>

                {/* Resize Handle */}
                <PanelResizeHandle className="w-2 bg-gray-300/50 dark:bg-gray-700/50 hover:bg-indigo-300 dark:hover:bg-indigo-600 transition-colors duration-200 flex items-center justify-center cursor-col-resize">
                    <div className="w-px h-8 bg-gray-500 dark:bg-gray-400 rounded-full"></div> {/* Simple visual indicator */}
                </PanelResizeHandle>

                {/* Sidebar Panel */}
                <Panel defaultSizePercentage={30} minSizePercentage={20} className="flex flex-col p-3 md:p-4 !overflow-hidden">
                     {/* Glassmorphism Sidebar Content Area */}
                    <div className="flex-1 bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-xl shadow-xl overflow-y-auto p-4 md:p-5 space-y-6 border border-white/40 dark:border-gray-700/60 custom-scrollbar"> {/* Added custom-scrollbar class */}

                        {/* --- Section: Ask Question --- */}
                        <section aria-labelledby="ask-question-heading">
                             <h2 id="ask-question-heading" className="text-lg font-semibold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                                 <HelpOutlineIcon /> Ask About Page {currentPage}
                             </h2>
                            <div className="flex flex-col gap-3">
                                <input
                                    type="text"
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    placeholder="Type your question..."
                                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition"
                                />
                                <button
                                    onClick={handleQuestionSubmit}
                                    disabled={processingAi || !question.trim() || !pdfDocProxy}
                                    className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                                >
                                    {processingAi ? (
                                        <> <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div> Thinking... </>
                                    ) : (
                                        <> <SendIcon fontSize="small"/> Ask Question </>
                                    )}
                                </button>
                            </div>

                            {/* Display Answer & Context */}
                            {answer && (
                                <div className="mt-4 p-3 bg-blue-100/70 dark:bg-blue-900/50 rounded-lg border border-blue-200 dark:border-blue-700/70 shadow-inner">
                                    <h3 className="font-semibold text-sm mb-1 text-blue-800 dark:text-blue-200">Answer:</h3>
                                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{answer}</p>
                                </div>
                            )}
                             {relevantChunks.length > 0 && (
                                <div className="mt-3">
                                    <h3 className="font-semibold text-xs mb-1.5 text-gray-600 dark:text-gray-400">Relevant Context:</h3>
                                    <div className="space-y-1.5 max-h-28 overflow-y-auto border dark:border-gray-600/50 rounded-md p-2 bg-gray-100/50 dark:bg-gray-700/40 text-xs text-gray-600 dark:text-gray-300 italic custom-scrollbar-thin">
                                        {relevantChunks.map((chunk, index) => (
                                            <p key={index} className="border-b border-gray-200 dark:border-gray-600 last:border-b-0 pb-1 mb-1">...{chunk}...</p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Divider */}
                         <hr className="border-t border-gray-300/50 dark:border-gray-600/50 my-4" />

                        {/* --- Section: Test Knowledge (MCQs) --- */}
                        <section aria-labelledby="test-knowledge-heading">
                            <h2 id="test-knowledge-heading" className="text-lg font-semibold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                                 <AssignmentTurnedInIcon /> Test Knowledge (Page {currentPage})
                             </h2>
                            <div className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                                    <div>
                                         <label htmlFor="mcq-number" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"> Questions </label>
                                        <select id="mcq-number" value={mcqSettings.number} onChange={(e) => setMcqSettings(prev => ({ ...prev, number: parseInt(e.target.value) }))} className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm bg-white/80 dark:bg-gray-700/80 text-gray-900 dark:text-white transition">
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                    </div>
                                    
                                </div>
                                <button
                                    onClick={handleGenerateMCQs}
                                    disabled={generatingMCQs || !pdfDocProxy}
                                    className="w-full inline-flex items-center justify-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-md shadow hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                                >
                                    {generatingMCQs ? (
                                        <> <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div> Generating... </>
                                    ) : (
                                        <> <PsychologyIcon fontSize="small"/> Generate MCQs </>
                                    )}
                                </button>
                            </div>

                            {/* MCQs Display */}
                             {mcqs && (
                                <div className="mt-5 space-y-4">
                                    {Object.entries(mcqs).map(([questionNo, questionData]) => {
                                        const result = answerResults[questionNo];
                                        const showExplanation = showExplanations[questionNo];

                                        return (
                                            <div key={questionNo} className="p-4 bg-white/40 dark:bg-gray-700/40 rounded-lg border border-gray-300/50 dark:border-gray-600/50 shadow-sm">
                                                <p className="font-medium text-sm mb-3 text-gray-800 dark:text-gray-100">
                                                    {questionData.no || questionNo}. {questionData.mcq}
                                                </p>
                                                <div className="space-y-2">
                                                    {Object.entries(questionData.options).map(([letter, text]) => {
                                                        const isSelected = userAnswers[questionNo] === letter;
                                                        const isCorrectAnswer = letter === result?.correctAnswer;
                                                        let buttonClass = "border border-gray-300 dark:border-gray-500 bg-white/60 dark:bg-gray-600/60 hover:bg-gray-200/60 dark:hover:bg-gray-500/60"; // Default

                                                        if (isSelected) {
                                                            buttonClass = result?.isCorrect
                                                                ? "border-green-400 bg-green-100/70 dark:bg-green-800/50 ring-1 ring-green-500 text-green-900 dark:text-green-100"
                                                                : "border-red-400 bg-red-100/70 dark:bg-red-800/50 ring-1 ring-red-500 text-red-900 dark:text-red-100";
                                                        } else if (result && isCorrectAnswer) {
                                                            // Highlight correct answer after selection if user was wrong
                                                            buttonClass = "border-green-400 bg-green-100/50 dark:bg-green-800/30";
                                                        }

                                                        return (
                                                            <button
                                                                key={letter}
                                                                onClick={() => handleAnswerSelect(questionNo, letter)}
                                                                disabled={!!result}
                                                                className={`w-full flex items-center gap-2.5 p-2.5 rounded-md text-left text-sm transition-all duration-150 ${buttonClass} ${!!result ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                                                            >
                                                                <span className="font-mono font-semibold text-gray-600 dark:text-gray-400">{letter}.</span>
                                                                <span className={`flex-1 ${isSelected && result ? '' : 'text-gray-800 dark:text-gray-200'}`}>{text}</span>
                                                                {isSelected && result?.isCorrect && <CheckCircleOutlineIcon fontSize="small" className="text-green-600 dark:text-green-400 ml-auto shrink-0"/>}
                                                                {isSelected && !result?.isCorrect && <HighlightOffIcon fontSize="small" className="text-red-600 dark:text-red-400 ml-auto shrink-0"/>}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {/* Explanation Toggle & Display */}
                                                {result && (
                                                    <div className="mt-3">
                                                        <button
                                                            onClick={() => toggleExplanation(questionNo)}
                                                            className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
                                                        >
                                                            {showExplanation ? <VisibilityOffIcon fontSize="inherit"/> : <VisibilityIcon fontSize="inherit"/>}
                                                            {showExplanation ? "Hide" : "Show"} Explanation
                                                        </button>
                                                        {showExplanation && (
                                                            <div className="mt-1.5 p-2 bg-blue-100/60 dark:bg-blue-900/40 rounded text-xs border border-blue-200/80 dark:border-blue-700/60 text-gray-700 dark:text-gray-300 shadow-inner">
                                                                <p><span className="font-semibold">Explanation:</span> {result.explanation}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Submit Quiz Button */}
                                    {Object.keys(mcqs).length > 0 && (
                                        <div className="mt-5 pt-4 border-t border-gray-300/50 dark:border-gray-600/50">
                                             <button
                                                 onClick={handleQuizSubmit}
                                                 disabled={Object.keys(userAnswers).length === 0} // Only disable if no answers AT ALL
                                                 className="w-full inline-flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md shadow hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                                             >
                                                 <SaveIcon fontSize="small"/> Submit Attempt ({calculateScore()}/{Object.keys(mcqs).length})
                                             </button>
                                         </div>
                                     )}
                                </div>
                             )}
                        </section>

                         {/* Divider */}
                         <hr className="border-t border-gray-300/50 dark:border-gray-600/50 my-4" />

                        {/* --- Section: Page Summary --- */}
                        <section aria-labelledby="page-summary-heading">
                             <h2 id="page-summary-heading" className="text-lg font-semibold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                                <SummarizeIcon /> Page {currentPage} Summary
                            </h2>
                            <button
                                onClick={handleGenerateSummary}
                                disabled={generatingSummary || !pdfDocProxy}
                                className="w-full inline-flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-md shadow hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                            >
                                {generatingSummary ? (
                                    <> <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div> Generating... </>
                                ) : (
                                    <> <PsychologyIcon fontSize="small"/> Generate Summary </>
                                )}
                            </button>
                             {summary && !generatingSummary && (
                                <div className="mt-4 p-3 bg-gray-100/70 dark:bg-gray-700/50 rounded-lg border border-gray-200/80 dark:border-gray-600/60 shadow-inner">
                                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{summary}</p>
                                </div>
                            )}
                            {!summary && !generatingSummary && !error && ( // Don't show placeholder if there was an error generating
                                 <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400 italic">Click button to generate summary for page {currentPage}.</p>
                             )}
                        </section>

                    </div>
                </Panel>
            </PanelGroup>
        </div>
    );
};

export default DocumentViewer;

// Add this to your global CSS file (e.g., index.css or App.css)
// for better scrollbar styling (optional)
/*
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5); // gray-400/50
  border-radius: 10px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(107, 114, 128, 0.6); // gray-500/60
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
   background-color: rgba(75, 85, 99, 0.5); // gray-600/50
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(55, 65, 81, 0.6); // gray-700/60
}

// Thin scrollbar variant
.custom-scrollbar-thin::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
.custom-scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.4); // gray-400/40
  border-radius: 10px;
  border: 1px solid transparent;
}
.custom-scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: rgba(107, 114, 128, 0.5); // gray-500/50
}
.dark .custom-scrollbar-thin::-webkit-scrollbar-thumb {
   background-color: rgba(75, 85, 99, 0.4); // gray-600/40
}
.dark .custom-scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background-color: rgba(55, 65, 81, 0.5); // gray-700/50
}
*/
=======
import { collection, doc, getDoc, addDoc } from "firebase/firestore"; // added addDoc here
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { db, auth } from "../firebase-config";
import * as pdfjsLib from "pdfjs-dist";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import { DocumentProcessor } from "./document-utils";
import { Button } from "@mui/material";

const DocumentViewer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageText, setPageText] = useState("");
  const [summary, setSummary] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [processingAi, setProcessingAi] = useState(false);
  const [extractingText, setExtractingText] = useState(false);
  const [relevantChunks, setRelevantChunks] = useState([]);

  const docProcessor = useRef(new DocumentProcessor());
  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const [mcqs, setMCQs] = useState(null);
  const [mcqSettings, setMcqSettings] = useState({
    number: 3,
    tone: "formal",
  });
  const [generatingMCQs, setGeneratingMCQs] = useState(false);
  const [userAnswers, setUserAnswers] = useState({});
  const [answerResults, setAnswerResults] = useState({});
  const [showExplanations, setShowExplanations] = useState({});

  useEffect(() => {
    loadDocument();
  }, [id]);

  const handleAnswerSelect = async (questionNo, answer) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionNo]: answer,
    }));

    try {
      const result = await docProcessor.current.checkMCQAnswer(
        questionNo,
        answer,
        mcqs
      );
      setAnswerResults((prev) => ({
        ...prev,
        [questionNo]: result,
      }));
      setShowExplanations((prev) => ({
        ...prev,
        [questionNo]: true,
      }));
    } catch (error) {
      setError("Error checking answer: " + error.message);
    }
  };

  const toggleExplanation = (questionNo) => {
    setShowExplanations((prev) => ({
      ...prev,
      [questionNo]: !prev[questionNo],
    }));
  };

  const loadDocument = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, "documents", id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("Document not found");
      }

      const documentData = { id: docSnap.id, ...docSnap.data() };
      setDocument(documentData);

      const storage = getStorage();
      const fileRef = ref(
        storage,
        `documents/${auth.currentUser.uid}/${documentData.subject}/${documentData.name}`
      );
      const url = await getDownloadURL(fileRef);
      setPdfUrl(url);

      // Load PDF document
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPdfDoc(pdf);

      // Viewer will handle page change
      setCurrentPage(1);
    } catch (err) {
      console.error("Error loading document:", err);
      setError("Error loading document. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  async function handleGenerateSummary() {
    try {
      setExtractingText(true);

      if (!pdfDoc) {
        console.warn("PDF document not loaded yet");
        return;
      }

      if (currentPage < 1 || currentPage > pdfDoc.numPages) {
        console.error(
          `Invalid page number: ${currentPage}. Total pages: ${pdfDoc.numPages}`
        );
        return;
      }

      const result = await docProcessor.current.processPageContent(
        pdfDoc,
        currentPage
      );
      setPageText(result.text);
      if (result.summary) {
        setSummary(result.summary);
      }
    } catch (error) {
      console.error("Error processing page:", error);
      setError("Error processing page content");
    } finally {
      setExtractingText(false);
    }
  }

  const handlePageChange = async (e) => {
    const newPage = e.currentPage + 1;
    setCurrentPage(newPage);
  };

  const handleGenerateMCQs = async () => {
    try {
      setGeneratingMCQs(true);
      if (!pdfDoc) {
        setError("PDF document is not loaded yet");
        return;
      }
      // Extract text from the current page only
      const currentPageText = await docProcessor.current.extractPageText(pdfDoc, currentPage);
      // Generate MCQs based on the extracted text and provided settings
      const result = await docProcessor.current.generateMCQs(currentPageText, mcqSettings);
      setMCQs(result);
    } catch (error) {
      setError("Error generating MCQs: " + error.message);
    } finally {
      setGeneratingMCQs(false);
    }
  };
  

  const handleQuestionSubmit = async () => {
    if (!question.trim()) return;
  
    try {
      setProcessingAi(true);
      setAnswer(null);
      setRelevantChunks([]);
  
      // First, ensure we have the current page's text
      const currentPageText = await docProcessor.current.extractPageText(pdfDoc, currentPage);
      
      // Initialize the vector store with the current page's text
      await docProcessor.current.initializeVectorStore(currentPageText);
  
      // Now we can process the question
      const { answer: answerText, relevantChunks: chunks } =
        await docProcessor.current.answerQuestion(question);
  
      setAnswer(answerText);
      setRelevantChunks(chunks);
    } catch (error) {
      console.error("Error processing question:", error);
      setError("Error processing question");
    } finally {
      setProcessingAi(false);
    }
  };

  // New function to store quiz attempt data in Firestore.
// Helper function to calculate the score
const calculateScore = () => {
  let score = 0;
  // Loop through each question's result in answerResults.
  for (const question in answerResults) {
    if (answerResults.hasOwnProperty(question)) {
      // Increment score if the answer is correct.
      if (answerResults[question].isCorrect) {
        score++;
      }
    }
  }
  return score;
};

const handleQuizSubmit = async () => {
  try {
    const score = calculateScore();
    // Construct the quiz attempt data.
    const quizData = {
      userId: auth.currentUser.uid,
      documentId: id,
      userAnswers,       // e.g. { "1": "A", "2": "B", ... }
      answerResults,     // e.g. { "1": { isCorrect: true, correctAnswer: "A", explanation: "..." }, ... }
      score,             // The calculated score
      submittedAt: new Date().toISOString(),
    };
    await addDoc(collection(db, "quizAttempts"), quizData);
    alert(`Quiz data submitted successfully! Your score is: ${score}`);
  } catch (error) {
    console.error("Error storing quiz data:", error);
    alert("Failed to submit quiz data");
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
              onClick={() => navigate("/")}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Back to Home
            </button>
          </div>
        </div>

        {pdfUrl && (
          <div
            className="bg-white rounded-lg shadow-md p-4"
            style={{ height: "calc(100vh - 200px)" }}
          >
            <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
              <Viewer
                fileUrl={pdfUrl}
                plugins={[
                  defaultLayoutPluginInstance,
                  pageNavigationPluginInstance,
                ]}
                onPageChange={handlePageChange}
              />
            </Worker>
          </div>
        )}
      </div>

      {/* Sidebar Section */}
      <div
        className="w-[35%] p-4 bg-white shadow-lg overflow-y-auto"
        style={{ height: "calc(100vh - 32px)" }}
      >
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
              {processingAi ? "Processing..." : "Ask Question"}
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
                  <div
                    key={index}
                    className="p-3 bg-gray-50 rounded border border-gray-200"
                  >
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
              <label className="block text-sm font-medium mb-1">
                Number of Questions
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={mcqSettings.number}
                onChange={(e) =>
                  setMcqSettings((prev) => ({
                    ...prev,
                    number: parseInt(e.target.value),
                  }))
                }
                className="w-full p-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Question Style
              </label>
              <select
                value={mcqSettings.tone}
                onChange={(e) =>
                  setMcqSettings((prev) => ({ ...prev, tone: e.target.value }))
                }
                className="w-full p-2 border rounded"
              >
                <option value="formal">Formal</option>
                <option value="informal">Casual</option>
              </select>
            </div>
            <button
              onClick={handleGenerateMCQs}
              // disabled={generatingMCQs || !pageText}
              className={`w-full px-4 py-2 rounded text-white ${
                generatingMCQs || !pageText
                  ? "bg-gray-400"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
            >
              {generatingMCQs ? "Generating..." : "Generate MCQs"}
            </button>
          </div>

          {/* Updated MCQs Display Section */}
          {mcqs && (
            <div className="mt-4 space-y-4">
              {Object.entries(mcqs).map(([questionNo, question]) => (
                <div key={questionNo} className="p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium mb-2">
                    {question.no}. {question.mcq}
                  </p>
                  <div className="space-y-2 ml-4">
                    {Object.entries(question.options).map(([letter, text]) => (
                      <button
                        key={letter}
                        onClick={() => handleAnswerSelect(questionNo, letter)}
                        className={`w-full p-2 rounded text-left ${
                          userAnswers[questionNo] === letter
                            ? answerResults[questionNo]?.isCorrect
                              ? "bg-green-100 border-green-200"
                              : "bg-red-100 border-red-200"
                            : letter === answerResults[questionNo]?.correctAnswer &&
                              userAnswers[questionNo]
                            ? "bg-green-100 border-green-200"
                            : "bg-white hover:bg-gray-50"
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
                        {showExplanations[questionNo]
                          ? "Hide Explanation"
                          : "Show Explanation"}
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

          {/* Submit Quiz Button */}
          <div className="mt-4">
            <button
              onClick={handleQuizSubmit}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Submit Quiz
            </button>
          </div>
        </div>

        {/* Page Summary Section */}
        <div className="mt-6">
          <h2 className="text-xl font-bold mb-4">Page {currentPage} Summary</h2>
          <Button onClick={handleGenerateSummary}>Generate Summary</Button>
          {extractingText ? (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mr-2"></div>
              <span>Generating summary...</span>
            </div>
          ) : (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-700">
                {summary || "No summary available"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
>>>>>>> b6d099355f5caa5e739a921b39eef8cfad6959a4
