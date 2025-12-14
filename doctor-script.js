// doctor-script.js - Enhanced with AI Pose Estimation
let userData = null;
let patients = [];

// AI Monitoring Variables
let poseLandmarker = null;
let webcamRunning = false;
let currentLanguage = 'en';
let speechSynthesis = null;
let lastFeedbackTime = 0;
let feedbackCooldown = 2000; // 2 seconds between voice feedback

// Exercise Configuration
const exerciseConfig = {
    squat: {
        keyAngles: ['left_knee', 'right_knee', 'hip'],
        thresholds: {
            knee: { min: 80, max: 120, ideal: 90 },
            hip: { min: 140, max: 180, ideal: 160 }
        }
    },
    arm_raise: {
        keyAngles: ['left_shoulder', 'right_shoulder', 'elbow'],
        thresholds: {
            shoulder: { min: 30, max: 180, ideal: 90 },
            elbow: { min: 160, max: 180, ideal: 175 }
        }
    }
};

// Multilingual Feedback Messages
const feedbackMessages = {
    en: {
        knee_alignment: "Keep your knees aligned with your toes",
        knee_too_bent: "Don't bend your knees too much",
        back_straight: "Keep your back straight",
        good_form: "Excellent form! Keep going",
        arm_position: "Raise your arms parallel to the floor"
    },
    hi: {
        knee_alignment: "अपने घुटनों को पैर की उंगलियों के साथ संरेखित रखें",
        knee_too_bent: "अपने घुटनों को बहुत अधिक न मोड़ें",
        back_straight: "अपनी पीठ सीधी रखें",
        good_form: "उत्कृष्ट फॉर्म! जारी रखें",
        arm_position: "अपनी बाहों को फर्श के समानांतर उठाएं"
    },
    mr: {
        knee_alignment: "तुमच्या गुडघ्या पायाच्या बोटांशी संरेखित ठेवा",
        knee_too_bent: "गुडघे जास्त वाकू नका",
        back_straight: "पाठीण सरळ ठेवा",
        good_form: "उत्कृष्ट फॉर्म! सुरू ठेवा",
        arm_position: "तुमच्या हातांना जमिनीच्या समांतर उचलता"
    },
    ta: {
        knee_alignment: "உங்கள் முழங்கால்களை கால் விரல்களுடன் சீரமைக்கவும்",
        knee_too_bent: "உங்கள் முழங்கால்களை அதிகமாக வளைக்க வேண்டாம்",
        back_straight: "உங்கள் முதுகை நேராக வைத்திருங்கள்",
        good_form: "சிறந்த வடிவம்! தொடருங்கள்",
        arm_position: "உங்கள் கைகளை தரையிற்கு இணையாக உயர்த்துங்கள்"
    },
    te: {
        knee_alignment: "మీ మోకాళ్లను కాలి వేళ్లతో సమలేఖనం చేయండి",
        knee_too_bent: "మీ మోకాళ్లను ఎక్కువగా వంచవద్దు",
        back_straight: "మీ వెన్నును నిటారుగా ఉంచండి",
        good_form: "అద్భుతమైన ఫారం! కొనసాగించండి",
        arm_position: "మీ చేతులను నేలకు సమాంతరంగా ఎత్తండి"
    }
};

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    const user = JSON.parse(localStorage.getItem('rehabai_user'));
    
    if (!user || user.role !== 'doctor') {
        window.location.href = 'index.html';
        return;
    }
    
    userData = user;
    
    // Initialize UI
    initializeUI();
    
    // Load doctor data
    await loadDoctorData();
    
    // Load patients
    await loadPatients();
    
    // Initialize AI Components
    await initializeAISystem();
    
    // Setup event listeners
    setupEventListeners();
    
    // Update date
    updateCurrentDate();
});

function initializeUI() {
    // Set doctor info
    document.getElementById('doctorName').textContent = userData.name;
    document.getElementById('doctorEmail').textContent = userData.email;
    
    if (userData.specialty) {
        document.getElementById('doctorSpecialty').textContent = 
            userData.specialty.replace('_', ' ').toUpperCase();
    }
}

async function initializeAISystem() {
    try {
        // Initialize speech synthesis
        if ('speechSynthesis' in window) {
            speechSynthesis = window.speechSynthesis;
            
            // Load available voices
            speechSynthesis.onvoiceschanged = function() {
                console.log('Speech synthesis voices loaded:', speechSynthesis.getVoices().length);
            };
        } else {
            console.warn('Speech synthesis not supported in this browser');
        }
        
        // Create MediaPipe elements dynamically
        createVideoMonitoringElements();
        
        // Add language selector to UI
        addLanguageSelector();
        
        console.log('AI System initialized successfully');
        
    } catch (error) {
        console.error('Error initializing AI system:', error);
        showNotification('AI system initialization failed', 'error');
    }
}

