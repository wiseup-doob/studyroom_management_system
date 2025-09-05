import { User as FirebaseUser } from 'firebase/auth';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

// Firebase 사용자 타입 확장
export interface FirebaseUserExtended extends FirebaseUser {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  uid: string;
}

// Firestore 문서 타입
export interface FirestoreDocument {
  id: string;
  data: DocumentData;
}

// Firestore 쿼리 스냅샷 타입
export type FirestoreQuerySnapshot = QueryDocumentSnapshot<DocumentData>[];

// Firestore 컬렉션 참조 타입
export interface CollectionReference {
  id: string;
  path: string;
}

// Firestore 문서 참조 타입
export interface DocumentReference {
  id: string;
  path: string;
}
