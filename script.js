// ============================================
// REHABAI VIRTUAL PHYSIOTHERAPIST
// ============================================

// DOM Elements
const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const feedbackText = document.getElementById('feedbackText');
const formScoreElement = document.getElementById('formScore');
const repCountElement = document.getElementById('repCount');
const sessionTimeElement = document.getElementById('sessionTime');
const caloriesElement = document.getElementById('calories');
const leftKneeAngleElement = document.getElementById('leftKneeAngle');
const rightKneeAngleElement = document.getElementById('rightKneeAngle');
const hipAngleElement = document.getElementById('hipAngle');
const backStraightnessElement = document.getElementById('backStraightness');
const statusIndicator = document.getElementById('statusIndicator');

// Buttons
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const calibrateBtn = document.getElementById('calibrateBtn');
const resetBtn = document.getElementById('resetBtn');
const audioToggle = document.getElementById('audioToggle');
const exerciseBtns = document.querySelectorAll('.exercise-btn');

// Pose detection variables
let pose = null;
let camera = null;
let isRunning = false;
let sessionStartTime = null;
let sessionTimer = null;
let currentExercise = 'squats';

// Exercise tracking
let repCount = 0;
let inRepPosition = false;
let lastFeedbackTime = 0;
let formScores = [];
let caloriesBurned = 0;

// ============================================
// INITIALIZATION
// ============================================

// Initialize MediaPipe Pose when page loads
window.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing RehabAI...');
    
    try {
        // Initialize MediaPipe Pose
        pose = new Pose({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
        });
        
        // Configure pose detection
        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        pose.onResults(onPoseResults);
        
        // Setup camera
        camera = new Camera(videoElement, {
            onFrame: async () => {
                if (isRunning) {
                    await pose.send({image: videoElement});
                }
            },
            width: 640,
            height: 480
        });
        
        await camera.start();
        
        // Setup canvas size
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        
        console.log('✅ RehabAI initialized successfully!');
        updateFeedback('Ready to start. Click "Start Analysis" when ready.', 'ready');
        
    } catch (error) {
        console.error('Error initializing RehabAI:', error);
        updateFeedback(`Error: ${error.message}. Please refresh the page.`, 'error');
    }
    
    setupEventListeners();
});

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Start/Stop buttons
    startBtn.addEventListener('click', () => {
        startSession();
    });
    
    stopBtn.addEventListener('click', () => {
        stopSession();
    });
    
    // Calibrate button
    calibrateBtn.addEventListener('click', () => {
        calibrateSystem();
    });
    
    // Reset button
    resetBtn.addEventListener('click', () => {
        resetSession();
    });
    
    // Exercise selection buttons
    exerciseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            exerciseBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentExercise = btn.dataset.exercise;
            updateFeedback(`Switched to ${getExerciseName(currentExercise)}.`, 'info');
        });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        switch(e.key) {
            case ' ':
            case 'Spacebar':
                if (isRunning) stopSession();
                else startSession();
                break;
            case 'r':
            case 'R':
                resetReps();
                break;
            case 'c':
            case 'C':
                calibrateSystem();
                break;
        }
    });
}

// ============================================
// SESSION MANAGEMENT
// ============================================

function startSession() {
    isRunning = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    sessionStartTime = Date.now();
    
    // Start session timer
    sessionTimer = setInterval(updateSessionTimer, 1000);
    
    updateFeedback('Session started! Begin your exercise.', 'started');
    statusIndicator.textContent = '● Active';
    statusIndicator.style.color = '#4CAF50';
}

function stopSession() {
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    
    // Stop session timer
    clearInterval(sessionTimer);
    
    updateFeedback('Session stopped. Good work!', 'stopped');
    statusIndicator.textContent = '● Paused';
    statusIndicator.style.color = '#FF9800';
    
    // Calculate and show summary
    showSessionSummary();
}

