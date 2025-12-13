// patient-script.js - Patient Dashboard Functionality
let pose = null;
let camera = null;
let isExerciseActive = false;
let sessionStartTime = null;
let sessionTimer = null;
let currentExercise = 'squats';
let sessionReps = 0;
let currentFormScore = 0;
let userData = null;

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    const user = JSON.parse(localStorage.getItem('rehabai_user'));
    
    if (!user || user.role !== 'patient') {
        window.location.href = 'index.html';
        return;
    }
    
    userData = user;
    
    // Initialize UI
    initializeUI();
    
    // Initialize AI Pose Detection
    await initializePoseDetection();
    
    // Load user data
    await loadUserData();
    
    // Setup event listeners
    setupEventListeners();
    
    // Update date
    updateCurrentDate();
});

function initializeUI() {
    // Set user info
    document.getElementById('userName').textContent = userData.name;
    document.getElementById('userEmail').textContent = userData.email;
    document.getElementById('greetingName').textContent = userData.name.split(' ')[0];
    
    if (userData.condition) {
        document.getElementById('userCondition').textContent = 
            userData.condition.replace('_', ' ').toUpperCase();
    }
    
    // Set avatar initials
    const initials = userData.name.split(' ').map(n => n[0]).join('').toUpperCase();
    document.getElementById('userAvatar').textContent = initials;
}

async function loadUserData() {
    try {
        // In a real app, you would load from Firestore
        // For now, use localStorage or mock data
        
        // Mock data for demonstration
        document.getElementById('totalSessions').textContent = '12';
        document.getElementById('avgFormScore').textContent = '78%';
        document.getElementById('scoreProgress').style.width = '78%';
        document.getElementById('totalReps').textContent = '245';
        document.getElementById('recoveryProgress').textContent = '65%';
        document.getElementById('recoveryBar').style.width = '65%';
        
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Error loading data. Please refresh.', 'error');
    }
}

async function initializePoseDetection() {
    try {
        pose = new Pose({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
        });
        
        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        pose.onResults(onPoseResults);
        
        // Setup camera
        const videoElement = document.querySelector('.input_video');
        const canvasElement = document.querySelector('.output_canvas');
        
        camera = new Camera(videoElement, {
            onFrame: async () => {
                if (isExerciseActive) {
                    await pose.send({image: videoElement});
                }
            },
            width: 640,
            height: 480
        });
        
        await camera.start();
        
        // Setup canvas
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        
        console.log('AI Pose Detection initialized');
        
    } catch (error) {
        console.error('Error initializing pose detection:', error);
        showNotification('Camera access failed. Please check permissions.', 'error');
    }
}

function onPoseResults(results) {
    const canvasElement = document.querySelector('.output_canvas');
    const canvasCtx = canvasElement.getContext('2d');
    
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
        // Draw skeleton (simplified for speed)
        drawSkeleton(canvasCtx, results.poseLandmarks);
        
        // Analyze exercise
        analyzeExercise(results.poseLandmarks);
    }
    
    canvasCtx.restore();
}

function drawSkeleton(ctx, landmarks) {
    // Simplified skeleton drawing
    const connections = [
        [11, 12], [11, 23], [12, 24], [23, 24],
        [11, 13], [13, 15], [12, 14], [14, 16],
        [23, 25], [25, 27], [24, 26], [26, 28]
    ];
    
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 3;
    
    connections.forEach(([start, end]) => {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];
        
        if (startPoint.visibility > 0.5 && endPoint.visibility > 0.5) {
            ctx.beginPath();
            ctx.moveTo(
                startPoint.x * ctx.canvas.width,
                startPoint.y * ctx.canvas.height
            );
            ctx.lineTo(
                endPoint.x * ctx.canvas.width,
                endPoint.y * ctx.canvas.height
            );
            ctx.stroke();
        }
    });
}

