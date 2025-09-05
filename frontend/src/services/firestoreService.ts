import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  DocumentData,
  DocumentReference,
  CollectionReference
} from 'firebase/firestore';
import { db } from './firebase';
import { ApiResponse } from '../types';

interface FirestoreService {
  getCollection: (collectionName: string) => Promise<ApiResponse<DocumentData[]>>;
  getDocument: (collectionName: string, docId: string) => Promise<ApiResponse<DocumentData>>;
  addDocument: (collectionName: string, data: DocumentData) => Promise<ApiResponse<{ id: string }>>;
  updateDocument: (collectionName: string, docId: string, data: Partial<DocumentData>) => Promise<ApiResponse<void>>;
  deleteDocument: (collectionName: string, docId: string) => Promise<ApiResponse<void>>;
}

export const firestoreService: FirestoreService = {
  // 컬렉션에서 모든 문서 가져오기
  getCollection: async (collectionName: string): Promise<ApiResponse<DocumentData[]>> => {
    try {
      const querySnapshot = await getDocs(collection(db, collectionName));
      const documents: DocumentData[] = [];
      querySnapshot.forEach((doc) => {
        documents.push({ id: doc.id, ...doc.data() });
      });
      return { success: true, data: documents };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // 특정 문서 가져오기
  getDocument: async (collectionName: string, docId: string): Promise<ApiResponse<DocumentData>> => {
    try {
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { success: true, data: { id: docSnap.id, ...docSnap.data() } };
      } else {
        return { success: false, error: 'Document not found' };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // 새 문서 추가
  addDocument: async (collectionName: string, data: DocumentData): Promise<ApiResponse<{ id: string }>> => {
    try {
      const docRef = await addDoc(collection(db, collectionName), data);
      return { success: true, data: { id: docRef.id } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // 문서 업데이트
  updateDocument: async (collectionName: string, docId: string, data: Partial<DocumentData>): Promise<ApiResponse<void>> => {
    try {
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, data);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // 문서 삭제
  deleteDocument: async (collectionName: string, docId: string): Promise<ApiResponse<void>> => {
    try {
      const docRef = doc(db, collectionName, docId);
      await deleteDoc(docRef);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
};
