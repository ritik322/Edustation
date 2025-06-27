import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase-config"; // Assuming firebase-config is in the parent directory
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'; // For password visibility toggle

const AuthPage = () => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isMounted, setIsMounted] = useState(false); // For entry animation
  const navigate = useNavigate();

  // Add effect for entry animation
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Clear fields and errors when switching views
  const toggleView = () => {
    setIsLoginView(!isLoginView);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Redirect based on role - assuming '/' is student home now
        navigate(userData.role === "admin" ? "/TeacherDashboard" : "/");
      } else {
        // This case might mean the user record wasn't created properly during registration
        await auth.signOut(); // Log out the user
        setError("User data not found. Please contact support or try registering again.");
      }
    } catch (err) {
      console.error("Login Error:", err);
      let friendlyMessage = "Login failed. Please check your email and password.";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        friendlyMessage = "Invalid email or password.";
      } else if (err.code === 'auth/invalid-email') {
         friendlyMessage = "Please enter a valid email address.";
      }
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError("");
    // --- Client-side Validation ---
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    // Basic email format check (optional, as Firebase handles it too)
    if (!/\S+@\S+\.\S+/.test(email)) {
       setError("Please enter a valid email address.");
       return;
    }
    // --- End Validation ---

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Store user role as "student" in Firestore
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        role: "student", // Default role for registration
        createdAt: new Date(), // Optional: track creation date
      });

      console.log("Student registered successfully!");
      // Navigate to home page after successful registration
      navigate("/");

    } catch (err) {
      console.error("Registration Error:", err);
      let friendlyMessage = "Registration failed. Please try again.";
       if (err.code === 'auth/weak-password') {
           friendlyMessage = "Password is too weak. Please use at least 6 characters.";
       } else if (err.code === 'auth/email-already-in-use') {
           friendlyMessage = "This email address is already registered. Try logging in.";
       } else if (err.code === 'auth/invalid-email') {
            friendlyMessage = "Please enter a valid email address.";
       }
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault(); // Prevent default form submission
    if (loading) return; // Prevent multiple submissions

    if (isLoginView) {
      handleLogin();
    } else {
      handleRegister();
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
      {/* Form Container with Entry Animation */}
      <div
        className={`
          w-full max-w-md bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg
          rounded-xl shadow-2xl p-8 transition-all duration-700 ease-out
          ${isMounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95'}
        `}
      >
        {/* Form Title */}
        <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-white mb-6">
          {isLoginView ? "Welcome Back!" : "Create Account"}
        </h2>

        {/* Error Message Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 text-sm" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition duration-150 ease-in-out"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {/* Password Input */}
          <div className="relative">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition duration-150 ease-in-out"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isLoginView ? undefined : 6} // Enforce minLength for registration visually
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 top-6 pr-3 flex items-center text-sm leading-5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                 <EyeSlashIcon className="h-5 w-5" />
              ) : (
                 <EyeIcon className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Confirm Password Input (Only for Register View) */}
          {!isLoginView && (
            <div className="relative">
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition duration-150 ease-in-out"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
               <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 top-6 pr-3 flex items-center text-sm leading-5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? (
                   <EyeSlashIcon className="h-5 w-5" />
                ) : (
                   <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className={`w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-base font-medium text-white transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
              ${loading
                ? "bg-indigo-400 dark:bg-indigo-700 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              }`}
            disabled={loading}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              isLoginView ? "Log In" : "Register"
            )}
          </button>
        </form>

        {/* Toggle View Link */}
        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          {isLoginView ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={toggleView}
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none focus:underline transition ease-in-out duration-150"
            disabled={loading}
          >
            {isLoginView ? "Register here" : "Log in here"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;