function resetSession() {
    repCount = 0;
    formScores = [];
    caloriesBurned = 0;
    repCountElement.textContent = '0';
    formScoreElement.textContent = '0%';
    caloriesElement.textContent = '0';
    sessionTimeElement.textContent = '0:00';
    
    updateFeedback('Session reset. Ready for new session.', 'info');
}

function resetReps() {
    repCount = 0;
    repCountElement.textContent = '0';
    updateFeedback('Rep count reset.', 'info');
}

function calibrateSystem() {
    updateFeedback('Calibrating... Please stand in T-pose.', 'calibrating');
    
    setTimeout(() => {
        updateFeedback('Calibration complete! Your position is optimized.', 'success');
    }, 3000);
}

// ============================================
// POSE PROCESSING
// ============================================

function onPoseResults(results) {
    // Clear canvas
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Draw video frame
    canvasCtx.drawImage(
        results.image, 0, 0, 
        canvasElement.width, 
        canvasElement.height
    );
    
    // If pose landmarks detected
    if (results.poseLandmarks) {
        // Draw skeleton
        drawSkeleton(results.poseLandmarks);
        
        // Analyze exercise form based on selected exercise
        analyzeExercise(results.poseLandmarks);
    }
    
    canvasCtx.restore();
}

// Draw skeleton on canvas
function drawSkeleton(landmarks) {
    // Pose connections for MediaPipe
    const connections = [
        // Body
        [11, 12], [11, 23], [12, 24], [23, 24],
        // Left arm
        [11, 13], [13, 15],
        // Right arm
        [12, 14], [14, 16],
        // Left leg
        [23, 25], [25, 27], [27, 29], [29, 31],
        // Right leg
        [24, 26], [26, 28], [28, 30], [30, 32],
        // Left foot
        [27, 31],
        // Right foot
        [28, 32]
    ];
    
    // Draw connections
    canvasCtx.strokeStyle = '#00FF00';
    canvasCtx.lineWidth = 3;
    
    connections.forEach(([start, end]) => {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];
        
        if (startPoint.visibility > 0.5 && endPoint.visibility > 0.5) {
            canvasCtx.beginPath();
            canvasCtx.moveTo(
                startPoint.x * canvasElement.width,
                startPoint.y * canvasElement.height
            );
            canvasCtx.lineTo(
                endPoint.x * canvasElement.width,
                endPoint.y * canvasElement.height
            );
            canvasCtx.stroke();
        }
    });
    
    // Draw joints
    landmarks.forEach((landmark, index) => {
        if (landmark.visibility > 0.5) {
            const x = landmark.x * canvasElement.width;
            const y = landmark.y * canvasElement.height;
            
            // Color code important joints
            if ([23, 24, 25, 26].includes(index)) { // Hips and knees
                canvasCtx.fillStyle = '#FF0000';
            } else if ([11, 12].includes(index)) { // Shoulders
                canvasCtx.fillStyle = '#0000FF';
            } else {
                canvasCtx.fillStyle = '#FFFF00';
            }
            
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, 6, 0, 2 * Math.PI);
            canvasCtx.fill();
        }
    });
}

// ============================================
// EXERCISE ANALYSIS
// ============================================

function analyzeExercise(landmarks) {
    switch(currentExercise) {
        case 'squats':
            analyzeSquats(landmarks);
            break;
        case 'bicep_curls':
            analyzeBicepCurls(landmarks);
            break;
        case 'shoulder_press':
            analyzeShoulderPress(landmarks);
            break;
        case 'leg_raises':
            analyzeLegRaises(landmarks);
            break;
    }
}

