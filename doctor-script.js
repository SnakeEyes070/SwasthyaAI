// doctor-script.js - Doctor Dashboard Functionality
let userData = null;
let patients = [];

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
                status: 'active'
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
                status: 'active'
            },
            {
                id: '3',
                name: 'Robert Chen',
                email: 'robert@example.com',
                condition: 'Shoulder Injury',
                age: 35,
                lastSession: '2024-01-13',
                compliance: 65,
                formScore: 62,
                status: 'needs_attention'
            },
            {
                id: '4',
                name: 'Maria Garcia',
                email: 'maria@example.com',
                condition: 'Sports Recovery',
                age: 28,
                lastSession: '2024-01-12',
                compliance: 78,
                formScore: 81,
                status: 'active'
            }
        ];
        
        renderPatients(patients);
        
    } catch (error) {
        console.error('Error loading patients:', error);
        showNotification('Error loading patients. Please refresh.', 'error');
    }
}

function renderPatients(patientsList) {
    const patientGrid = document.getElementById('patientGrid');
    patientGrid.innerHTML = '';
    
    if (patientsList.length === 0) {
        patientGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-friends"></i>
                <p>No patients found</p>
            </div>
        `;
        return;
    }
    
    patientsList.forEach(patient => {
        const patientCard = document.createElement('div');
        patientCard.className = 'patient-card';
        
        // Get initials for avatar
        const initials = patient.name.split(' ').map(n => n[0]).join('').toUpperCase();
        
        // Determine status color
        const statusClass = patient.status === 'active' ? 'status-active' : 'status-inactive';
        const statusText = patient.status === 'active' ? 'Active' : 'Needs Attention';
        
        patientCard.innerHTML = `
            <div class="patient-header">
                <div class="patient-name">
                    <div class="patient-avatar">${initials}</div>
                    <div>
                        <h4>${patient.name}</h4>
                        <p>${patient.email}</p>
                    </div>
                </div>
                <div class="patient-status ${statusClass}">${statusText}</div>
            </div>
            
            <div class="patient-info">
                <div class="info-item">
                    <label>Condition</label>
                    <span>${patient.condition}</span>
                </div>
                <div class="info-item">
                    <label>Age</label>
                    <span>${patient.age}</span>
                </div>
                <div class="info-item">
                    <label>Compliance</label>
                    <span>${patient.compliance}%</span>
                </div>
                <div class="info-item">
                    <label>Form Score</label>
                    <span>${patient.formScore}%</span>
                </div>
            </div>
            
            <div class="patient-actions">
                <button class="btn btn-sm" onclick="viewPatient('${patient.id}')">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="btn btn-sm btn-primary" onclick="messagePatient('${patient.id}')">
                    <i class="fas fa-comment"></i> Message
                </button>
                <button class="btn btn-sm" onclick="prescribeExercise('${patient.id}')">
                    <i class="fas fa-prescription"></i> Prescribe
                </button>
            </div>
        `;
        
        patientGrid.appendChild(patientCard);
    });
}

function setupEventListeners() {
    // Patient filter
    document.getElementById('patientFilter').addEventListener('change', function() {
        filterPatients(this.value);
    });
    
    // Add patient modal
    document.getElementById('addPatientBtn').addEventListener('click', showAddPatientModal);
    document.getElementById('closeModal').addEventListener('click', hideAddPatientModal);
    document.getElementById('cancelAddPatient').addEventListener('click', hideAddPatientModal);
    document.getElementById('savePatientBtn').addEventListener('click', saveNewPatient);
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

function filterPatients(filter) {
    let filteredPatients = [...patients];
    
    switch(filter) {
        case 'active':
            filteredPatients = patients.filter(p => p.status === 'active');
            break;
        case 'recent':
            // Filter for recent activity (last 7 days)
            filteredPatients = patients.filter(p => {
                const lastSession = new Date(p.lastSession);
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                return lastSession >= sevenDaysAgo;
            });
            break;
        case 'needs_attention':
            filteredPatients = patients.filter(p => p.compliance < 70 || p.formScore < 65);
            break;
        // 'all' - no filter
    }
    
    renderPatients(filteredPatients);
}

function showAddPatientModal() {
    document.getElementById('addPatientModal').style.display = 'flex';
}

function hideAddPatientModal() {
    document.getElementById('addPatientModal').style.display = 'none';
    // Clear form
    document.getElementById('patientEmail').value = '';
    document.getElementById('prescription').value = '';
}

async function saveNewPatient() {
    const email = document.getElementById('patientEmail').value.trim();
    const condition = document.getElementById('patientCondition').value;
    const prescription = document.getElementById('prescription').value.trim();
    
    if (!email) {
        showNotification('Please enter patient email', 'error');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }
    
    try {
        // In a real app, you would:
        // 1. Check if user exists in Firebase
        // 2. Add doctor-patient relationship
        // 3. Send invitation email
        
        // Mock success
        showNotification('Patient invitation sent successfully', 'success');
        
        // Add to local list (for demo)
        const newPatient = {
            id: Date.now().toString(),
            name: email.split('@')[0], // Extract name from email for demo
            email: email,
            condition: condition.replace('_', ' '),
            age: Math.floor(Math.random() * 40) + 20,
            lastSession: new Date().toISOString().split('T')[0],
            compliance: 0,
            formScore: 0,
            status: 'active'
        };
        
        patients.push(newPatient);
        renderPatients(patients);
        
        // Update stats
        const activePatientsElement = document.getElementById('activePatients');
        const currentCount = parseInt(activePatientsElement.textContent) || 0;
        activePatientsElement.textContent = currentCount + 1;
        
        hideAddPatientModal();
        
    } catch (error) {
        console.error('Error adding patient:', error);
        showNotification('Failed to add patient. Please try again.', 'error');
    }
}

// Patient actions
function viewPatient(patientId) {
    showNotification('View patient details - Feature coming soon!', 'info');
    // In a real app, navigate to patient detail page
}

function messagePatient(patientId) {
    showNotification('Send message to patient - Feature coming soon!', 'info');
    // In a real app, open messaging interface
}

function prescribeExercise(patientId) {
    showNotification('Prescribe exercises - Feature coming soon!', 'info');
    // In a real app, open prescription form
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
console.log('Doctor dashboard loaded successfully');