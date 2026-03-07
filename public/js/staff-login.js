// Check if user is already logged in
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('User already logged in, redirecting to dashboard...');
        window.location.href = 'dashboard.html';
    }
});

// Get DOM elements
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const loginText = document.getElementById('loginText');
const loginLoader = document.getElementById('loginLoader');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');

// Login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    // Basic validation
    if (!email || !password) {
        showError('Please enter both email and password');
        return;
    }
    
    // Show loading state
    loginText.style.display = 'none';
    loginLoader.style.display = 'inline-block';
    loginBtn.disabled = true;
    hideMessages();
    
    try {
        console.log('Attempting login for:', email);
        
        // Sign in with Firebase Auth
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log('Login successful:', userCredential.user.email);
        
        // Show success message
        showSuccess('✅ Login successful! Redirecting to dashboard...');
        
        // Redirect to dashboard after short delay
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
        
    } catch (error) {
        console.error('Login error:', error);
        
        // Show appropriate error message
        let errorMsg = 'Login failed. Please check your credentials.';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMsg = '❌ No account found with this email address.';
                break;
            case 'auth/wrong-password':
                errorMsg = '❌ Incorrect password. Please try again.';
                break;
            case 'auth/invalid-email':
                errorMsg = '❌ Please enter a valid email address.';
                break;
            case 'auth/invalid-credential':
                errorMsg = '❌ Invalid credentials. Please check your email and password.';
                break;
            case 'auth/too-many-requests':
                errorMsg = '❌ Too many failed login attempts. Please try again later.';
                break;
            case 'auth/network-request-failed':
                errorMsg = '❌ Network error. Please check your internet connection.';
                break;
            default:
                errorMsg = `❌ Login error: ${error.message}`;
        }
        
        showError(errorMsg);
        
        // Reset loading state on error
        loginText.style.display = 'inline';
        loginLoader.style.display = 'none';
        loginBtn.disabled = false;
    }
});

// Allow Enter key on password field
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loginForm.dispatchEvent(new Event('submit'));
    }
});

// Allow Enter key on email field
emailInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loginForm.dispatchEvent(new Event('submit'));
    }
});

// Error handling functions
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    successMessage.style.display = 'none';
}

function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    errorMessage.style.display = 'none';
}

function hideMessages() {
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
}