function createVideoMonitoringElements() {
    // Create video monitoring section if it doesn't exist
    const mainContent = document.querySelector('.main-content');
    if (!document.getElementById('aiMonitoringSection')) {
        const monitoringSection = document.createElement('div');
        monitoringSection.id = 'aiMonitoringSection';
        monitoringSection.className = 'monitoring-section';
        monitoringSection.innerHTML = `
            <div class="section-header">
                <h3><i class="fas fa-video"></i> AI Exercise Monitoring</h3>
                <div class="section-actions">
                    <select id="exerciseType">
                        <option value="squat">Squat</option>
                        <option value="arm_raise">Arm Raise</option>
                        <option value="lunge">Lunge</option>
                        <option value="shoulder_press">Shoulder Press</option>
                    </select>
                    <select id="languageSelect">
                        <option value="en">English</option>
                        <option value="hi">हिन्दी</option>
                        <option value="mr">मराठी</option>
                        <option value="ta">தமிழ்</option>
                        <option value="te">తెలుగు</option>
                    </select>
                    <button class="btn btn-primary" id="startMonitoringBtn">
                        <i class="fas fa-play"></i> Start AI Monitoring
                    </button>
                    <button class="btn btn-danger" id="stopMonitoringBtn" style="display: none;">
                        <i class="fas fa-stop"></i> Stop Monitoring
                    </button>
                </div>
            </div>
            <div class="monitoring-container">
                <div class="video-container">
                    <video id="webcamVideo" autoplay playsinline></video>
                    <canvas id="poseCanvas"></canvas>
                </div>
                <div class="angle-display">
                    <h4><i class="fas fa-angle-double-right"></i> Live Joint Angles</h4>
                    <div class="angle-grid" id="angleGrid">
                        <!-- Angles will be displayed here -->
                    </div>
                </div>
                <div class="feedback-panel">
                    <h4><i class="fas fa-bullhorn"></i> AI Voice Feedback</h4>
                    <div class="feedback-log" id="feedbackLog">
                        <p>AI System Ready. Select an exercise and click "Start Monitoring"</p>
                    </div>
                    <button class="btn btn-sm" id="testVoiceBtn">
                        <i class="fas fa-volume-up"></i> Test Voice
                    </button>
                </div>
            </div>
        `;
        
        // Insert after patient list
        const patientList = document.querySelector('.patient-list');
        if (patientList) {
            patientList.after(monitoringSection);
        } else {
            mainContent.appendChild(monitoringSection);
        }
    }
}

function addLanguageSelector() {
    // Language selector is already added in createVideoMonitoringElements
}

async function loadDoctorData() {
    try {
        // Mock data for demonstration
        document.getElementById('activePatients').textContent = '8';
        document.getElementById('todaySessions').textContent = '24';
        document.getElementById('complianceRate').textContent = '82%';
        document.getElementById('complianceBar').style.width = '82%';
        document.getElementById('avgImprovement').textContent = '15%';
        
    } catch (error) {
        console.error('Error loading doctor data:', error);
        showNotification('Error loading data. Please refresh.', 'error');
    }
}

async function loadPatients() {
    try {
        // Mock patient data
        patients = [
            {
                id: '1',
                name: 'John Smith',
                email: 'john@example.com',
                condition: 'Knee Replacement',
                age: 58,
                lastSession: '2024-01-15',
                compliance: 85,
                formScore: 76,
                status: 'active',
                aiEnabled: true
            },
            {
                id: '2',
                name: 'Sarah Johnson',
                email: 'sarah@example.com',
                condition: 'Back Pain',
                age: 42,
                lastSession: '2024-01-14',
                compliance: 92,
                formScore: 88,
                status: 'active',
                aiEnabled: true
            }
        ];
        
        renderPatients(patients);
        
    } catch (error) {
        console.error('Error loading patients:', error);
        showNotification('Error loading patients. Please refresh.', 'error');
    }
}

function renderPatients(patientsList) {
    // ... (keep your existing renderPatients function) ...
    // Add AI monitoring button to each patient card
}

function setupEventListeners() {
    // ... (keep your existing event listeners) ...
    
    // AI Monitoring Event Listeners
    document.getElementById('startMonitoringBtn')?.addEventListener('click', startAIMonitoring);
    document.getElementById('stopMonitoringBtn')?.addEventListener('click', stopAIMonitoring);
    document.getElementById('languageSelect')?.addEventListener('change', function(e) {
        currentLanguage = e.target.value;
    });
    document.getElementById('testVoiceBtn')?.addEventListener('click', testVoiceFeedback);
}

// AI MONITORING FUNCTIONS

