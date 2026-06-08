const firebaseConfig = {
  apiKey:            "AIzaSyAolbqrYrIbBlILY7qMX_qJl4pBWkFTAkE",
  authDomain:        "advanced-diary-acb96.firebaseapp.com",
  projectId:         "advanced-diary-acb96",
  storageBucket:     "advanced-diary-acb96.firebasestorage.app",
  messagingSenderId: "937846296241",
  appId:             "1:937846296241:web:21718af4773a9194749c90"
};

firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const auth = firebase.auth();
