// Check if admin is already logged in
auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            const adminDoc = await db.collection('admins').doc(user.uid).get();
            if (adminDoc.exists) {
                console.log('Admin already logged in, redirecting...');
                window.location.href = 'admin-dashboard.html';
            } else {
                await auth.signOut();
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
        }
    }
});

// Handle admin login form submission
document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');
    const loginText = document.getElementById('loginText');
    const loginLoader = document.getElementById('loginLoader');
    
    // Disable button and show loader
    loginBtn.disabled = true;
    loginText.style.display = 'none';
    loginLoader.style.display = 'inline-block';
    hideMessages();
    
    try {
        console.log('Attempting admin login for:', email);
        
        // Sign in with Firebase Authentication
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        console.log('Firebase auth successful, checking admin status...');
        
        // Check if user is an admin
        const adminDoc = await db.collection('admins').doc(user.uid).get();
        
        if (!adminDoc.exists) {
            // Not an admin, sign them out
            await auth.signOut();
            showError('❌ Access Denied: You are not authorized as an administrator.');
            loginBtn.disabled = false;
            loginText.style.display = 'flex';
            loginLoader.style.display = 'none';
            return;
        }
        
        const adminData = adminDoc.data();
        console.log('Admin verified:', adminData);
        
        showSuccess('✅ Admin login successful! Redirecting...');
        
        // Redirect to admin dashboard
        setTimeout(() => {
            window.location.href = 'admin-dashboard.html';
        }, 1500);
        
    } catch (error) {
        console.error('Admin login error:', error);
        
        let errorMessage = 'Login failed. Please try again.';
        
        // Handle specific error codes
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = '❌ Invalid email address format.';
                break;
            case 'auth/user-disabled':
                errorMessage = '❌ This admin account has been disabled.';
                break;
            case 'auth/user-not-found':
                errorMessage = '❌ No admin account found with this email.';
                break;
            case 'auth/wrong-password':
                errorMessage = '❌ Incorrect password. Please try again.';
                break;
            case 'auth/invalid-credential':
                errorMessage = '❌ Invalid credentials. Please check your email and password.';
                break;
            case 'auth/too-many-requests':
                errorMessage = '❌ Too many failed attempts. Please try again later.';
                break;
            default:
                errorMessage = `❌ Login error: ${error.message}`;
        }
        
        showError(errorMessage);
        
        // Re-enable button
        loginBtn.disabled = false;
        loginText.style.display = 'flex';
        loginLoader.style.display = 'none';
    }
});

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

// Show success message
function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
}

// Hide all messages
function hideMessages() {
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('successMessage').style.display = 'none';
}