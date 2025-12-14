// auth.js - Authentication Logic
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const switchToRegister = document.getElementById('switchToRegister');
    const switchToLogin = document.getElementById('switchToLogin');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notificationMessage');
    const patientFields = document.getElementById('patientFields');
    const doctorFields = document.getElementById('doctorFields');
    
    // Role selection for registration
    const registerRoleRadios = document.querySelectorAll('input[name="registerRole"]');
    const loginRoleRadios = document.querySelectorAll('input[name="loginRole"]');
    
    // Tab switching
    loginTab.addEventListener('click', () => switchTab('login'));
    registerTab.addEventListener('click', () => switchTab('register'));
    switchToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('register');
    });
    switchToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('login');
    });
    
    // Show/hide password
    const showLoginPassword = document.getElementById('showLoginPassword');
    const loginPassword = document.getElementById('loginPassword');
    
    showLoginPassword.addEventListener('change', function() {
        loginPassword.type = this.checked ? 'text' : 'password';
    });
    
    // Password strength indicator
    const registerPassword = document.getElementById('registerPassword');
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');
    
    registerPassword.addEventListener('input', function() {
        const password = this.value;
        let strength = 0;
        
        if (password.length >= 8) strength += 1;
        if (/[A-Z]/.test(password)) strength += 1;
        if (/[0-9]/.test(password)) strength += 1;
        if (/[^A-Za-z0-9]/.test(password)) strength += 1;
        
        const width = strength * 25;
        strengthBar.style.width = width + '%';
        
        if (strength === 0) {
            strengthBar.style.backgroundColor = '#ff4444';
            strengthText.textContent = 'Very Weak';
        } else if (strength === 1) {
            strengthBar.style.backgroundColor = '#ff8800';
            strengthText.textContent = 'Weak';
        } else if (strength === 2) {
            strengthBar.style.backgroundColor = '#ffbb33';
            strengthText.textContent = 'Fair';
        } else if (strength === 3) {
            strengthBar.style.backgroundColor = '#00C851';
            strengthText.textContent = 'Good';
        } else {
            strengthBar.style.backgroundColor = '#007E33';
            strengthText.textContent = 'Strong';
        }
    });
    
    // Show/hide appropriate fields based on role
    registerRoleRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'patient') {
                patientFields.style.display = 'block';
                doctorFields.style.display = 'none';
            } else {
                patientFields.style.display = 'none';
                doctorFields.style.display = 'block';
            }
        });
    });
    
    // Initialize - show patient fields by default
    patientFields.style.display = 'block';
    doctorFields.style.display = 'none';
    
    // LOGIN FUNCTION
    loginBtn.addEventListener('click', async function() {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        const role = document.querySelector('input[name="loginRole"]:checked').value;
        
        if (!email || !password) {
            showNotification('Please fill in all fields', 'error');
            return;
        }
        
        try {
            showNotification('Logging in...', 'info');
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
            
            // Firebase authentication
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Get user data from Firestore
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                
                // Store user data in localStorage for session
                localStorage.setItem('rehabai_user', JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    name: userData.name,
                    role: userData.role,
                    ...userData
                }));
                
                // Redirect based on role
                if (role === 'patient' && userData.role === 'patient') {
                    window.location.href = 'patient-dashboard.html';
                } else if (role === 'doctor' && userData.role === 'doctor') {
                    window.location.href = 'doctor-dashboard.html';
                } else {
                    showNotification(`You are registered as a ${userData.role}, not a ${role}`, 'error');
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
                }
            } else {
                showNotification('User data not found. Please register first.', 'error');
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
            }
            
        } catch (error) {
            console.error('Login error:', error);
            
            let errorMessage = 'Login failed. ';
            switch(error.code) {
                case 'auth/user-not-found':
                    errorMessage += 'User not found.';
                    break;
                case 'auth/wrong-password':
                    errorMessage += 'Incorrect password.';
                    break;
                case 'auth/invalid-email':
                    errorMessage += 'Invalid email format.';
                    break;
                default:
                    errorMessage += error.message;
            }
            
            showNotification(errorMessage, 'error');
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        }
    });
    
    // REGISTER FUNCTION
    registerBtn.addEventListener('click', async function() {
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;
        const role = document.querySelector('input[name="registerRole"]:checked').value;
        
        // Validation
        if (!name || !email || !password || !confirmPassword) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            showNotification('Passwords do not match', 'error');
            return;
        }
        
        if (password.length < 6) {
            showNotification('Password must be at least 6 characters', 'error');
            return;
        }
        
        try {
            showNotification('Creating account...', 'info');
            registerBtn.disabled = true;
            registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
            
            // Create user in Firebase Authentication
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Prepare user data
            const userData = {
                uid: user.uid,
                name: name,
                email: email,
                role: role,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Add role-specific data
            if (role === 'patient') {
                userData.age = parseInt(document.getElementById('patientAge').value) || 30;
                userData.condition = document.getElementById('patientCondition').value;
                userData.progress = {
                    totalSessions: 0,
                    totalReps: 0,
                    avgFormScore: 0,
                    lastSession: null
                };
            } else if (role === 'doctor') {
                userData.license = document.getElementById('doctorLicense').value;
                userData.specialty = document.getElementById('doctorSpecialty').value;
                userData.patients = []; // Array of patient IDs
            }
            
            // Save user data to Firestore
            await db.collection('users').doc(user.uid).set(userData);
            
            // Store in localStorage
            localStorage.setItem('rehabai_user', JSON.stringify(userData));
            
            showNotification('Account created successfully!', 'success');
            
            // Redirect after short delay
            setTimeout(() => {
                if (role === 'patient') {
                    window.location.href = 'patient-dashboard.html';
                } else {
                    window.location.href = 'doctor-dashboard.html';
                }
            }, 1500);
            
        } catch (error) {
            console.error('Registration error:', error);
            
            let errorMessage = 'Registration failed. ';
            switch(error.code) {
                case 'auth/email-already-in-use':
                    errorMessage += 'Email already registered.';
                    break;
                case 'auth/invalid-email':
                    errorMessage += 'Invalid email format.';
                    break;
                case 'auth/weak-password':
                    errorMessage += 'Password is too weak.';
                    break;
                default:
                    errorMessage += error.message;
            }
            
            showNotification(errorMessage, 'error');
            registerBtn.disabled = false;
            registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
        }
    });
    
    // DEMO LOGIN (for quick testing)
    document.querySelector('.demo-login').addEventListener('click', function(e) {
        if (e.target.tagName === 'A') return;
        
        // Auto-fill demo credentials
        document.getElementById('loginEmail').value = 'patient@demo.com';
        document.getElementById('loginPassword').value = 'pass123';
        
        showNotification('Demo credentials filled. Click Login to continue.', 'info');
    });
    
    // Helper Functions
    function switchTab(tab) {
        if (tab === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.classList.add('active');
            registerForm.classList.remove('active');
        } else {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            registerForm.classList.add('active');
            loginForm.classList.remove('active');
        }
    }
    
    function showNotification(message, type) {
        notificationMessage.textContent = message;
        notification.className = 'auth-notification show ' + type;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 5000);
    }
    
    // Check if user is already logged in
    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in, check localStorage for role
            const userData = JSON.parse(localStorage.getItem('rehabai_user'));
            if (userData) {
                if (userData.role === 'patient') {
                    window.location.href = 'patient-dashboard.html';
                } else if (userData.role === 'doctor') {
                    window.location.href = 'doctor-dashboard.html';
                }
            }
        }
    });
});
