// firebase-config.js// ============================================
// SWASTHYA AI - FIREBASE CONFIGURATION
// Enhanced with Security, Error Handling & Offline Support
// ============================================

// Firebase Configuration - Replace with your actual values
const firebaseConfig = {
    apiKey: "AIzaSyBWAnaXg1iOaL4w7xuOzQRwyCLrQampFBY",
    authDomain: "swasthyaai-5f99f.firebaseapp.com",
    projectId: "swasthyaai-5f99f",
    storageBucket: "swasthyaai-5f99f.firebasestorage.app",
    messagingSenderId: "355431224320",
    appId: "1:355431224320:web:252508c49405984c2f74e5",
    measurementId: "G-XXXXXXXXXX", // Add if you have Analytics enabled
    databaseURL: "https://swasthyaai-5f99f-default-rtdb.firebaseio.com" // Add Realtime Database URL
};

// Check if Firebase is already initialized to prevent errors
if (!firebase.apps.length) {
    try {
        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        console.log('🔥 Firebase initialized successfully for SwasthyaAI');
    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        // Fallback for development
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.warn('⚠️ Running in development mode - using mock data');
        }
    }
} else {
    console.log('🔥 Firebase already initialized');
}

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const database = firebase.database ? firebase.database() : null;
const storage = firebase.storage ? firebase.storage() : null;
const functions = firebase.functions ? firebase.functions() : null;
const analytics = firebase.analytics ? firebase.analytics() : null;

// ============================================
// DATABASE SECURITY RULES VALIDATION
// ============================================

// Firestore security rules structure
const firestoreSecurityRules = {
    doctors: {
        read: "auth != null && auth.token.role == 'doctor'",
        write: "auth != null && auth.token.role == 'doctor' && request.auth.uid == resource.data.doctorId"
    },
    patients: {
        read: "auth != null && (auth.token.role == 'doctor' || auth.token.role == 'patient')",
        write: {
            create: "auth != null && auth.token.role == 'doctor'",
            update: "auth != null && (auth.token.role == 'doctor' || request.auth.uid == resource.data.uid)"
        }
    },
    sessions: {
        read: "auth != null",
        write: "auth != null && request.auth.uid == resource.data.userId"
    }
};

// ============================================
// FIREBASE SERVICE ENHANCEMENTS
// ============================================

// Enable Firestore offline persistence
if (db) {
    db.enablePersistence()
        .then(() => {
            console.log('💾 Firestore offline persistence enabled');
        })
        .catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn('⚠️ Multiple tabs open, persistence can only be enabled in one tab at a time.');
            } else if (err.code === 'unimplemented') {
                console.warn('⚠️ The current browser doesn\'t support offline persistence');
            }
        });
}

// ============================================
// AUTHENTICATION MANAGER
// ============================================

class FirebaseAuthManager {
    constructor() {
        this.currentUser = null;
        this.authStateCallbacks = [];
        this.init();
    }

