// React/Router imports first
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";

// Firebase imports
import { auth, storage, db } from "../firebase-config"; // Adjust path if needed
import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject,
} from "firebase/storage";
import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    doc,
    deleteDoc,
    Timestamp,
} from "firebase/firestore";
import { signOut } from "firebase/auth";

// UI/Animation/Utility Libraries
import { motion, AnimatePresence } from "framer-motion";
import { TypeAnimation } from "react-type-animation";
import toast, { Toaster } from 'react-hot-toast';
import axios from "axios";

// MUI Icons
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import FolderIcon from "@mui/icons-material/Folder";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import DownloadIcon from "@mui/icons-material/Download";
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import LogoutIcon from '@mui/icons-material/Logout';
import SchoolIcon from '@mui/icons-material/School';
import ForumIcon from '@mui/icons-material/Forum';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DashboardIcon from '@mui/icons-material/Dashboard';

// Other libraries (like pdfjs)
import * as pdfjs from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.entry";

// --- CONFIGURATION (AFTER IMPORTS) ---
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// --- CONSTANTS (AFTER IMPORTS & CONFIG) ---
const DEFAULT_SUBJECT = "Uncategorized";
const EXTERNAL_SUBJECT = "External Resources";
const MAX_PDF_PAGES_FOR_CLASSIFICATION = 5;
const MAX_PDF_WORDS_FOR_CLASSIFICATION = 1000;
const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY; // Replace with your actual key or use env variables
const SERPAPI_KEY = process.env.REACT_APP_SERPAPI_KEY; // Ensure this is set in your environment
const STUDY_ROOM_URL = process.env.REACT_APP_STUDY_ROOM_URL || "http://localhost:3000/"; // Default if not set

// --- Helper Function ---
const formatFirestoreTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    // Check if it's already a Date object
    if (timestamp instanceof Date) {
        return timestamp.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    // Assume it's a Firestore Timestamp object
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
     // Handle serialized format {seconds, nanoseconds} if necessary
     if (timestamp && typeof timestamp === 'object' && timestamp.seconds !== undefined && timestamp.nanoseconds !== undefined) {
          try {
               return new Timestamp(timestamp.seconds, timestamp.nanoseconds).toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
           } catch (e) {
                console.error("Error converting serialized timestamp:", e);
                return "Invalid Date";
           }
     }
     // Try parsing if it's a string
     if (typeof timestamp === 'string') {
          try {
               const date = new Date(timestamp);
               if (!isNaN(date)) { // Check if parsing was successful
                    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
               }
          } catch(e) {
             // Ignore parsing errors silently or log them
          }
     }

    console.warn("Invalid or unrecognized timestamp format received:", timestamp);
    return "Invalid Date";
};


// --- Animation Variants ---
const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const itemVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 10 },
    visible: { opacity: 1, scale: 1, y: 0 },
};

const listVariants = {
    visible: {
        transition: { staggerChildren: 0.07, delayChildren: 0.1 }
    },
    hidden: {},
};