function analyzeExercise(landmarks) {
    // Calculate key angles for squat analysis
    const LEFT_HIP = 23;
    const LEFT_KNEE = 25;
    const LEFT_ANKLE = 27;
    const RIGHT_HIP = 24;
    const RIGHT_KNEE = 26;
    const RIGHT_ANKLE = 28;
    const LEFT_SHOULDER = 11;
    
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
    document.getElementById('kneeAngle').textContent = Math.round((leftKneeAngle + rightKneeAngle) / 2) + '°';
    document.getElementById('hipAngle').textContent = Math.round(hipAngle) + '°';
    
    // Analyze form and provide feedback
    analyzeSquatForm(leftKneeAngle, rightKneeAngle, hipAngle);
}

function calculateAngle(A, B, C) {
    const AB = Math.sqrt(Math.pow(B.x - A.x, 2) + Math.pow(B.y - A.y, 2));
    const BC = Math.sqrt(Math.pow(B.x - C.x, 2) + Math.pow(B.y - C.y, 2));
    const AC = Math.sqrt(Math.pow(C.x - A.x, 2) + Math.pow(C.y - A.y, 2));
    
    const cosAngle = (AB * AB + BC * BC - AC * AC) / (2 * AB * BC);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    
    return angle * (180 / Math.PI);
}

function analyzeSquatForm(leftKneeAngle, rightKneeAngle, hipAngle) {
    const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
    let corrections = [];
    let formScore = 100;
    
    // Check depth
    if (avgKneeAngle > 160) {
        corrections.push("BEND YOUR KNEES");
        formScore -= 40;
    } else if (avgKneeAngle > 140) {
        corrections.push("GO DEEPER");
        formScore -= 20;
    } else if (avgKneeAngle < 80) {
        corrections.push("TOO DEEP - RAISE UP");
        formScore -= 30;
    }
    
    // Check symmetry
    const kneeDiff = Math.abs(leftKneeAngle - rightKneeAngle);
    if (kneeDiff > 15) {
        corrections.push("KEEP KNEES EVEN");
        formScore -= 25;
    }
    
    // Check back posture
    if (hipAngle > 170) {
        corrections.push("LEAN FORWARD SLIGHTLY");
        formScore -= 10;
    }
    
    formScore = Math.max(0, Math.min(100, formScore));
    currentFormScore = formScore;
    
    // Update display
    document.getElementById('currentScore').textContent = Math.round(formScore) + '%';
    
    // Rep counting logic (simplified)
    if (avgKneeAngle < 120) {
        // In squat position
        if (!window.inSquatPosition) {
            window.inSquatPosition = true;
        }
    } else if (avgKneeAngle > 150 && window.inSquatPosition) {
        // Completed a rep
        window.inSquatPosition = false;
        sessionReps++;
        document.getElementById('sessionReps').textContent = sessionReps;
        
        // Update total reps
        const totalRepsElement = document.getElementById('totalReps');
        const currentTotal = parseInt(totalRepsElement.textContent) || 0;
        totalRepsElement.textContent = currentTotal + 1;
        
        // Show rep feedback
        if (formScore > 70) {
            updateFeedback("✅ GOOD REP! Keep going!", "success");
        } else {
            updateFeedback("⚠ Rep completed. Focus on form.", "warning");
        }
    }
    
    // Provide real-time feedback
    const now = Date.now();
    if (!window.lastFeedbackTime) window.lastFeedbackTime = 0;
    
    if (now - window.lastFeedbackTime > 2500) {
        if (corrections.length > 0) {
            updateFeedback(corrections[0], "correction");
        } else if (formScore > 85) {
            updateFeedback("👍 PERFECT FORM!", "perfect");
        }
        window.lastFeedbackTime = now;
    }
}

function updateFeedback(message, type = "info") {
    const feedbackText = document.getElementById('feedbackText');
    const feedbackBox = document.querySelector('.feedback-box');
    
    feedbackText.textContent = message;
    
    // Color code based on type
    feedbackBox.style.borderLeftColor = 
        type === 'success' ? '#4CAF50' :
        type === 'warning' ? '#FF9800' :
        type === 'correction' ? '#2196F3' :
        '#4a6fa5';
    
    // Speak if audio is enabled
    const audioToggle = document.getElementById('audioToggle');
    if (audioToggle && audioToggle.checked && 'speechSynthesis' in window) {
        speakFeedback(message);
    }
}

