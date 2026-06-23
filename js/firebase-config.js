import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBRG01zghVILK6QhJFeuOBzMRYWJMhTTOI",
  authDomain: "ems-stock-e5ad3.firebaseapp.com",
  projectId: "ems-stock-e5ad3",
  storageBucket: "ems-stock-e5ad3.firebasestorage.app",
  messagingSenderId: "206816226113",
  appId: "1:206816226113:web:74f1dde1fb631d3dd24fc0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };
