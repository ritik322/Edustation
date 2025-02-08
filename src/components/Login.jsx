import React from 'react';
import { auth } from '../firebase-config';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

const Login = () => {
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">Study Helper</h1>
        <button
          onClick={signInWithGoogle}
          className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            {/* Google icon path */}
            <path
              fill="currentColor"
              d="M12.545,12.151L12.545,12.151c0,1.054,0.855,1.909,1.909,1.909h3.536c-0.607,1.972-2.405,3.404-4.545,3.404c-2.626,0-4.754-2.128-4.754-4.754s2.128-4.754,4.754-4.754c1.271,0,2.424,0.497,3.276,1.305l1.469-1.469C15.244,6.892,13.827,6.182,12.242,6.182c-3.714,0-6.727,3.013-6.727,6.727s3.013,6.727,6.727,6.727c3.714,0,6.727-3.013,6.727-6.727v-1.909h-6.424V12.151z"
            />
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default Login;