    init() {
        // Monitor auth state changes
        auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            this.notifyAuthStateChange(user);
            
            if (user) {
                console.log('👤 User authenticated:', user.email);
                this.updateUserClaims();
            } else {
                console.log('👤 No user authenticated');
            }
        });

        // Handle auth errors
        auth.onAuthStateChanged(() => {}, (error) => {
            console.error('Auth state change error:', error);
            this.handleAuthError(error);
        });
    }

    async registerUser(userData) {
        try {
            // Validate user data
            if (!this.validateUserData(userData)) {
                throw new Error('Invalid user data provided');
            }

            // Create user with email/password
            const userCredential = await auth.createUserWithEmailAndPassword(
                userData.email,
                userData.password
            );

            // Update user profile
            await userCredential.user.updateProfile({
                displayName: userData.name
            });

            // Create user document in Firestore
            await this.createUserDocument(userCredential.user, userData);

            // Send email verification
            await userCredential.user.sendEmailVerification();

            return {
                success: true,
                user: userCredential.user,
                message: 'Registration successful! Please check your email for verification.'
            };

        } catch (error) {
            return this.handleAuthError(error);
        }
    }

    async loginUser(email, password, rememberMe = false) {
        try {
            // Set persistence based on remember me
            const persistence = rememberMe ? 
                firebase.auth.Auth.Persistence.LOCAL : 
                firebase.auth.Auth.Persistence.SESSION;
            
            await auth.setPersistence(persistence);

            // Sign in user
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            
            // Check if email is verified
            if (!userCredential.user.emailVerified) {
                await this.sendVerificationEmail(userCredential.user);
                return {
                    success: false,
                    message: 'Please verify your email address. A new verification email has been sent.'
                };
            }

            // Update last login timestamp
            await this.updateLastLogin(userCredential.user.uid);

            return {
                success: true,
                user: userCredential.user
            };

        } catch (error) {
            return this.handleAuthError(error);
        }
    }

    async logoutUser() {
        try {
            // Clear local storage
            localStorage.removeItem('swasthyaai_user');
            localStorage.removeItem('swasthyaai_language');
            sessionStorage.clear();

            // Sign out from Firebase
            await auth.signOut();

            return {
                success: true,
                message: 'Logged out successfully'
            };

        } catch (error) {
            return this.handleAuthError(error);
        }
    }

    async resetPassword(email) {
        try {
            await auth.sendPasswordResetEmail(email);
            return {
                success: true,
                message: 'Password reset email sent successfully'
            };
        } catch (error) {
            return this.handleAuthError(error);
        }
    }

    async updateUserProfile(updates) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('No authenticated user');

            // Update profile fields
            if (updates.displayName) {
                await user.updateProfile({ displayName: updates.displayName });
            }
            if (updates.photoURL) {
                await user.updateProfile({ photoURL: updates.photoURL });
            }
            if (updates.email) {
                await user.updateEmail(updates.email);
            }

            // Update Firestore document
            await db.collection('users').doc(user.uid).update({
                ...updates,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return { success: true, message: 'Profile updated successfully' };

        } catch (error) {
            return this.handleAuthError(error);
        }
    }

    // Helper Methods
    validateUserData(userData) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;

        if (!emailRegex.test(userData.email)) {
            throw new Error('Invalid email address');
        }
        if (!passwordRegex.test(userData.password)) {
            throw new Error('Password must be at least 8 characters with letters and numbers');
        }
        if (userData.password !== userData.confirmPassword) {
            throw new Error('Passwords do not match');
        }
        return true;
    }

    async createUserDocument(user, userData) {
        const userDoc = {
            uid: user.uid,
            email: user.email,
            displayName: userData.name,
            role: userData.role || 'patient',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            emailVerified: user.emailVerified,
            lastLogin: null,
            preferences: {
                language: 'en',
                notifications: true,
                theme: 'light'
            }
        };

        // Add role-specific fields
        if (userData.role === 'patient') {
            userDoc.patientInfo = {
                age: userData.age,
                condition: userData.condition,
                doctorId: userData.doctorId,
                recoveryStage: 'initial'
            };
        } else if (userData.role === 'doctor') {
            userDoc.doctorInfo = {
                licenseNumber: userData.licenseNumber,
                specialty: userData.specialty,
                hospital: userData.hospital,
                patientCount: 0
            };
        }

        await db.collection('users').doc(user.uid).set(userDoc);
    }

    async updateLastLogin(uid) {
        try {
            await db.collection('users').doc(uid).update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating last login:', error);
        }
    }

    async updateUserClaims() {
        // Implement custom claims if needed for role-based access
        // This requires Cloud Functions
    }

    async sendVerificationEmail(user) {
        try {
            await user.sendEmailVerification({
                url: window.location.origin + '/verify-email'
            });
        } catch (error) {
            console.error('Error sending verification email:', error);
        }
    }

    handleAuthError(error) {
        let message = 'An error occurred during authentication';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                message = 'This email is already registered. Please use a different email or login.';
                break;
            case 'auth/invalid-email':
                message = 'Please enter a valid email address.';
                break;
            case 'auth/operation-not-allowed':
                message = 'Email/password accounts are not enabled. Please contact support.';
                break;
            case 'auth/weak-password':
                message = 'Password is too weak. Please use at least 8 characters with letters and numbers.';
                break;
            case 'auth/user-disabled':
                message = 'This account has been disabled. Please contact support.';
                break;
            case 'auth/user-not-found':
                message = 'No account found with this email address.';
                break;
            case 'auth/wrong-password':
                message = 'Incorrect password. Please try again.';
                break;
            case 'auth/too-many-requests':
                message = 'Too many unsuccessful attempts. Please try again later or reset your password.';
                break;
            case 'auth/network-request-failed':
                message = 'Network error. Please check your internet connection.';
                break;
            default:
                message = error.message || 'Authentication failed';
        }

        console.error('Auth Error:', error.code, error.message);

        return {
            success: false,
            message: message,
            code: error.code
        };
    }

    notifyAuthStateChange(user) {
        this.authStateCallbacks.forEach(callback => {
            try {
                callback(user);
            } catch (error) {
                console.error('Error in auth state callback:', error);
            }
        });
    }

    onAuthStateChanged(callback) {
        this.authStateCallbacks.push(callback);
        // Immediately call with current user if exists
        if (this.currentUser) {
            callback(this.currentUser);
        }
    }
}

