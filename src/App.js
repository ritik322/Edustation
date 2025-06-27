// src/App.js
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";

// --- ADD THESE FIREBASE IMPORTS ---
import { doc, getDoc } from "firebase/firestore"; // Firestore functions
import { auth, db } from "./firebase-config"; // Your Firebase config file
// --- END OF ADDED IMPORTS ---

// Keep other imports: components...
import Login from "./components/Login";
import Home from "./components/Home";
import DocumentViewer from "./components/DocumentViewer";
import Register from "./components/Register";

import AuthPage from "./components/AuthPage";
import FloatingChatWidget from "./components/FloatingChatWidget";

// ... rest of your App.js code ...

const App = () => {
    const [user, loading] = useAuthState(auth); // Now 'auth' is defined
    const [role, setRole] = useState(null);
    const [roleLoading, setRoleLoading] = useState(true);

    // Fetch user role from Firestore
    useEffect(() => {
        const fetchUserRole = async () => {
            setRoleLoading(true);
            if (user) {
                try {
                    const userRef = doc(db, "users", user.uid); // Now 'doc' and 'db' are defined
                    const userDoc = await getDoc(userRef); // Now 'getDoc' is defined
                    if (userDoc.exists()) {
                        setRole(userDoc.data().role);
                    } else {
                        console.log("User document not found, role set to null.");
                        setRole(null);
                    }
                } catch (error) {
                    console.error("Error fetching user role:", error);
                    setRole(null);
                }
            } else {
                setRole(null);
            }
            setRoleLoading(false);
        };

        if (!loading) {
            fetchUserRole();
        } else {
            setRoleLoading(true);
        }
    }, [user, loading]);


    if (loading || roleLoading) {
        // ... loading spinner ...
         return (
            <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-blue-100 dark:from-gray-900 dark:to-blue-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                <p className="ml-3 text-gray-700 dark:text-gray-300">Loading...</p>
            </div>
        );
    }

    // ... ProtectedRoute helper and rest of the component ...
     const ProtectedRoute = ({ children, allowedRoles }) => {
        if (!user) {
            return <Navigate to="/auth" />;
        }
        if (allowedRoles && !allowedRoles.includes(role)) {
            console.warn(`User role '${role}' not authorized for this route. Allowed: ${allowedRoles.join(', ')}`);
            return <Navigate to="/" />;
        }
        return children;
    };


    return (
        <BrowserRouter>
             <div className="relative min-h-screen">
                <Routes>
                     {/* Public Routes */}
                    <Route path="/login" element={!user ? <Navigate to="/auth" replace/> : <Navigate to="/" replace/>} />
                    <Route path="/register" element={!user ? <Navigate to="/auth" replace/> : <Navigate to="/" replace/>} />
                    <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/" replace/>} />

                    {/* Common Authenticated Routes */}
                    <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                    <Route path="/document/:id" element={<ProtectedRoute><DocumentViewer /></ProtectedRoute>} />

                    {/* Role-Specific Routes */}

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                 {user && <FloatingChatWidget user={user} />}
            </div>
        </BrowserRouter>
    );
};

export default App;