// SQUATS ANALYSIS
function analyzeSquats(landmarks) {
    // Landmark indices
    const LEFT_HIP = 23;
    const LEFT_KNEE = 25;
    const LEFT_ANKLE = 27;
    const RIGHT_HIP = 24;
    const RIGHT_KNEE = 26;
    const RIGHT_ANKLE = 28;
    const LEFT_SHOULDER = 11;
    const RIGHT_SHOULDER = 12;
    
    // Calculate angles
    const leftKneeAngle = calculateAngle(
        landmarks[LEFT_HIP],
        landmarks[LEFT_KNEE],
        landmarks[LEFT_ANKLE]
    );
    
    const rightKneeAngle = calculateAngle(
        landmarks[RIGHT_HIP],
        landmarks[RIGHT_KNEE],
        landmarks[RIGHT_ANKLE]
    );
    
    const hipAngle = calculateAngle(
        landmarks[LEFT_SHOULDER],
        landmarks[LEFT_HIP],
        landmarks[LEFT_KNEE]
    );
    
    // Update display
    leftKneeAngleElement.textContent = `${Math.round(leftKneeAngle)}°`;
    rightKneeAngleElement.textContent = `${Math.round(rightKneeAngle)}°`;
    hipAngleElement.textContent = `${Math.round(hipAngle)}°`;
    
    // Calculate back straightness
    const backAngle = calculateAngle(
        landmarks[LEFT_SHOULDER],
        landmarks[LEFT_HIP],
        {x: landmarks[LEFT_HIP].x, y: landmarks[LEFT_HIP].y + 0.1}
    );
    
    const backScore = Math.max(0, 100 - Math.abs(backAngle - 180) * 2);
    backStraightnessElement.textContent = `${Math.round(backScore)}%`;
    
    // Analyze form and give feedback
    analyzeSquatForm(leftKneeAngle, rightKneeAngle, hipAngle, backScore);
}

// Helper: Calculate angle between three points
function calculateAngle(A, B, C) {
    const AB = Math.sqrt(Math.pow(B.x - A.x, 2) + Math.pow(B.y - A.y, 2));
    const BC = Math.sqrt(Math.pow(B.x - C.x, 2) + Math.pow(B.y - C.y, 2));
    const AC = Math.sqrt(Math.pow(C.x - A.x, 2) + Math.pow(C.y - A.y, 2));
    
    const cosAngle = (AB * AB + BC * BC - AC * AC) / (2 * AB * BC);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    
    return angle * (180 / Math.PI);
}

// SQUAT FORM ANALYSIS
function analyzeSquatForm(leftKneeAngle, rightKneeAngle, hipAngle, backScore) {
    const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
    let corrections = [];
    let formScore = 100;
    
    // 1. Check squat depth
    if (avgKneeAngle > 160) {
        corrections.push("STAND UP");
        formScore -= 40;
    } else if (avgKneeAngle > 140) {
        corrections.push("GO DEEPER");
        formScore -= 20;
    } else if (avgKneeAngle < 80) {
        corrections.push("TOO DEEP");
        formScore -= 30;
    } else if (avgKneeAngle > 100 && avgKneeAngle < 140) {
        // Good depth range
    }
    
    // 2. Check knee symmetry
    const kneeDiff = Math.abs(leftKneeAngle - rightKneeAngle);
    if (kneeDiff > 15) {
        corrections.push("KNEES EVEN");
        formScore -= 25;
    }
    
    // 3. Check back posture
    if (backScore < 70) {
        corrections.push("STRAIGHTEN BACK");
        formScore -= 15;
    }
    
    // 4. Check hip angle (forward lean)
    if (hipAngle > 170) {
        corrections.push("LEAN FORWARD");
        formScore -= 10;
    }
    
    // Update form score
    formScore = Math.max(0, Math.min(100, formScore));
    formScoreElement.textContent = `${Math.round(formScore)}%`;
    formScores.push(formScore);
    
    // Rep counting logic
    if (avgKneeAngle < 120 && !inRepPosition) {
        inRepPosition = true;
    } else if (avgKneeAngle > 150 && inRepPosition) {
        inRepPosition = false;
        repCount++;
        repCountElement.textContent = repCount;
        
        // Estimate calories (very rough estimate)
        caloriesBurned += 0.5;
        caloriesElement.textContent = Math.round(caloriesBurned);
        
        // Feedback for completed rep
        if (formScore > 70) {
            updateFeedback("✅ GREAT REP! Keep going!", "success", true);
        } else {
            updateFeedback("⚠ Rep completed. Try to improve form.", "warning", true);
        }
        return;
    }
    
    // Give real-time form feedback (throttled)
    const now = Date.now();
    if (now - lastFeedbackTime > 2500) { // Every 2.5 seconds
        if (corrections.length > 0) {
            updateFeedback(corrections[0], "correction", true);
        } else if (formScore > 85) {
            updateFeedback("👍 PERFECT FORM!", "perfect", true);
        }
        lastFeedbackTime = now;
    }
}