// ============================================
// FIRESTORE DATA MANAGER
// ============================================

class FirestoreManager {
    constructor() {
        this.batchSize = 500; // Firestore batch limit
        this.cache = new Map();
        this.init();
    }

    init() {
        // Configure Firestore settings
        const settings = {
            cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
        };
        
        if (db) {
            db.settings(settings);
        }
    }

    // Patient Management
    async addPatient(doctorId, patientData) {
        try {
            const patientRef = db.collection('patients').doc();
            const sessionRef = db.collection('sessions').doc();
            
            const patientId = patientRef.id;
            const sessionId = sessionRef.id;
            const timestamp = firebase.firestore.FieldValue.serverTimestamp();

            // Create patient document
            await patientRef.set({
                ...patientData,
                id: patientId,
                doctorId: doctorId,
                createdAt: timestamp,
                updatedAt: timestamp,
                status: 'active',
                totalSessions: 0,
                avgFormScore: 0,
                complianceRate: 0,
                lastSession: null
            });

            // Create initial session
            await sessionRef.set({
                id: sessionId,
                patientId: patientId,
                doctorId: doctorId,
                type: 'initial_assessment',
                date: timestamp,
                notes: 'Initial patient assessment',
                formScore: 0,
                duration: 0,
                reps: 0,
                aiFeedback: []
            });

            // Update doctor's patient count
            await this.incrementDoctorPatientCount(doctorId);

            return {
                success: true,
                patientId: patientId,
                message: 'Patient added successfully'
            };

        } catch (error) {
            return this.handleFirestoreError(error);
        }
    }

    async getPatientSessions(patientId, limit = 20) {
        try {
            const snapshot = await db.collection('sessions')
                .where('patientId', '==', patientId)
                .orderBy('date', 'desc')
                .limit(limit)
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

        } catch (error) {
            return this.handleFirestoreError(error);
        }
    }

    async saveExerciseSession(sessionData) {
        try {
            const sessionRef = db.collection('sessions').doc();
            const patientRef = db.collection('patients').doc(sessionData.patientId);
            const timestamp = firebase.firestore.FieldValue.serverTimestamp();

            // Prepare session document
            const sessionDoc = {
                ...sessionData,
                id: sessionRef.id,
                timestamp: timestamp,
                date: new Date().toISOString().split('T')[0]
            };

            // Save session in a batch
            const batch = db.batch();
            batch.set(sessionRef, sessionDoc);

            // Update patient statistics
            const patientUpdate = {
                lastSession: timestamp,
                totalSessions: firebase.firestore.FieldValue.increment(1),
                updatedAt: timestamp
            };

            // Calculate new averages
            if (sessionData.formScore) {
                const patientDoc = await patientRef.get();
                const currentData = patientDoc.data();
                
                if (currentData) {
                    const currentAvg = currentData.avgFormScore || 0;
                    const currentCount = currentData.totalSessions || 0;
                    const newAvg = ((currentAvg * currentCount) + sessionData.formScore) / (currentCount + 1);
                    
                    patientUpdate.avgFormScore = Math.round(newAvg * 10) / 10;
                }
            }

            batch.update(patientRef, patientUpdate);
            await batch.commit();

            // Cache the session
            this.cache.set(`session_${sessionRef.id}`, sessionDoc);

            return {
                success: true,
                sessionId: sessionRef.id,
                message: 'Session saved successfully'
            };

        } catch (error) {
            return this.handleFirestoreError(error);
        }
    }

    async getRealTimePatientUpdates(patientId, callback) {
        try {
            return db.collection('patients').doc(patientId)
                .onSnapshot((doc) => {
                    if (doc.exists) {
                        const data = { id: doc.id, ...doc.data() };
                        callback(data);
                    }
                }, (error) => {
                    console.error('Real-time update error:', error);
                });

        } catch (error) {
            return this.handleFirestoreError(error);
        }
    }

    // Analytics & Reports
    async getPatientProgressReport(patientId, startDate, endDate) {
        try {
            const sessionsSnapshot = await db.collection('sessions')
                .where('patientId', '==', patientId)
                .where('date', '>=', startDate)
                .where('date', '<=', endDate)
                .orderBy('date')
                .get();

            const sessions = sessionsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Calculate statistics
            const stats = this.calculateSessionStatistics(sessions);

            return {
                success: true,
                sessions: sessions,
                statistics: stats,
                period: { startDate, endDate }
            };

        } catch (error) {
            return this.handleFirestoreError(error);
        }
    }

    calculateSessionStatistics(sessions) {
        if (sessions.length === 0) {
            return {
                totalSessions: 0,
                avgFormScore: 0,
                totalReps: 0,
                totalDuration: 0,
                improvementRate: 0
            };
        }

        const totalSessions = sessions.length;
        const totalReps = sessions.reduce((sum, session) => sum + (session.reps || 0), 0);
        const totalDuration = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
        const avgFormScore = sessions.reduce((sum, session) => sum + (session.formScore || 0), 0) / totalSessions;

        // Calculate improvement rate
        const firstScores = sessions.slice(0, Math.min(3, sessions.length)).map(s => s.formScore || 0);
        const lastScores = sessions.slice(-3).map(s => s.formScore || 0);
        const avgFirst = firstScores.reduce((a, b) => a + b, 0) / firstScores.length;
        const avgLast = lastScores.reduce((a, b) => a + b, 0) / lastScores.length;
        const improvementRate = avgFirst > 0 ? ((avgLast - avgFirst) / avgFirst) * 100 : 0;

        return {
            totalSessions,
            avgFormScore: Math.round(avgFormScore * 10) / 10,
            totalReps,
            totalDuration,
            improvementRate: Math.round(improvementRate * 10) / 10,
            bestSession: Math.max(...sessions.map(s => s.formScore || 0)),
            worstSession: Math.min(...sessions.map(s => s.formScore || 0))
        };
    }