function speakFeedback(text) {
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
        utterance.voice = voices[0];
    }
    
    window.speechSynthesis.speak(utterance);
}

function setupEventListeners() {
    // Exercise controls
    document.getElementById('startExercise').addEventListener('click', startExerciseSession);
    document.getElementById('stopExercise').addEventListener('click', stopExerciseSession);
    document.getElementById('calibrateCamera').addEventListener('click', calibrateCamera);
    
    // Exercise selection
    document.querySelectorAll('.exercise-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.exercise-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            currentExercise = this.dataset.exercise;
            updateFeedback(`Switched to ${currentExercise.replace('_', ' ')}. Ready when you are!`, "info");
        });
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

function startExerciseSession() {
    isExerciseActive = true;
    sessionStartTime = Date.now();
    sessionReps = 0;
    
    // Update UI
    document.getElementById('startExercise').disabled = true;
    document.getElementById('stopExercise').disabled = false;
    document.getElementById('statusText').textContent = 'Active';
    document.getElementById('statusText').style.color = '#4CAF50';
    
    // Start timer
    sessionTimer = setInterval(updateSessionTimer, 1000);
    
    updateFeedback('Exercise session started! Begin your squats.', 'success');
    
    // Show notification
    showNotification('Exercise session started', 'success');
}

function stopExerciseSession() {
    isExerciseActive = false;
    
    // Update UI
    document.getElementById('startExercise').disabled = false;
    document.getElementById('stopExercise').disabled = true;
    document.getElementById('statusText').textContent = 'Paused';
    document.getElementById('statusText').style.color = '#FF9800';
    
    // Stop timer
    clearInterval(sessionTimer);
    
    // Calculate session summary
    const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000);
    const minutes = Math.floor(sessionDuration / 60);
    const seconds = sessionDuration % 60;
    
    updateFeedback(
        `Session completed! You did ${sessionReps} reps in ${minutes}:${seconds.toString().padStart(2, '0')}.`,
        'success'
    );
    
    // Show summary notification
    showNotification(`Session complete: ${sessionReps} reps, ${Math.round(currentFormScore)}% form`, 'success');
    
    // Save session data (in a real app, save to Firestore)
    saveSessionData(sessionReps, currentFormScore, sessionDuration);
}

function calibrateCamera() {
    updateFeedback('Calibrating... Please stand in T-pose with arms extended.', 'info');
    
    setTimeout(() => {
        updateFeedback('Calibration complete! Your position is optimized.', 'success');
        showNotification('Camera calibrated successfully', 'success');
    }, 3000);
}

function updateSessionTimer() {
    if (!sessionStartTime) return;
    
    const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    document.getElementById('sessionTimer').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function saveSessionData(reps, score, duration) {
    // In a real app, save to Firestore
    console.log('Saving session:', { reps, score, duration });
    
    // Update progress locally
    const totalSessionsElement = document.getElementById('totalSessions');
    const currentSessions = parseInt(totalSessionsElement.textContent) || 0;
    totalSessionsElement.textContent = currentSessions + 1;
    
    // Update form score average
    const avgScoreElement = document.getElementById('avgFormScore');
    const currentAvg = parseInt(avgScoreElement.textContent) || 0;
    const newAvg = Math.round((currentAvg + score) / 2);
    avgScoreElement.textContent = newAvg + '%';
    document.getElementById('scoreProgress').style.width = newAvg + '%';
}

function logout() {
    localStorage.removeItem('rehabai_user');
    window.location.href = 'index.html';
}

function updateCurrentDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', options);
}

function showNotification(message, type = 'info') {
    const notificationPanel = document.getElementById('notificationPanel');
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <p><strong>${type.toUpperCase()}:</strong> ${message}</p>
    `;
    
    notificationPanel.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Initialize on page load
console.log('Patient dashboard loaded successfully');