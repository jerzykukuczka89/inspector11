// Firebase SDK 모듈 임포트
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase 프로젝트 설정값 (본인의 Firebase 콘솔에서 복사하여 붙여넣기)
const firebaseConfig = {
  apiKey: "AIzaSyDLVylw28AaVU5v51opJuY2eg2Ze5Ri3iE",
  authDomain: "inspecter11.firebaseapp.com",
  projectId: "inspecter11",
  storageBucket: "inspecter11.firebasestorage.app",
  messagingSenderId: "861002754347",
  appId: "1:861002754347:web:d48b5186a629b07ace7d6e"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// 인증 객체 (이메일/비밀번호 + 구글 로그인)
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Firestore 데이터베이스 객체
const db = getFirestore(app);

export { auth, googleProvider, db };
