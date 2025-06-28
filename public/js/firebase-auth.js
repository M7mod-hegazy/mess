// Firebase Authentication Utilities

// Initialize Firebase Auth
const auth = firebase.auth();

// Function to sign out from Firebase and clear session
function signOutFromFirebase() {
  return auth.signOut()
    .then(() => {
      console.log('Firebase sign-out successful');
      
      // Clear server session
      return fetch('/auth/logout-firebase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Redirect to login page
        window.location.href = '/auth/login';
      } else {
        console.error('Server logout failed:', data.message);
        // Still redirect to login page even if server logout failed
        window.location.href = '/auth/login';
      }
    })
    .catch(error => {
      console.error('Logout error:', error);
      // Redirect to login page even if there's an error
      window.location.href = '/auth/login';
    });
}

// Function to check if user is authenticated
function isUserAuthenticated() {
  return new Promise((resolve) => {
    auth.onAuthStateChanged((user) => {
      resolve(!!user);
    });
  });
}

// Function to get current user
function getCurrentUser() {
  return auth.currentUser;
}

// Export functions for use in other files
window.firebaseAuth = {
  signOut: signOutFromFirebase,
  isAuthenticated: isUserAuthenticated,
  getCurrentUser: getCurrentUser
}; 