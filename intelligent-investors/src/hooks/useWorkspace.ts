import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp, addDoc, collection, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, TradingMode, Strategy } from '../lib/types';
import { useAuth } from './useAuth';
import { buildBlankStrategyPreset } from '../lib/strategies';

import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export function useWorkspace() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setStrategies([]);
      setLoading(false);
      return;
    }

    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setProfile(snapshot.data() as UserProfile);
      } else {
        setProfile(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    const q = query(collection(db, 'strategies'), where('userId', '==', user.uid));
    const unsubStrategies = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Strategy));
      setStrategies(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'strategies');
    });

    return () => {
      unsubProfile();
      unsubStrategies();
    };
  }, [user]);

  const updateMode = async (mode: TradingMode) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), {
      mode,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  };

  const updateLearnMode = async (learnMode: boolean) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), {
      learnMode,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  };

  const initializeProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const initialMode: TradingMode = 'swing';
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      mode: initialMode,
      learnMode: true,
      equity: 100000,
      riskPerTrade: 0.01,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...data,
    });

    // Seed default strategy
    const strategyPreset = buildBlankStrategyPreset(initialMode);
    await addDoc(collection(db, 'strategies'), {
      ...strategyPreset,
      userId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  return { profile, strategies, loading, updateMode, updateLearnMode, initializeProfile };
}
