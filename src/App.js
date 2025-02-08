import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './firebase-config';
import Login from './components/Login';
import Home from './components/Home';
import ChatInterface from './components/ChatInterface';
import DocumentViewer from './components/DocumentViewer';

const App = () => {
  const [user, loading] = useAuthState(auth);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/" 
          element={user ? <Navigate to="/home" /> : <Login />} 
        />
        <Route 
          path="/home" 
          element={user ? <Home /> : <Navigate to="/" />} 
        />
        <Route 
          path="/chat" 
          element={user ? <ChatInterface /> : <Navigate to="/" />} 
        />
        <Route 
          path="/document/:id" 
          element={user ? <DocumentViewer /> : <Navigate to="/" />} 
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;