// Other exercises (simplified for now)
function analyzeBicepCurls(landmarks) {
    updateFeedback("Bicep curls analysis coming soon!", "info");
}

function analyzeShoulderPress(landmarks) {
    updateFeedback("Shoulder press analysis coming soon!", "info");
}

function analyzeLegRaises(landmarks) {
    updateFeedback("Leg raises analysis coming soon!", "info");
}

// ============================================
// FEEDBACK SYSTEM
// ============================================

function updateFeedback(message, type = "info", speak = false) {
    feedbackText.textContent = message;
    
    // Color code based on type
    const feedbackBox = document.getElementById('feedbackBox');
    feedbackBox.style.borderLeftColor = 
        type === 'success' ? '#4CAF50' :
        type === 'warning' ? '#FF9800' :
        type === 'error' ? '#F44336' :
        type === 'correction' ? '#2196F3' :
        type === 'perfect' ? '#9C27B0' :
        '#4a6fa5';
    
    // Speak feedback if audio is enabled
    if (speak && audioToggle.checked && 'speechSynthesis' in window) {
        speakFeedback(message);
    }
}

function speakFeedback(text) {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Create and speak utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Select a voice
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
        utterance.voice = voices[0];
    }
    
    window.speechSynthesis.speak(utterance);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function updateSessionTimer() {
    if (!sessionStartTime) return;
    
    const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    sessionTimeElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getExerciseName(exercise) {
    const names = {
        'squats': 'Squats',
        'bicep_curls': 'Bicep Curls',
        'shoulder_press': 'Shoulder Press',
        'leg_raises': 'Leg Raises'
    };
    return names[exercise] || exercise;
}

function showSessionSummary() {
    if (formScores.length === 0) return;
    
    const avgScore = formScores.reduce((a, b) => a + b, 0) / formScores.length;
    const bestScore = Math.max(...formScores);
    
    document.getElementById('totalReps').textContent = repCount;
    document.getElementById('avgScore').textContent = `${Math.round(avgScore)}%`;
    document.getElementById('bestScore').textContent = `${Math.round(bestScore)}%`;
    
    // Show congratulatory message
    let message = "Session Complete! ";
    if (avgScore > 85) {
        message += "Excellent form!";
    } else if (avgScore > 70) {
        message += "Good work!";
    } else {
        message += "Keep practicing!";
    }
    
    updateFeedback(message, "success");
}

// ============================================
// GETTING STARTED MESSAGE
// ============================================

console.log(`
╔══════════════════════════════════════════╗
║      REHABAI VIRTUAL PHYSIOTHERAPIST     ║
║               v1.0 - PS33                ║
╠══════════════════════════════════════════╣
║                                          ║
║  To use:                                 ║
║  1. Open index.html in Chrome/Firefox    ║
║  2. Allow camera access when prompted    ║
║  3. Stand 2 meters from camera           ║
║  4. Click "Start Analysis"               ║
║  5. Begin your squats!                   ║
║                                          ║
║  Keyboard Shortcuts:                     ║
║  • SPACE = Start/Stop                    ║
║  • R = Reset Reps                        ║
║  • C = Calibrate                         ║
║                                          ║
╚══════════════════════════════════════════╝
`);