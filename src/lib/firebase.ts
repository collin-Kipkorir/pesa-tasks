import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAfaWAIbZA4q8MoW4M9gcK2jYsaEaDfpNU",
  authDomain: "surveys-2791f.firebaseapp.com",
  databaseURL: "https://surveys-2791f-default-rtdb.firebaseio.com",
  projectId: "surveys-2791f",
  storageBucket: "surveys-2791f.firebasestorage.app",
  messagingSenderId: "167700941145",
  appId: "1:167700941145:web:7c5e02b68d440a705b2448",
  measurementId: "G-KN6FD1NB8L",
};

export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getDatabase(firebaseApp);

export const ADMIN_PHONE = "0723914386";
export const WELCOME_BONUS = 1000;
// NOTE: Test amount. Change back to 100 / 200 for production.
export const ACTIVATION_FEE = 1;
export const VIP_FEE = 1;
export const DAILY_FREE_LIMIT = 3;
export const DAILY_VIP_LIMIT = 10;