    // Helper Methods
    async incrementDoctorPatientCount(doctorId) {
        try {
            await db.collection('doctors').doc(doctorId).update({
                patientCount: firebase.firestore.FieldValue.increment(1),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating doctor patient count:', error);
        }
    }

    handleFirestoreError(error) {
        let message = 'Database error occurred';
        
        switch (error.code) {
            case 'permission-denied':
                message = 'You do not have permission to perform this action.';
                break;
            case 'not-found':
                message = 'The requested document was not found.';
                break;
            case 'already-exists':
                message = 'A document with this ID already exists.';
                break;
            case 'resource-exhausted':
                message = 'Database quota exceeded. Please try again later.';
                break;
            case 'failed-precondition':
                message = 'The database is not in a state to execute the operation.';
                break;
            case 'unavailable':
                message = 'Database service is unavailable. Please check your connection.';
                break;
            default:
                message = error.message || 'Database operation failed';
        }

        console.error('Firestore Error:', error.code, error.message);

        return {
            success: false,
            message: message,
            code: error.code
        };
    }

    // Cache Management
    getFromCache(key) {
        return this.cache.get(key);
    }

    setToCache(key, value, ttl = 300000) { // 5 minutes default TTL
        this.cache.set(key, {
            data: value,
            expiry: Date.now() + ttl
        });
    }

    clearCache() {
        this.cache.clear();
    }

    // Batch Operations
    async batchDelete(collectionName, ids) {
        try {
            const batch = db.batch();
            
            ids.forEach(id => {
                const docRef = db.collection(collectionName).doc(id);
                batch.delete(docRef);
            });

            await batch.commit();
            return { success: true, message: `Deleted ${ids.length} documents` };

        } catch (error) {
            return this.handleFirestoreError(error);
        }
    }
}

// ============================================
// REALTIME DATABASE MANAGER (FOR LIVE SESSIONS)
// ============================================

class RealtimeDatabaseManager {
    constructor() {
        if (!database) {
            console.warn('⚠️ Realtime Database not configured');
            return;
        }
        this.activeSessions = new Map();
    }

    async startLiveSession(sessionData) {
        try {
            const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const sessionRef = database.ref(`live_sessions/${sessionId}`);

            await sessionRef.set({
                ...sessionData,
                startTime: firebase.database.ServerValue.TIMESTAMP,
                status: 'active',
                participants: {
                    [sessionData.userId]: {
                        joinedAt: firebase.database.ServerValue.TIMESTAMP,
                        role: sessionData.userRole
                    }
                }
            });

            // Store session reference
            this.activeSessions.set(sessionId, sessionRef);

            return {
                success: true,
                sessionId: sessionId,
                sessionRef: sessionRef
            };

        } catch (error) {
            console.error('Error starting live session:', error);
            return { success: false, message: error.message };
        }
    }

    async updateLiveSession(sessionId, updates) {
        try {
            const sessionRef = database.ref(`live_sessions/${sessionId}`);
            await sessionRef.update({
                ...updates,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });

            return { success: true };

        } catch (error) {
            console.error('Error updating live session:', error);
            return { success: false, message: error.message };
        }
    }

    async endLiveSession(sessionId, summary) {
        try {
            const sessionRef = database.ref(`live_sessions/${sessionId}`);
            
            await sessionRef.update({
                status: 'completed',
                endTime: firebase.database.ServerValue.TIMESTAMP,
                summary: summary
            });

            // Remove from active sessions after delay
            setTimeout(() => {
                this.activeSessions.delete(sessionId);
            }, 5000);

            return { success: true };

        } catch (error) {
            console.error('Error ending live session:', error);
            return { success: false, message: error.message };
        }
    }

    subscribeToSession(sessionId, callback) {
        try {
            const sessionRef = database.ref(`live_sessions/${sessionId}`);
            
            const onValueChange = sessionRef.on('value', (snapshot) => {
                if (snapshot.exists()) {
                    callback(snapshot.val());
                }
            });

            return {
                unsubscribe: () => sessionRef.off('value', onValueChange)
            };

        } catch (error) {
            console.error('Error subscribing to session:', error);
            return { success: false, message: error.message };
        }
    }
}

// ============================================
// STORAGE MANAGER (FOR EXERCISE VIDEOS & DATA)
// ============================================

class StorageManager {
    constructor() {
        if (!storage) {
            console.warn('⚠️ Cloud Storage not configured');
            return;
        }
    }

    async uploadSessionVideo(userId, sessionId, videoBlob) {
        try {
            const timestamp = Date.now();
            const fileName = `session_${sessionId}_${timestamp}.webm`;
            const storageRef = storage.ref(`users/${userId}/sessions/${fileName}`);
            
            // Upload video
            const uploadTask = storageRef.put(videoBlob);
            
            return new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        // Progress monitoring
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        console.log(`Upload progress: ${progress}%`);
                    },
                    (error) => {
                        reject({ success: false, message: error.message });
                    },
                    async () => {
                        // Upload complete
                        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                        resolve({
                            success: true,
                            url: downloadURL,
                            fileName: fileName,
                            size: videoBlob.size
                        });
                    }
                );
            });

        } catch (error) {
            console.error('Error uploading video:', error);
            return { success: false, message: error.message };
        }
    }

    async uploadUserAvatar(userId, imageFile) {
        try {
            // Validate file
            if (!imageFile.type.startsWith('image/')) {
                throw new Error('File must be an image');
            }
            if (imageFile.size > 5 * 1024 * 1024) { // 5MB limit
                throw new Error('Image size must be less than 5MB');
            }

            const fileName = `avatar_${userId}_${Date.now()}.${imageFile.name.split('.').pop()}`;
            const storageRef = storage.ref(`users/${userId}/avatars/${fileName}`);
            
            const uploadTask = storageRef.put(imageFile);
            
            return new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    null,
                    (error) => reject({ success: false, message: error.message }),
                    async () => {
                        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                        resolve({
                            success: true,
                            url: downloadURL,
                            fileName: fileName
                        });
                    }
                );
            });

        } catch (error) {
            console.error('Error uploading avatar:', error);
            return { success: false, message: error.message };
        }
    }
}

// ============================================
// EXPORT MANAGERS
// ============================================

// Initialize managers
const authManager = new FirebaseAuthManager();
const firestoreManager = new FirestoreManager();
const realtimeManager = new RealtimeDatabaseManager();
const storageManager = new StorageManager();

// Export for use in other files
window.firebaseServices = {
    auth: auth,
    db: db,
    database: database,
    storage: storage,
    authManager: authManager,
    firestoreManager: firestoreManager,
    realtimeManager: realtimeManager,
    storageManager: storageManager
};

// Global error handler for Firebase
window.addEventListener('error', (event) => {
    if (event.error && event.error.message && event.error.message.includes('firebase')) {
        console.error('Global Firebase Error:', event.error);
        // You can add error reporting to your service here
    }
});

// Offline/Online detection
window.addEventListener('online', () => {
    console.log('🌐 App is online');
    // Trigger any pending sync operations
});

window.addEventListener('offline', () => {
    console.log('🌐 App is offline');
    // Show offline notification to user
});

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        firebaseConfig,
        authManager,
        firestoreManager,
        realtimeManager,
        storageManager
    };
}

console.log('🚀 SwasthyaAI Firebase services initialized successfully!');
console.log("Firebase initialized!");
