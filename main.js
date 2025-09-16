// Import Firebase core + analytics + auth
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

// Your Firebase configuration (from your console screenshot)
const firebaseConfig = {
    apiKey: "AIzaSyAOI2QuYVStUN0uOIsVN0Os_t2y5AI4rGA",
    authDomain: "project-2d49d0aa-767d-45ed-8d6.firebaseapp.com",
    projectId: "project-2d49d0aa-767d-45ed-8d6",
    storageBucket: "project-2d49d0aa-767d-45ed-8d6.firebasestorage.app",
    messagingSenderId: "451464268916",
    appId: "1:451464268916:web:6f31e793f706e9265e5521",
    measurementId: "G-78DMQHM3F5"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

// Export auth for use in other files
window.auth = auth;