async function startAIMonitoring() {
    try {
        showNotification('Starting AI monitoring...', 'info');
        
        // Get selected exercise
        const exerciseType = document.getElementById('exerciseType').value;
        
        // Initialize MediaPipe
        await initializeMediaPipe();
        
        // Start webcam
        await startWebcam();
        
        // Start pose detection
        detectPose();
        
        // Update UI
        document.getElementById('startMonitoringBtn').style.display = 'none';
        document.getElementById('stopMonitoringBtn').style.display = 'inline-flex';
        
        // Add initial feedback
        addFeedbackMessage('AI Monitoring Started. Camera is active.');
        speakFeedback('system_started');
        
    } catch (error) {
        console.error('Error starting AI monitoring:', error);
        showNotification('Failed to start AI monitoring: ' + error.message, 'error');
    }
}

async function initializeMediaPipe() {
    try {
        // Dynamically load MediaPipe
        if (typeof PoseLandmarker === 'undefined') {
            await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0');
        }
        
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        console.log('MediaPipe Pose Landmarker initialized');
        
    } catch (error) {
        console.error('Error initializing MediaPipe:', error);
        throw new Error('Failed to initialize pose detection');
    }
}

async function startWebcam() {
    try {
        const video = document.getElementById('webcamVideo');
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });
        
        video.srcObject = stream;
        webcamRunning = true;
        
        // Wait for video to load
        await new Promise(resolve => {
            video.onloadedmetadata = () => {
                video.width = video.videoWidth;
                video.height = video.videoHeight;
                
                // Set canvas dimensions
                const canvas = document.getElementById('poseCanvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                resolve();
            };
        });
        
    } catch (error) {
        console.error('Error accessing webcam:', error);
        throw new Error('Camera access denied or not available');
    }
}

function detectPose() {
    if (!webcamRunning || !poseLandmarker) return;
    
    const video = document.getElementById('webcamVideo');
    const canvas = document.getElementById('poseCanvas');
    const ctx = canvas.getContext('2d');
    
    const detectFrame = async () => {
        if (!webcamRunning) return;
        
        const startTimeMs = performance.now();
        
        try {
            // Detect pose
            const results = poseLandmarker.detectForVideo(video, startTimeMs);
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (results.landmarks && results.landmarks.length > 0) {
                // Draw skeleton and calculate angles
                const landmarks = results.landmarks[0];
                drawSkeleton(ctx, landmarks);
                const angles = calculateJointAngles(landmarks);
                displayAngles(angles);
                checkFormAndProvideFeedback(angles);
            }
            
            // Continue detection
            requestAnimationFrame(detectFrame);
            
        } catch (error) {
            console.error('Pose detection error:', error);
            stopAIMonitoring();
        }
    };
    
    detectFrame();
}

function drawSkeleton(ctx, landmarks) {
    // Draw connections (skeleton)
    const connections = [
        // Right side
        [11, 13], [13, 15], // Right arm
        [23, 25], [25, 27], // Right leg
        // Left side
        [12, 14], [14, 16], // Left arm
        [24, 26], [26, 28], // Left leg
        // Body
        [11, 12], [11, 23], [12, 24], [23, 24] // Torso
    ];
    
    // Draw connections
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 3;
    
    connections.forEach(([start, end]) => {
        if (landmarks[start] && landmarks[end]) {
            ctx.beginPath();
            ctx.moveTo(
                landmarks[start].x * ctx.canvas.width,
                landmarks[start].y * ctx.canvas.height
            );
            ctx.lineTo(
                landmarks[end].x * ctx.canvas.width,
                landmarks[end].y * ctx.canvas.height
            );
            ctx.stroke();
        }
    });
    
    // Draw landmarks
    ctx.fillStyle = '#FF0000';
    landmarks.forEach(landmark => {
        if (landmark.visibility > 0.5) {
            ctx.beginPath();
            ctx.arc(
                landmark.x * ctx.canvas.width,
                landmark.y * ctx.canvas.height,
                4, 0, 2 * Math.PI
            );
            ctx.fill();
        }
    });
}