const Home = () => {
    // State variables
    const [filesBySubject, setFilesBySubject] = useState({});
    const [uploadQueue, setUploadQueue] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null);
    const [newSubject, setNewSubject] = useState("");
    const [showSubjectDialog, setShowSubjectDialog] = useState(false);
    const [pdfSearchQuery, setPdfSearchQuery] = useState("");
    const [pdfSearchResults, setPdfSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingFiles, setIsLoadingFiles] = useState(true);
    const [welcomeQuote, setWelcomeQuote] = useState({ text: 'Loading your dose of inspiration...', author: '' });
    const [isQuoteLoading, setIsQuoteLoading] = useState(true);
    // const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Keep if sidebar toggle is needed

    const user = auth.currentUser;
    const navigate = useNavigate();
    const fileInputRef = useRef(null); // Ref for the hidden file input


    // --- AI Welcome Quote Fetch ---
    const fetchWelcomeQuote = useCallback(async () => {
        if (!GROQ_API_KEY) {
            console.warn("Groq API key not found. Skipping quote generation.");
            setWelcomeQuote({ text: "Keep learning, keep growing!" });
            setIsQuoteLoading(false);
            return;
        }
        setIsQuoteLoading(true);
        const prompt = 'Generate a very short (one sentence), inspiring quote about learning, knowledge, or studying. Format as JSON like {"quote": "Your quote here.", "author": "Author Name"}. If you cannot find a specific author, use "Unknown" or attribute it contextually like "Ancient Proverb".';
        try {
            const response = await axios.post(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                    model: "llama3-70b-8192", // Adjusted model if needed
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7,
                    response_format: { type: "json_object" },
                },
                {
                    headers: {
                        Authorization: `Bearer ${GROQ_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                    timeout: 10000,
                }
            );
            const result = response.data.choices[0]?.message?.content;
            if (result) {
                const parsedQuote = JSON.parse(result);
                setWelcomeQuote({ text: parsedQuote.quote, author: parsedQuote.author });
            } else {
                throw new Error("No content in quote response");
            }
        } catch (error) {
            console.error("Error fetching welcome quote:", error);
            setWelcomeQuote({ text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" });
        } finally {
            setIsQuoteLoading(false);
        }
    }, []);


    // --- Data Fetching ---
    const fetchSubjects = useCallback(async () => {
        if (!user) return;
        try {
            const subjectsRef = collection(db, "subjects");
            const q = query(subjectsRef, where("userId", "==", user.uid));
            const snapshot = await getDocs(q);
            const subjectsList = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })).sort((a, b) => a.name.localeCompare(b.name));
            setSubjects(subjectsList);
        } catch (error) {
            console.error("Error fetching subjects:", error);
            toast.error(`Failed to load subjects: ${error.message}`);
        }
    }, [user]);

    const loadUserFiles = useCallback(async (subjectToShow = currentFolder) => {
        if (!user) return;
        setIsLoadingFiles(true);
        try {
            const documentsRef = collection(db, "documents");
            const q = query(documentsRef, where("userId", "==", user.uid));
            const querySnapshot = await getDocs(q);

            const groupedFiles = {};
            querySnapshot.forEach((docSnap) => {
                const data = { id: docSnap.id, ...docSnap.data() };
                const subjectName = data.subject || DEFAULT_SUBJECT;
                if (!groupedFiles[subjectName]) {
                    groupedFiles[subjectName] = [];
                }
                // Ensure uploadedAt is consistently handled for sorting
                let processedTimestamp = null;
                if (data.uploadedAt) {
                    if (data.uploadedAt instanceof Timestamp) {
                        processedTimestamp = data.uploadedAt;
                    } else if (typeof data.uploadedAt.toDate === 'function') {
                        // Firestore-like object
                        processedTimestamp = Timestamp.fromDate(data.uploadedAt.toDate());
                    } else if (typeof data.uploadedAt === 'object' && data.uploadedAt.seconds !== undefined) {
                         // Serialized {seconds, nanoseconds}
                        processedTimestamp = new Timestamp(data.uploadedAt.seconds, data.uploadedAt.nanoseconds);
                    } else if (typeof data.uploadedAt === 'string') {
                        const parsedDate = new Date(data.uploadedAt);
                        if (!isNaN(parsedDate)) {
                            processedTimestamp = Timestamp.fromDate(parsedDate);
                        }
                    }
                }
                // Assign the processed timestamp or a default if invalid/missing
                data.uploadedAt = processedTimestamp instanceof Timestamp ? processedTimestamp : Timestamp.fromDate(new Date(0));

                groupedFiles[subjectName].push(data);
            });

            // Sort files within each subject group by timestamp descending
            for (const subject in groupedFiles) {
                groupedFiles[subject].sort((a, b) => (b.uploadedAt?.seconds ?? 0) - (a.uploadedAt?.seconds ?? 0));
            }

            setFilesBySubject(groupedFiles);

        } catch (error) {
            console.error("Error loading user files:", error);
            toast.error(`Failed to load documents: ${error.message}`);
        } finally {
            setIsLoadingFiles(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]); // Removed currentFolder dependency here

    // Load initial data
    useEffect(() => {
        if (user) {
            fetchWelcomeQuote();
            fetchSubjects();
            loadUserFiles(); // Load all files initially
        } else {
            // Clear state on logout
            setIsLoadingFiles(false);
            setFilesBySubject({});
            setSubjects([]);
            setCurrentFolder(null);
            setUploadQueue([]);
            setWelcomeQuote({ text: 'Please log in to continue.', author: '' });
            setIsQuoteLoading(false);
            setPdfSearchResults([]);
            setPdfSearchQuery('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, fetchSubjects, fetchWelcomeQuote, loadUserFiles]); // loadUserFiles is now stable


    // --- PDF Processing & Classification ---
    const extractTextFromPDF = async (file) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
            let text = "";
            const totalPages = pdf.numPages;
            const maxPagesToProcess = Math.min(totalPages, MAX_PDF_PAGES_FOR_CLASSIFICATION);

            for (let i = 1; i <= maxPagesToProcess; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item) => item.str).join(" ");
                text += pageText + " ";
                if (text.split(/\s+/).length > MAX_PDF_WORDS_FOR_CLASSIFICATION) break;
            }

            const words = text.split(/\s+/);
            const limitedWords = words.slice(0, MAX_PDF_WORDS_FOR_CLASSIFICATION);
            return limitedWords.join(" ");
        } catch (error) {
            console.error("Error extracting text from PDF:", error);
            toast.error(`Could not read text from ${file.name}.`);
            return "";
        }
    };

    const classifyPDFSubject = async (text) => {
        if (!text || subjects.length === 0) return DEFAULT_SUBJECT;
        if (!GROQ_API_KEY) {
            console.warn("Groq API key not found. Skipping classification.");
            return DEFAULT_SUBJECT;
        }

        const subjectList = subjects.map((s) => s.name).join(", ");
        const prompt = `Based on the text provided below, identify the most relevant subject from this list: ${subjectList}.
Text: ${text.substring(0, 1500)}
Respond ONLY with the subject name from the list. If none seem relevant, respond with "${DEFAULT_SUBJECT}".`;

        try {
            const response = await axios.post(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                    model: "llama3-8b-8192", // Using a smaller model for potentially faster classification
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.1,
                },
                {
                    headers: {
                        Authorization: `Bearer ${GROQ_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                    timeout: 15000,
                }
            );

            let classified = response.data.choices[0]?.message?.content?.trim();
            const validSubjects = [...subjects.map(s => s.name), DEFAULT_SUBJECT];

            if (!classified || !validSubjects.includes(classified)) {
                console.warn(`Classification result "${classified}" is not valid or not in list. Defaulting.`);
                classified = DEFAULT_SUBJECT;
            }
            return classified;
        } catch (error) {
            console.error("Error classifying the document:", error);
            toast.error("AI classification failed, using 'Uncategorized'.");
            return DEFAULT_SUBJECT;
        }
    };


    // --- File Upload Logic ---

    // FIXED: Accepts itemId instead of index
    const updateQueueItem = (itemId, updates) => {
        setUploadQueue((prevQueue) => {
            const index = prevQueue.findIndex(item => item.id === itemId);
            if (index === -1) {
                // This might happen if an item completes and is removed quickly,
                // or if cancel logic is added later. Log it but don't crash.
                console.warn(`updateQueueItem: Item ${itemId} not found in queue for update.`);
                return prevQueue; // Return unchanged queue
            }
            // Merge updates with the existing item found at index
            const updatedItem = { ...prevQueue[index], ...updates };
            // Create a new array with the updated item
            const newQueue = [...prevQueue];
            newQueue[index] = updatedItem;
            return newQueue;
            /* Alternative using map, might be slightly less performant for large queues:
            return prevQueue.map((item, i) =>
                i === index ? { ...item, ...updates } : item
            );
            */
        });
    };


    // FIXED: Accepts itemId instead of index
    const handleSingleFileUpload = async (fileObject, itemId) => {
        if (!user) return Promise.reject("User not logged in");

        const { file, subject: classifiedSubject } = fileObject;
        const finalSubject = classifiedSubject || DEFAULT_SUBJECT;
        // FIXED: Use itemId to update status
        updateQueueItem(itemId, { status: "uploading", progress: 0, subject: finalSubject });

        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const extension = file.name.substring(file.name.lastIndexOf('.'));
        const uniqueFileName = `${baseName}_${Date.now()}${extension}`;
        const storagePath = `documents/${user.uid}/${finalSubject}/${uniqueFileName}`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        return new Promise((resolve, reject) => {
            uploadTask.on(
                "state_changed",
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    // FIXED: Use itemId to update progress
                    updateQueueItem(itemId, { progress });
                },
                (error) => {
                    console.error(`Error uploading ${file.name}:`, error);
                    let errorMsg = "Upload failed.";
                     switch (error.code) {
                          case 'storage/unauthorized': errorMsg = "Permission denied."; break;
                          case 'storage/canceled': errorMsg = "Upload canceled."; break;
                          case 'storage/unknown': errorMsg = "An unknown storage error occurred."; break;
                          // Add more cases as needed
                     }
                    // FIXED: Use itemId to update status on error
                    updateQueueItem(itemId, { status: "failed", progress: 0, error: errorMsg });
                    toast.error(`Upload failed for ${file.name}: ${errorMsg}`);
                    reject(new Error(errorMsg)); // Reject with an Error object
                },
                async () => { // On successful upload
                    try {
                        const url = await getDownloadURL(uploadTask.snapshot.ref);
                        const docData = {
                             userId: user.uid,
                             name: uniqueFileName,
                             originalName: file.name,
                             url: url,
                             subject: finalSubject,
                             storagePath: storagePath,
                             uploadedAt: Timestamp.now(),
                             size: file.size,
                             type: file.type,
                             isExternal: false,
                        };
                        const docRef = await addDoc(collection(db, "documents"), docData);
                        // FIXED: Use itemId to update status on completion
                        // The update includes the *new permanent* docRef.id from Firestore.
                        updateQueueItem(itemId, { status: "completed", progress: 100, id: docRef.id });
                        toast.success(`${file.name} uploaded to ${finalSubject}!`);
                        // Resolve with full data including new ID
                        // Ensure uploadedAt is a Timestamp for immediate use in UI sort
                        resolve({ ...docData, id: docRef.id, uploadedAt: docData.uploadedAt });
                    } catch (firestoreError) {
                        console.error(`Error adding Firestore document for ${file.name}:`, firestoreError);
                        toast.error(`Failed to save ${file.name} metadata.`);
                        // Attempt to delete orphaned file from storage
                        try {
                            await deleteObject(storageRef);
                            console.log(`Orphaned file ${storagePath} deleted.`);
                        } catch (deleteError) {
                            console.error(`Failed to delete orphaned file ${storagePath}:`, deleteError);
                        }
                        // FIXED: Use itemId to update status on firestore error
                        updateQueueItem(itemId, { status: "failed", progress: 0, error: "Failed to save document data." });
                        reject(firestoreError); // Reject with the actual error
                    }
                }
            );
        });
    };


    // FIXED: Uses item IDs for updates within the loop
    const handleFileSelection = async (eventOrFiles) => {

        if (!user) {
            toast.error("You must be logged in to upload files.");
            return;
        }

        let filesToProcess = [];
        if (eventOrFiles.target && eventOrFiles.target.files) {
             filesToProcess = Array.from(eventOrFiles.target.files);
        } else if (Array.isArray(eventOrFiles)) {
             filesToProcess = eventOrFiles;
        }

        const selectedFiles = filesToProcess.filter(
            (file) => file.type === "application/pdf"
        );

        if (selectedFiles.length === 0) {
            if (filesToProcess.length > 0) {
                toast.error("Please select PDF files only.");
            }
            return;
        }

        const newQueueItems = selectedFiles.map((file) => ({
            file,
            status: "pending",
            progress: 0,
            subject: null,
            id: `temp-${Date.now()}-${Math.random()}` // Temporary unique ID
        }));

        // Add new items to the *beginning* of the queue state for visibility
        setUploadQueue(prev => [...newQueueItems, ...prev]);

        // Process the newly added items sequentially
        let newDocs = []; // To collect successfully added documents for UI update
        for (let i = 0; i < newQueueItems.length; i++) {
            const currentItem = newQueueItems[i]; // The item object from the initial list
            const currentItemId = currentItem.id; // The unique temporary ID

            // Update status to 'processing' using the ID
            updateQueueItem(currentItemId, { status: 'processing' });

            try {
                // --- Step 1: Extract Text ---
                const text = await extractTextFromPDF(currentItem.file);

                // --- Step 2: Classify Subject (if text extracted) ---
                const subject = await classifyPDFSubject(text);
                updateQueueItem(currentItemId, { subject: subject }); // Update subject using ID

                // --- Step 3: Upload and Save Metadata ---
                // Pass the item ID to the upload handler
                const uploadedDocData = await handleSingleFileUpload(
                    { file: currentItem.file, subject }, // Pass file and classified subject
                    currentItemId                   // Pass the unique ID
                );

                // If upload was successful, add to newDocs for UI update
                if (uploadedDocData) {
                    newDocs.push(uploadedDocData);
                }
                // Note: If handleSingleFileUpload failed, it already called updateQueueItem
                // with 'failed' status and rejected its promise. The catch block below handles rejection.

            } catch (error) {
                // Catches errors from extract/classify OR if handleSingleFileUpload rejected
                console.error(`Error processing or uploading ${currentItem.file.name}:`, error);
                // Ensure the item is marked as failed in the queue using its ID
                // It's possible handleSingleFileUpload already did this, but doing it here ensures
                // failure status even if errors occurred before handleSingleFileUpload was called.
                 updateQueueItem(currentItemId, {
                    status: 'failed',
                    error: error instanceof Error ? error.message : String(error) || 'Processing or upload failed.',
                    progress: 0 // Ensure progress is reset on failure
                });
            }
        }

        console.log("File processing loop finished.");

        // Update UI state (filesBySubject) immediately with successfully added docs
        if (newDocs.length > 0) {
             setFilesBySubject(prevFiles => {
                 const updatedFiles = { ...prevFiles };
                 newDocs.forEach(docData => {
                     // Make sure docData and uploadedAt are valid before proceeding
                     if (!docData || !docData.subject || !docData.uploadedAt) {
                         console.warn("Skipping invalid docData during UI update:", docData);
                         return;
                     }
                     const subjectName = docData.subject || DEFAULT_SUBJECT;
                     if (!updatedFiles[subjectName]) {
                         updatedFiles[subjectName] = [];
                     }
                     // Add and re-sort by timestamp descending
                     // Ensure all items being sorted have a valid `uploadedAt` Timestamp
                     updatedFiles[subjectName] = [docData, ...updatedFiles[subjectName]]
                         .sort((a, b) => {
                              const timeA = a.uploadedAt instanceof Timestamp ? a.uploadedAt.seconds : 0;
                              const timeB = b.uploadedAt instanceof Timestamp ? b.uploadedAt.seconds : 0;
                              return timeB - timeA;
                         });
                 });
                 return updatedFiles;
             });
        }

        // Auto-clear successful uploads from the queue after a delay
        setTimeout(() => {
            setUploadQueue(prev => prev.filter(item => item.status !== 'completed'));
        }, 5000); // 5 seconds

        // Reset file input to allow selecting the same file again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = null;
        }
    };


    // --- File Deletion ---
    const handleDeleteFile = async (fileToDelete) => {
        toast((t) => (
            <div className="flex flex-col items-center p-2">
                <p className="mb-3 text-center font-medium">Delete "{fileToDelete.originalName || fileToDelete.name}"?</p>
                <div className="flex gap-3">
                    <button
                        onClick={() => { toast.dismiss(t.id); performDelete(fileToDelete); }}
                        className="px-4 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    > Delete </button>
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="px-4 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
                    > Cancel </button>
                </div>
            </div>
        ), { duration: 60000, position: "top-center" });
    };

    const performDelete = async (fileToDelete) => {
         if (!user || !fileToDelete || !fileToDelete.id) {
            console.error("Delete condition not met:", {user, fileToDelete});
            toast.error("Cannot delete file: Invalid data or not logged in.");
            return;
         };

        let storagePath = fileToDelete.storagePath;
        // Reconstruct path if missing for non-external files (less ideal but fallback)
        if (!storagePath && !fileToDelete.isExternal) {
            console.warn("Storage path missing for non-external file, attempting reconstruction:", fileToDelete.name);
            const subject = fileToDelete.subject || DEFAULT_SUBJECT;
            storagePath = `documents/${user.uid}/${subject}/${fileToDelete.name}`; // fileToDelete.name here is the unique Firestore name
        }

        const docRef = doc(db, "documents", fileToDelete.id);
        const loadingToastId = toast.loading(`Deleting ${fileToDelete.originalName || fileToDelete.name}...`);

        try {
            // 1. Delete Firestore document
            await deleteDoc(docRef);

            // 2. Delete file from Storage (only if not external and path exists)
            if (!fileToDelete.isExternal && storagePath) {
                try {
                     const storageRef = ref(storage, storagePath);
                     await deleteObject(storageRef);
                } catch (storageError) {
                    // Log storage deletion error but proceed with UI update
                    console.error(`Failed to delete file from storage (${storagePath}), but Firestore doc was deleted:`, storageError);
                    // Optionally notify user about potential orphaned file
                    toast.error(`Metadata deleted, but storage file removal failed: ${storageError.code}`, { duration: 5000 });
                }
            }

            toast.success("File deleted successfully.", { id: loadingToastId });

            // 3. Update UI State
            setFilesBySubject(prevFiles => {
                const subject = fileToDelete.subject || DEFAULT_SUBJECT;
                if (!prevFiles[subject]) return prevFiles; // Subject already gone?

                const updatedSubjectFiles = prevFiles[subject].filter(f => f.id !== fileToDelete.id);
                const newFilesState = { ...prevFiles };

                if (updatedSubjectFiles.length > 0) {
                    newFilesState[subject] = updatedSubjectFiles;
                } else {
                    delete newFilesState[subject]; // Remove subject key if empty
                     // Check if the deleted file was in the currently viewed folder and if that folder is now empty
                     if (currentFolder === subject) {
                        // If the current folder is now empty, navigate back to 'All Documents' view
                        // Use queueMicrotask or setTimeout to ensure state update completes before navigation
                         queueMicrotask(() => setCurrentFolder(null));
                        // Alternative: setTimeout(() => setCurrentFolder(null), 0);
                    }
                }
                return newFilesState;
            });

        } catch (error) {
            console.error("Error deleting file (Firestore or main process):", error);
            toast.error(`Error deleting file: ${error.message}`, { id: loadingToastId });
        }
    };


    // --- Subject Management ---
    const addSubjectHandler = async () => {
         if (!user) return;
        const trimmedSubject = newSubject.trim();
        if (!trimmedSubject) return;

        if (subjects.some(s => s.name.toLowerCase() === trimmedSubject.toLowerCase())) {
            toast.error(`Subject "${trimmedSubject}" already exists.`);
            return;
        }
        // Prevent creating subjects with reserved names
        if ([DEFAULT_SUBJECT.toLowerCase(), EXTERNAL_SUBJECT.toLowerCase()].includes(trimmedSubject.toLowerCase())) {
            toast.error(`Cannot create a subject with the reserved name "${trimmedSubject}".`);
            return;
        }

        const loadingToastId = toast.loading(`Adding subject "${trimmedSubject}"...`);
        try {
            const docRef = await addDoc(collection(db, "subjects"), {
                name: trimmedSubject,
                userId: user.uid,
                createdAt: Timestamp.now(),
            });
            const newSubjectData = { id: docRef.id, name: trimmedSubject, userId: user.uid, createdAt: Timestamp.now() }; // Include createdAt
            setSubjects(prev => [...prev, newSubjectData].sort((a, b) => a.name.localeCompare(b.name)));
            setNewSubject("");
            toast.success(`Subject "${trimmedSubject}" added.`, { id: loadingToastId });
            // Consider closing the dialog after adding?
            // setShowSubjectDialog(false);
        } catch (error) {
            console.error("Error adding subject:", error);
            toast.error(`Failed to add subject: ${error.message}`, { id: loadingToastId });
        }
    };


    // --- PDF Search ---
    const handlePdfSearch = async () => {
         if (!user || !pdfSearchQuery.trim()) return;
        if (!SERPAPI_KEY) {
            toast.error("PDF Search feature is not configured by the administrator.");
            console.warn("SerpApi key (REACT_APP_SERPAPI_KEY) not found in environment variables.");
            return;
        }
        setIsSearching(true);
        setPdfSearchResults([]); // Clear previous results
        const loadingToastId = toast.loading("Searching for PDFs online...");
        try {
            // Ensure 'filetype:pdf' is part of the query for better results
            const searchQuery = pdfSearchQuery.toLowerCase().includes("filetype:pdf")
                ? pdfSearchQuery
                : `${pdfSearchQuery} filetype:pdf`;

            // --- SECURITY WARNING ---
            // Exposing API keys on the client-side (like SERPAPI_KEY) is insecure.
            // This request should ideally be proxied through a backend server or a Cloud Function
            // where the API key is stored securely.
            console.warn("SECURITY WARNING: Making SerpApi request directly from client. Consider using a backend proxy.");
            const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchQuery)}&api_key=${SERPAPI_KEY}`;
            // Alternative using a hypothetical backend endpoint:
            // const url = `/api/search-pdfs?q=${encodeURIComponent(searchQuery)}`;

            const response = await axios.get(url, { timeout: 20000 }); // 20 second timeout

            // Process results carefully, checking for expected structure
            const results = response.data?.organic_results || [];
            const pdfResults = results.filter(result =>
                result.link && (
                    result.link.toLowerCase().endsWith('.pdf') ||
                    result.file_format?.toLowerCase() === 'pdf' ||
                    result.link.toLowerCase().includes('.pdf?') // Handle links with query params
                 )
            ).map((result) => ({
                id: result.link, // Use link as a temporary unique key for the list
                title: result.title || "Untitled PDF",
                snippet: result.snippet || "No description available.",
                downloadLink: result.link,
                source: result.displayed_link || result.source || new URL(result.link).hostname, // Extract domain as fallback source
            }));

            if (pdfResults.length === 0) {
                toast.info("No direct PDF links found in search results.", { id: loadingToastId });
            } else {
                toast.success(`Found ${pdfResults.length} potential PDF results.`, { id: loadingToastId });
            }
            setPdfSearchResults(pdfResults);

        } catch (error) {
            console.error("Error searching for PDF via SerpApi:", error);
            let errorMsg = 'PDF search request failed.';
            if (error.response) {
                errorMsg = `Search error: ${error.response.status} ${error.response.data?.error || ''}`;
            } else if (error.request) {
                errorMsg = 'Search error: No response from server.';
            } else if (error.message) {
                 errorMsg = error.message;
            }
             if (error.code === 'ERR_NETWORK') {
                 errorMsg = "Network error. Check connection or proxy/CORS setup.";
             } else if (error.message?.includes('timeout')) {
                 errorMsg = "Search request timed out.";
             }
            toast.error(errorMsg, { id: loadingToastId });
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddExternalPdf = async (result) => {
         if (!user || !result.downloadLink) return;

        const loadingToastId = toast.loading(`Adding link for "${result.title}"...`);
        try {
            // Check if this exact URL already exists for this user in External Resources
            const externalDocsRef = collection(db, "documents");
            const q = query(externalDocsRef,
                where("userId", "==", user.uid),
                where("subject", "==", EXTERNAL_SUBJECT),
                where("url", "==", result.downloadLink)
            );
            const existingDocs = await getDocs(q);
            if (!existingDocs.empty) {
                 toast.error(`"${result.title}" is already saved in ${EXTERNAL_SUBJECT}.`, { id: loadingToastId });
                 // Remove from search results anyway as it's handled
                 setPdfSearchResults(prev => prev.filter(r => r.downloadLink !== result.downloadLink));
                 return;
            }


            const docData = {
                userId: user.uid,
                name: result.title, // Use title as the name
                originalName: result.title,
                url: result.downloadLink,
                subject: EXTERNAL_SUBJECT,
                storagePath: null, // No storage path for external links
                uploadedAt: Timestamp.now(),
                isExternal: true,
                source: result.source || new URL(result.downloadLink).hostname
            };
            const docRef = await addDoc(collection(db, "documents"), docData);
             const newDocWithId = { ...docData, id: docRef.id };


            toast.success(`"${result.title}" added to ${EXTERNAL_SUBJECT}.`, { id: loadingToastId });

            // Update UI state immediately
            setFilesBySubject(prevFiles => {
                const updatedFiles = { ...prevFiles };
                const subjectName = EXTERNAL_SUBJECT;
                if (!updatedFiles[subjectName]) updatedFiles[subjectName] = [];
                 // Add and re-sort
                 updatedFiles[subjectName] = [newDocWithId, ...updatedFiles[subjectName]]
                     .sort((a, b) => (b.uploadedAt?.seconds ?? 0) - (a.uploadedAt?.seconds ?? 0));
                return updatedFiles;
            });

            // Remove added item from search results
            setPdfSearchResults(prev => prev.filter(r => r.downloadLink !== result.downloadLink));

        } catch (error) {
            console.error("Error adding external PDF link:", error);
            toast.error(`Error adding link: ${error.message}`, { id: loadingToastId });
        }
    };


    // --- UI Rendering Helpers ---
    const getActiveFolders = () => {
        const subjectsFromState = subjects.map(s => s.name);
        // Include subjects from files ONLY if they are NOT the default/external ones
        // and are not already listed in the user's created subjects (handles potential orphans)
        const subjectsFromFiles = Object.keys(filesBySubject).filter(name =>
            name !== DEFAULT_SUBJECT &&
            name !== EXTERNAL_SUBJECT &&
            !subjectsFromState.includes(name) // Only add if not in user's list
        );
        const combined = [...new Set([...subjectsFromState, ...subjectsFromFiles])];
        return combined.sort((a, b) => a.localeCompare(b)); // Sort alphabetically
    };

    const getSpecialFolders = () => {
        const folders = [];
        // Only include special folders if they contain at least one file
        if (filesBySubject[DEFAULT_SUBJECT]?.length > 0) folders.push(DEFAULT_SUBJECT);
        if (filesBySubject[EXTERNAL_SUBJECT]?.length > 0) folders.push(EXTERNAL_SUBJECT);
        return folders.sort((a,b) => a.localeCompare(b)); // Sort for consistent order
    }


    // --- Render ---
    return (
        <div className="flex h-screen overflow-hidden bg-gradient-to-br from-gray-100 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900">
            <Toaster position="bottom-center" reverseOrder={false} />

             {/* --- Sidebar --- */}
             <aside className="w-64 bg-white dark:bg-gray-800 shadow-md flex flex-col overflow-y-auto transition-all duration-300 ease-in-out shrink-0 h-full">
                 {/* Logo/Title */}
                 <div className="p-4 border-b dark:border-gray-700">
                      <span className="text-xl font-semibold text-gray-800 dark:text-white">Edustation</span>
                 </div>

                 {/* Navigation/Folders */}
                 <nav className="flex-1 px-2 py-4 space-y-1">
                     {/* All Documents Button - Changed: Doesn't show files directly, acts as a dashboard view trigger */}
                     <button
                         onClick={() => setCurrentFolder(null)} // Sets view to dashboard/prompt
                         className={`flex items-center w-full px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out group ${
                             currentFolder === null ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-100' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                         }`}
                     >
                         <DashboardIcon className={`mr-3 h-5 w-5 ${currentFolder === null ? 'text-indigo-500 dark:text-indigo-300' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-300'}`} />
                         Dashboard {/* Changed label */}
                     </button>

                     {/* User-Created Subjects */}
                     {getActiveFolders().length > 0 && (
                          <div className="pt-3 mt-3 border-t dark:border-gray-700 space-y-1">
                              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">My Subjects</h3>
                              {getActiveFolders().map((subjectName) => (
                                  <button
                                      key={subjectName}
                                      onClick={() => setCurrentFolder(subjectName)}
                                      className={`flex items-center justify-between w-full px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out group ${
                                          currentFolder === subjectName ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-100' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                                      }`}
                                  >
                                      <div className="flex items-center overflow-hidden">
                                          <FolderIcon className={`mr-3 h-5 w-5 shrink-0 ${currentFolder === subjectName ? 'text-indigo-500 dark:text-indigo-300' : 'text-yellow-500 dark:text-yellow-400 group-hover:text-yellow-600 dark:group-hover:text-yellow-300'}`} />
                                          <span className="truncate" title={subjectName}>{subjectName}</span>
                                      </div>
                                      {/* Show file count */}
                                      <span className={`ml-2 text-xs font-normal px-1.5 py-0.5 rounded-full ${currentFolder === subjectName ? 'bg-indigo-200 dark:bg-indigo-700' : 'bg-gray-200 dark:bg-gray-600 group-hover:bg-gray-300 dark:group-hover:bg-gray-500'}`}>
                                          {filesBySubject[subjectName]?.length || 0}
                                      </span>
                                  </button>
                              ))}
                          </div>
                     )}

                     {/* Special Folders */}
                     {getSpecialFolders().length > 0 && (
                          <div className="pt-3 mt-3 border-t dark:border-gray-700 space-y-1">
                               <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Other</h3>
                               {getSpecialFolders().map((subjectName) => (
                                    <button
                                        key={subjectName}
                                        onClick={() => setCurrentFolder(subjectName)}
                                        className={`flex items-center justify-between w-full px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out group ${
                                            currentFolder === subjectName ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-100' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        <div className="flex items-center overflow-hidden">
                                            <FolderIcon className={`mr-3 h-5 w-5 shrink-0 ${
                                                currentFolder === subjectName ? 'text-indigo-500 dark:text-indigo-300' :
                                                subjectName === DEFAULT_SUBJECT ? 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-300' : // Uncategorized Icon Color
                                                'text-blue-500 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300' // External Icon Color
                                            }`}
                                            />
                                            <span className="truncate" title={subjectName}>{subjectName}</span>
                                        </div>
                                         {/* Show file count */}
                                        <span className={`ml-2 text-xs font-normal px-1.5 py-0.5 rounded-full ${currentFolder === subjectName ? 'bg-indigo-200 dark:bg-indigo-700' : 'bg-gray-200 dark:bg-gray-600 group-hover:bg-gray-300 dark:group-hover:bg-gray-500'}`}>
                                            {filesBySubject[subjectName]?.length || 0}
                                        </span>
                                    </button>
                               ))}
                          </div>
                     )}
                 </nav>

                 {/* Sidebar Actions */}
                 <div className="p-4 mt-auto border-t dark:border-gray-700 space-y-2">
                     <button
                          onClick={() => setShowSubjectDialog(true)}
                          className="w-full flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-teal-100 text-teal-800 hover:bg-teal-200 dark:bg-teal-700 dark:text-teal-100 dark:hover:bg-teal-600 transition-colors"
                          title="Manage Subjects"
                     >
                          <LibraryBooksIcon fontSize="small" /> Manage Subjects
                     </button>
                      <button
                           onClick={() => {
                               toast.promise(signOut(auth), {
                                   loading: 'Signing out...',
                                   success: 'Signed out successfully!',
                                   error: 'Failed to sign out.',
                               });
                               // Additional cleanup can happen in the useEffect [user] dependency
                           }}
                           className="w-full flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-700 dark:text-red-100 dark:hover:bg-red-600 transition-colors"
                           title="Sign Out"
                      >
                           <LogoutIcon fontSize="small" /> Sign Out
                      </button>

                 </div>
             </aside>

            {/* --- Main Content Area --- */}
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* Scrollable Content */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 space-y-6">

                    {/* --- Welcome Quote --- */}
                    <motion.section
                         className="bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-700 dark:to-purple-800 rounded-xl shadow-lg p-6 text-white"
                         variants={sectionVariants} initial="hidden" animate="visible"
                    >
                         <div className="flex items-start gap-4">
                              <FormatQuoteIcon className="w-10 h-10 text-indigo-200 dark:text-indigo-300 flex-shrink-0 mt-1" style={{ transform: 'scaleX(-1)'}}/>
                              <div>
                                   <h1 className="text-2xl font-semibold mb-2">Welcome, {user?.displayName || user?.email || 'Scholar'}!</h1>
                                   {isQuoteLoading ? (
                                        <div className="h-6 bg-white/30 rounded w-3/4 animate-pulse"></div>
                                   ) : (
                                        <blockquote className="italic text-lg">
                                             {welcomeQuote.text ? (
                                                  <TypeAnimation
                                                        sequence={[welcomeQuote.text, 1000]} // Ensure text exists
                                                        wrapper="span" speed={60} cursor={true} repeat={0} style={{ display: 'inline-block' }}
                                                  />
                                              ) : (
                                                  <span>Ready to learn something new?</span> // Fallback if quote is empty
                                              )}
                                             {welcomeQuote.author && <cite className="block text-right not-italic text-sm opacity-80 mt-1">- {welcomeQuote.author}</cite>}
                                        </blockquote>
                                   )}
                              </div>
                         </div>
                    </motion.section>

                    {/* --- PDF Search Section --- */}
                    

                    {/* --- Files & Folders Section (Main View) --- */}
                    <motion.section
                         className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 min-h-[400px] flex flex-col" // Added flex flex-col
                         variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}
                    >
                         {/* Header with Title AND Upload Button */}
                          <div className="flex items-center justify-between mb-5 border-b dark:border-gray-700 pb-3 gap-3">
                              {/* Left Side: Back Button and Title */}
                              <div className="flex items-center gap-2 min-w-0"> {/* Allow shrinking */}
                                   {/* Back Button - Only show when a folder is selected */}
                                   <AnimatePresence>
                                      {currentFolder && (
                                          <motion.button
                                                key="back-button"
                                                initial={{ opacity: 0, width: 0, marginRight: 0 }}
                                                animate={{ opacity: 1, width: 'auto', marginRight: '0.75rem' }}
                                                exit={{ opacity: 0, width: 0, marginRight: 0 }}
                                                transition={{ duration: 0.2 }}
                                                onClick={() => setCurrentFolder(null)}
                                                className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                                title="Back to Dashboard"
                                          > <ArrowBackIcon fontSize="small"/> </motion.button>
                                      )}
                                   </AnimatePresence>

                                   {/* Title */}
                                   <h1 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2 truncate">
                                       {/* Dynamic Icon */}
                                       {currentFolder ? (
                                           currentFolder === DEFAULT_SUBJECT ? <FolderIcon className="text-gray-500 shrink-0"/> :
                                           currentFolder === EXTERNAL_SUBJECT ? <FolderIcon className="text-blue-500 shrink-0"/> :
                                           <FolderIcon className="text-yellow-600 shrink-0"/>
                                       ) : <DashboardIcon className="text-indigo-500 shrink-0"/>}
                                       {/* Text */}
                                       <span className="truncate" title={currentFolder ? currentFolder : "Dashboard"}>
                                           {currentFolder ? currentFolder : "Dashboard"}
                                       </span>
                                   </h1>
                               </div>

                               {/* Right Side: Upload Button */}
                               <button
                                   onClick={() => fileInputRef.current?.click()}
                                   className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1 shrink-0"
                                   title="Upload PDF files"
                               >
                                   <UploadFileIcon style={{ fontSize: '1rem' }}/> Upload
                               </button>
                                {/* Hidden file input */}
                                <input
                                     ref={fileInputRef}
                                     id="file-upload-input-main"
                                     name="file-upload-input-main"
                                     type="file"
                                     accept=".pdf,application/pdf"
                                     multiple
                                     onChange={handleFileSelection}
                                     className="sr-only"
                                />
                          </div>

                         {/* Upload Queue Display Area */}
                         <AnimatePresence>
                              {uploadQueue.length > 0 && (
                                  <motion.div
                                      key="upload-queue-area"
                                      initial={{ opacity: 0, height: 0, marginBottom: '0rem' }}
                                      animate={{ opacity: 1, height: 'auto', marginBottom: '1.5rem' }} // Add margin when visible
                                      exit={{ opacity: 0, height: 0, marginBottom: '0rem', transition: { duration: 0.2 } }}
                                      transition={{ duration: 0.3, ease: "easeInOut" }}
                                      className="space-y-2 max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md border dark:border-gray-600/50"
                                  >
                                      {/* Render queue items */}
                                      {uploadQueue.map((fileObj) => ( // No index needed as key
                                          <motion.div
                                              key={fileObj.id} // Use the unique ID as the key
                                              layout // Animate layout changes
                                              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -50, transition: { duration: 0.2 } }}
                                              className="flex flex-col sm:flex-row justify-between items-center p-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 shadow-sm gap-2 text-sm"
                                          >
                                               {/* File Info */}
                                               <div className="flex items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
                                                    <PictureAsPdfIcon className="text-red-500 flex-shrink-0" fontSize="small"/>
                                                    <div className="flex-1 overflow-hidden">
                                                         <p className="font-medium truncate text-xs" title={fileObj.file?.name || 'Processing...'}>{fileObj.file?.name || 'Processing...'}</p> {/* Handle case where file might not be present yet */}
                                                         {fileObj.subject && <span className="text-xs text-gray-500 dark:text-gray-400">({fileObj.subject})</span>}
                                                    </div>
                                               </div>
                                               {/* Status/Progress */}
                                               <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                                                    {/* Show Status Icons/Text */}
                                                    {fileObj.status === "processing" && <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1 text-xs"><HourglassEmptyIcon fontSize="inherit" className="animate-spin"/> Processing...</span>}
                                                    {fileObj.status === "pending" && <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1 text-xs"><HourglassEmptyIcon fontSize="inherit"/> Pending</span>}
                                                    {fileObj.status === "uploading" && (
                                                         <div className="w-24 flex items-center gap-1" title={`Uploading (${fileObj.progress?.toFixed(0) ?? 0}%)`}>
                                                              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 overflow-hidden"><div className="bg-blue-600 h-1.5 rounded-full transition-all duration-150" style={{ width: `${fileObj.progress?.toFixed(0) ?? 0}%` }}></div></div>
                                                              <span className="text-xs text-gray-600 dark:text-gray-400 w-7 text-right">{`${fileObj.progress?.toFixed(0) ?? 0}%`}</span>
                                                         </div>
                                                    )}
                                                    {fileObj.status === "completed" && <span className="text-green-600 dark:text-green-400 flex items-center gap-1 text-xs"><CheckCircleIcon fontSize="inherit"/> Done</span>}
                                                    {fileObj.status === "failed" && <span className="text-red-600 dark:text-red-400 flex items-center gap-1 text-xs" title={fileObj.error}><ErrorIcon fontSize="inherit"/> Failed</span>}

                                                    {/* Cancel Button (Optional - Implementation needed) */}
                                                     {(fileObj.status === 'pending' || fileObj.status === 'processing' || fileObj.status === 'uploading') && (
                                                         <button
                                                             onClick={() => {
                                                                 // TODO: Implement cancel logic
                                                                 // 1. Abort Axios request if classifying/searching
                                                                 // 2. Cancel Firebase uploadTask (uploadTask.cancel())
                                                                 // 3. Remove item from queue: setUploadQueue(prev => prev.filter(item => item.id !== fileObj.id));
                                                                 toast.error('Cancel not implemented yet.');
                                                             }}
                                                             className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 ml-1 p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                             title="Cancel Upload"
                                                             aria-label="Cancel upload"
                                                         >
                                                             <CloseIcon style={{ fontSize: '0.9rem' }}/>
                                                         </button>
                                                     )}
                                                      {/* Remove Button for Failed/Completed (Optional) */}
                                                      {(fileObj.status === 'failed' || fileObj.status === 'completed') && (
                                                           <button
                                                                onClick={() => setUploadQueue(prev => prev.filter(item => item.id !== fileObj.id))}
                                                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-1 p-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                                title="Clear from queue"
                                                                aria-label="Clear from queue"
                                                            >
                                                                <CloseIcon style={{ fontSize: '0.9rem' }} />
                                                            </button>
                                                       )}
                                               </div>
                                          </motion.div>
                                      ))}
                                  </motion.div>
                              )}
                         </AnimatePresence>

                         {/* Content Area: Loading State, Prompt, or File Grid */}
                         <div className="flex-1 mt-2"> {/* Added flex-1 to allow this area to grow */}
                             {isLoadingFiles ? (
                                  <div className="flex justify-center items-center h-full">
                                      <div className="text-center py-10">
                                           <div className="animate-spin inline-block w-6 h-6 border-4 border-blue-500 dark:border-blue-400 border-t-transparent rounded-full"></div>
                                           <p className="mt-2 text-gray-600 dark:text-gray-400">Loading documents...</p>
                                      </div>
                                  </div>
                             ) : (
                                  <AnimatePresence mode="wait">
                                      {currentFolder === null ? (
                                           // Dashboard / Prompt View (when no folder is selected)
                                           <motion.div
                                               key="dashboard-prompt"
                                               initial={{ opacity: 0 }}
                                               animate={{ opacity: 1 }}
                                               exit={{ opacity: 0 }}
                                               className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400 p-6"
                                           >
                                                <SchoolIcon style={{ fontSize: 60 }} className="mb-4 text-indigo-300 dark:text-indigo-600" />
                                                <h2 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Your Learning Hub</h2>
                                                <p className="mb-4 max-w-md">
                                                    Select a subject from the sidebar to view your documents, or use the tools above to find and add new resources.
                                                </p>
                                                {getActiveFolders().length === 0 && getSpecialFolders().length === 0 && (
                                                    <p className="text-sm mt-4 italic">
                                                         Looks like you haven't uploaded any documents yet. Click the 'Upload' button to get started!
                                                    </p>
                                                )}
                                           </motion.div>
                                      ) : (
                                           // File View (Grid for the selected folder)
                                           <motion.div
                                               key={`folder-view-${currentFolder}`} // Unique key per folder
                                               initial={{ opacity: 0 }}
                                               animate={{ opacity: 1 }}
                                               exit={{ opacity: 0 }}
                                           >
                                               {filesBySubject[currentFolder] && filesBySubject[currentFolder].length > 0 ? (
                                                    <motion.div
                                                         variants={listVariants} // Apply stagger to the grid itself
                                                         initial="hidden"
                                                         animate="visible"
                                                         className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                                                    >
                                                         {filesBySubject[currentFolder].map((file) => (
                                                             // --- PDF Card Component ---
                                                             <motion.div
                                                                 key={file.id} // Use Firestore ID as key
                                                                 variants={itemVariants} // Item animation
                                                                 layout // Animate layout changes (e.g., when deleting)
                                                                 className="bg-gray-50 dark:bg-gray-700/60 rounded-lg shadow hover:shadow-lg transition-shadow duration-200 flex flex-col overflow-hidden border dark:border-gray-600/50"
                                                             >
                                                                  {/* Card Header (Clickable Area) */}
                                                                  <div
                                                                       className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors"
                                                                       title={file.isExternal ? `Open external link: ${file.url}` : `Open document: ${file.originalName || file.name}`}
                                                                       onClick={() => file.isExternal ? window.open(file.url, '_blank', 'noopener,noreferrer') : navigate(`/document/${file.id}`)}
                                                                   >
                                                                        {file.isExternal
                                                                            ? <OpenInNewIcon className="text-blue-500 dark:text-blue-400 shrink-0" fontSize="medium"/>
                                                                            : <PictureAsPdfIcon className="text-red-500 dark:text-red-400 shrink-0" fontSize="medium"/> }
                                                                        <span className="font-medium text-sm text-gray-800 dark:text-gray-100 truncate flex-1">
                                                                             {file.originalName || file.name}
                                                                        </span>
                                                                   </div>
                                                                   {/* Card Body (Metadata) */}
                                                                   <div className="px-3 pb-2 text-xs text-gray-500 dark:text-gray-400 border-t dark:border-gray-600/50 pt-2 space-y-1">
                                                                        <p title={file.uploadedAt?.toDate ? file.uploadedAt.toDate().toLocaleString() : 'N/A'}>
                                                                            Added: {formatFirestoreTimestamp(file.uploadedAt)}
                                                                        </p>
                                                                        {file.isExternal && file.source && <p className="truncate" title={`Source: ${file.source}`}>Source: {file.source}</p>}
                                                                        {!file.isExternal && file.size && <p>Size: { (file.size / 1024 / 1024).toFixed(2) } MB</p>}
                                                                   </div>
                                                                   {/* Card Footer (Actions) */}
                                                                   <div className="mt-auto p-2 border-t dark:border-gray-600/50 bg-gray-100 dark:bg-gray-700/40 flex justify-end gap-2">
                                                                        {/* Open/View Button */}
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); file.isExternal ? window.open(file.url, '_blank', 'noopener,noreferrer') : navigate(`/document/${file.id}`); }}
                                                                            className={`${file.isExternal ? 'text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50' : 'text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'} p-1 rounded`}
                                                                            title={file.isExternal ? "Open External Link" : "Open Document"}
                                                                        >
                                                                            {file.isExternal ? <OpenInNewIcon fontSize="inherit"/> : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-.006.012-.01.024-.016.036a14.01 14.01 0 01-1.51 2.617M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                                                                        </button>
                                                                        {/* Delete Button */}
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleDeleteFile(file); }}
                                                                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/50"
                                                                            title="Delete File"
                                                                        >
                                                                            <DeleteIcon fontSize="inherit"/>
                                                                        </button>
                                                                   </div>
                                                             </motion.div>
                                                             // --- End PDF Card ---
                                                         ))}
                                                    </motion.div>
                                               ) : (
                                                    // Empty State for Files within a folder
                                                    <motion.div
                                                        key="empty-folder-prompt"
                                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                        className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400 py-10 border-2 border-dashed dark:border-gray-600 rounded-lg"
                                                    >
                                                         <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                         <p className="mt-3 font-medium text-gray-700 dark:text-gray-300">This folder is empty.</p>
                                                         <p className="text-sm mt-1">Upload PDF documents to '{currentFolder}' to see them here.</p>
                                                         <button onClick={() => fileInputRef.current?.click()} className="mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium inline-flex items-center gap-1">
                                                            <UploadFileIcon fontSize="inherit"/> Upload File
                                                         </button>
                                                    </motion.div>
                                               )}
                                           </motion.div>
                                      )}
                                  </AnimatePresence>
                              )}
                         </div> {/* End Content Area */}
                    </motion.section>

                </main>
            </div> {/* End Main Content Area */}

             {/* --- Subject Management Dialog --- */}
             <AnimatePresence>
                  {showSubjectDialog && (
                       <motion.div
                           key="subject-dialog-backdrop"
                           initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                           className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                           onClick={() => setShowSubjectDialog(false)} // Close on backdrop click
                       >
                           <motion.div
                               key="subject-dialog-content"
                               initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
                               transition={{ type: "spring", stiffness: 300, damping: 25 }}
                               className="bg-white dark:bg-gray-800 p-6 rounded-xl w-full max-w-md shadow-xl relative"
                               onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside dialog
                           >
                               <button
                                   onClick={() => setShowSubjectDialog(false)}
                                   className="absolute top-3 right-3 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                                   aria-label="Close subject manager"
                               > <CloseIcon /> </button>
                               <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-5">Manage Subjects</h3>
                               {/* List of Subjects */}
                                <div className="mb-5 max-h-60 overflow-y-auto border dark:border-gray-600 rounded-md p-3 bg-gray-50 dark:bg-gray-700/50 space-y-1">
                                    {subjects.length > 0 ? (
                                         subjects.map((subject) => (
                                              <div key={subject.id} className="flex items-center justify-between text-gray-700 dark:text-gray-200 p-1.5 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-600/50">
                                                  <div className="flex items-center overflow-hidden">
                                                      <FolderIcon fontSize="small" className="mr-2 text-yellow-600 shrink-0" />
                                                      <span className="flex-grow truncate" title={subject.name}>{subject.name}</span>
                                                  </div>
                                                  {/* TODO: Add delete button for subjects here if needed */}
                                                  {/* <button className="text-red-500 hover:text-red-700 p-0.5 rounded shrink-0 ml-2"><DeleteIcon fontSize="inherit"/></button> */}
                                             </div>
                                         ))
                                    ) : (
                                         <p className="text-gray-500 dark:text-gray-400 text-center text-sm py-4">No subjects created yet.</p>
                                    )}
                               </div>
                               {/* Add New Subject Form */}
                                <form onSubmit={(e) => { e.preventDefault(); addSubjectHandler(); }}> {/* Use form for Enter key submit */}
                                     <div className="flex gap-3">
                                         <input
                                             type="text"
                                             value={newSubject}
                                             onChange={(e) => setNewSubject(e.target.value)}
                                             className="flex-grow px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                             placeholder="Enter new subject name"
                                             aria-label="New subject name"
                                             required // Basic validation
                                         />
                                         <button
                                             type="submit" // Submit form on click
                                             disabled={!newSubject.trim()}
                                             className="px-4 py-2 bg-teal-500 text-white rounded-md hover:bg-teal-600 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1 shrink-0"
                                         >
                                             <AddIcon fontSize="small"/> Add
                                         </button>
                                     </div>
                                </form>
                           </motion.div>
                       </motion.div>
                  )}
             </AnimatePresence>

        </div> // End Flex Container
    );
};

export default Home;