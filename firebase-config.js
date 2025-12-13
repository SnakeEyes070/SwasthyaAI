// firebase-config.js
const firebaseConfig = {
    apiKey: "AIzaSyBWAnaXg1iOaL4w7xuOzQRwyCLrQampFBY",
    authDomain: "swasthyaai-5f99f.firebaseapp.com",
    projectId: "swasthyaai-5f99f",
    storageBucket: "swasthyaai-5f99f.firebasestorage.app",
    messagingSenderId: "355431224320",
    appId: "1:355431224320:web:252508c49405984c2f74e5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

console.log("Firebase initialized!");