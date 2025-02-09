import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase-config";
import Login from "./components/Login";
import Home from "./components/Home";
import ChatInterface from "./components/ChatInterface";
import DocumentViewer from "./components/DocumentViewer";
import Register from "./components/Register";
import AdminDashboard from "./components/AdminDashboard";
import TeacherDashboard from "./components/TeacherDashboard";
import TeacherDashboard2 from "./components/TeacherDashboard2";
import Dashboard from "./components/Dashboard";
import Dashboard2 from "./components/Dashboard2";

const App = () => {
  const [user, loading] = useAuthState(auth);
  const [role, setRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(true);

  // Fetch user role from Firestore
  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          setRole(userDoc.data().role); // Assuming role is stored in Firestore
        } else {
          setRole(null);
        }
      }
      setRoleLoading(false);
    };

    fetchUserRole();
  }, [user]);

  if (loading || roleLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />

        {/* Admin Routes */}
        <Route path="/TeacherDashboard2" element={<TeacherDashboard currentUser={user}/> } />
        <Route path="/TeacherDashboard" element={<TeacherDashboard2/> } />
        <Route path="/Dashboard2" element= {user?<Dashboard userId={user.uid}/>: <Navigate to="/login"/>}/>
        <Route path="/Dashboard" element= {user?<Dashboard2/>: <Navigate to="/login"/>}/>


        {/* Student Routes */}
        <Route path="/" element={user ? <Home /> : <Navigate to="/login" />} />
        <Route path="/chat" element={user  ? <ChatInterface /> : <Navigate to="/" />} />
        <Route path="/document/:id" element={user  ? <DocumentViewer /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