function calculateJointAngles(landmarks) {
    const angles = {};
    
    // Helper function to calculate angle between three points
    const calculateAngle = (a, b, c) => {
        const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
        let angle = Math.abs(radians * 180.0 / Math.PI);
        if (angle > 180.0) angle = 360 - angle;
        return Math.round(angle);
    };
    
    // Left knee angle (hip-knee-ankle)
    if (landmarks[23] && landmarks[25] && landmarks[27]) {
        angles.left_knee = calculateAngle(landmarks[23], landmarks[25], landmarks[27]);
    }
    
    // Right knee angle
    if (landmarks[24] && landmarks[26] && landmarks[28]) {
        angles.right_knee = calculateAngle(landmarks[24], landmarks[26], landmarks[28]);
    }
    
    // Left elbow angle (shoulder-elbow-wrist)
    if (landmarks[11] && landmarks[13] && landmarks[15]) {
        angles.left_elbow = calculateAngle(landmarks[11], landmarks[13], landmarks[15]);
    }
    
    // Right elbow angle
    if (landmarks[12] && landmarks[14] && landmarks[16]) {
        angles.right_elbow = calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
    }
    
    // Hip angle (shoulder-hip-knee)
    if (landmarks[11] && landmarks[23] && landmarks[25]) {
        angles.left_hip = calculateAngle(landmarks[11], landmarks[23], landmarks[25]);
    }
    
    if (landmarks[12] && landmarks[24] && landmarks[26]) {
        angles.right_hip = calculateAngle(landmarks[12], landmarks[24], landmarks[26]);
    }
    
    return angles;
}

function displayAngles(angles) {
    const angleGrid = document.getElementById('angleGrid');
    if (!angleGrid) return;
    
    const angleItems = Object.entries(angles).map(([joint, angle]) => `
        <div class="angle-item">
            <span class="angle-label">${joint.replace('_', ' ')}:</span>
            <span class="angle-value">${angle}°</span>
        </div>
    `).join('');
    
    angleGrid.innerHTML = angleItems;
}

function checkFormAndProvideFeedback(angles) {
    const now = Date.now();
    const exerciseType = document.getElementById('exerciseType').value;
    const config = exerciseConfig[exerciseType];
    
    if (!config || now - lastFeedbackTime < feedbackCooldown) return;
    
    let feedbackKey = null;
    
    // Check knee angles for squats
    if (exerciseType === 'squat') {
        if (angles.left_knee && angles.left_knee < 70) {
            feedbackKey = 'knee_too_bent';
        } else if (angles.left_knee && angles.left_knee > 90 && angles.left_knee < 100) {
            feedbackKey = 'good_form';
        } else if (angles.left_knee && angles.left_knee > 100) {
            feedbackKey = 'knee_alignment';
        }
    }
    
    // Check for arm raises
    if (exerciseType === 'arm_raise') {
        if (angles.left_shoulder && angles.left_shoulder < 45) {
            feedbackKey = 'arm_position';
        }
    }
    
    // Provide feedback if needed
    if (feedbackKey) {
        speakFeedback(feedbackKey);
        addFeedbackMessage(feedbackMessages[currentLanguage][feedbackKey]);
        lastFeedbackTime = now;
    }
}

function speakFeedback(feedbackKey) {
    if (!speechSynthesis || !feedbackMessages[currentLanguage][feedbackKey]) return;
    
    // Cancel any ongoing speech
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(
        feedbackMessages[currentLanguage][feedbackKey]
    );
    
    // Set language based on selection
    const langMap = {
        'en': 'en-US',
        'hi': 'hi-IN',
        'mr': 'mr-IN',
        'ta': 'ta-IN',
        'te': 'te-IN'
    };
    
    utterance.lang = langMap[currentLanguage] || 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    speechSynthesis.speak(utterance);
}

function addFeedbackMessage(message) {
    const feedbackLog = document.getElementById('feedbackLog');
    if (!feedbackLog) return;
    
    const messageElement = document.createElement('p');
    messageElement.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    messageElement.style.marginBottom = '5px';
    messageElement.style.padding = '5px';
    messageElement.style.backgroundColor = '#f0f0f0';
    messageElement.style.borderRadius = '3px';
    
    feedbackLog.prepend(messageElement);
    
    // Keep only last 5 messages
    const messages = feedbackLog.querySelectorAll('p');
    if (messages.length > 5) {
        messages[messages.length - 1].remove();
    }
}

function stopAIMonitoring() {
    webcamRunning = false;
    
    // Stop webcam
    const video = document.getElementById('webcamVideo');
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    
    // Clear canvas
    const canvas = document.getElementById('poseCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update UI
    document.getElementById('startMonitoringBtn').style.display = 'inline-flex';
    document.getElementById('stopMonitoringBtn').style.display = 'none';
    
    // Clear angle display
    document.getElementById('angleGrid').innerHTML = '';
    
    addFeedbackMessage('AI Monitoring Stopped');
}

function testVoiceFeedback() {
    speakFeedback('good_form');
    showNotification('Testing voice feedback...', 'info');
}

// Helper function to load scripts dynamically
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ... (keep your existing functions: filterPatients, showAddPatientModal, etc.) ...

function updateCurrentDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', options);
}

function showNotification(message, type = 'info') {
    // ... (keep your existing showNotification function) ...
}

// Initialize on page load
console.log('Enhanced Doctor Dashboard with AI Monitoring loaded successfully');
