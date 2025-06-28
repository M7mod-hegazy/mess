// Firebase configuration for mess-3be39 project
if (!window.firebaseConfigInitialized) {
  if (typeof firebase !== 'undefined' && firebase.apps && !firebase.apps.length) {
    firebase.initializeApp({
      apiKey: "AIzaSyCo6jAIN8MfquUj04N-nVvdLgSupyRgAEw",
      authDomain: "mess-3be39.firebaseapp.com",
      projectId: "mess-3be39",
      storageBucket: "mess-3be39.appspot.com",
      messagingSenderId: "136477211945",
      appId: "1:136477211945:web:b410f9d464c4189143cb38",
      measurementId: "G-GFH4QVPFMY"
    });
  }
  window.firebaseConfigInitialized = true;
}

// Initialize Firebase
if (firebase.analytics) {
  firebase.analytics();
}

// Export for use in other files
window.firebaseConfig = {
  apiKey: "AIzaSyCo6jAIN8MfquUj04N-nVvdLgSupyRgAEw",
  authDomain: "mess-3be39.firebaseapp.com",
  projectId: "mess-3be39",
  storageBucket: "mess-3be39.appspot.com",
  messagingSenderId: "136477211945",
  appId: "1:136477211945:web:b410f9d464c4189143cb38",
  measurementId: "G-GFH4QVPFMY"
}; 