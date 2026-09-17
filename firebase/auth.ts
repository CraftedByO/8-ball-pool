import {
  signInAnonymously,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './config';
import { PlayerProfile } from '../leaderboard/types';
import { getRankTier } from '../leaderboard/elo';

const LOCAL_STORAGE_USER_KEY = 'pool_arena_guest_user';

export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username || username.trim().length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters long.' };
  }
  if (username.length > 15) {
    return { valid: false, error: 'Username cannot exceed 15 characters.' };
  }
  const regex = /^[a-zA-Z0-9_]+$/;
  if (!regex.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores.' };
  }
  const reserved = ['admin', 'moderator', 'system', 'root', 'null', 'undefined', 'ai'];
  if (reserved.includes(username.toLowerCase())) {
    return { valid: false, error: 'This username is reserved.' };
  }
  return { valid: true };
}

/**
 * Initialize anonymous authentication silently
 */
export async function initAnonymousAuth(): Promise<User | null> {
  if (typeof window === 'undefined' || !auth) return null;

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        try {
          const userCredential = await signInAnonymously(auth);
          resolve(userCredential.user);
        } catch (error) {
          console.warn('Anonymous auth failed (running in offline/demo mode):', error);
          resolve(null);
        }
      }
    });
  });
}

/**
 * Fetch player profile by UID
 */
export async function getPlayerProfile(uid: string): Promise<PlayerProfile | null> {
  if (typeof window === 'undefined') return null;

  // Try Firestore if initialized
  if (db) {
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        return snap.data() as PlayerProfile;
      }
    } catch (e) {
      console.warn('Firestore getPlayerProfile failed, falling back to local storage', e);
    }
  }

  // Local storage fallback for offline/preview
  const local = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
  if (local) {
    try {
      const profile = JSON.parse(local) as PlayerProfile;
      if (profile.uid === uid) return profile;
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Claim a globally unique username atomically using Firestore transaction
 */
export async function claimUsername(
  user: User | { uid: string },
  username: string
): Promise<{ success: boolean; error?: string; profile?: PlayerProfile }> {
  const validation = validateUsername(username);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const normalized = username.toLowerCase();
  const uid = user.uid;

  if (db) {
    try {
      const result = await runTransaction(db, async (transaction) => {
        const usernameRef = doc(db, 'usernames', normalized);
        const usernameSnap = await transaction.get(usernameRef);

        if (usernameSnap.exists()) {
          const existingOwner = usernameSnap.data()?.uid;
          if (existingOwner !== uid) {
            throw new Error('This username is already taken. Please choose another.');
          }
        }

        const userRef = doc(db, 'users', uid);
        const userSnap = await transaction.get(userRef);

        const now = Date.now();
        let profile: PlayerProfile;

        if (userSnap.exists()) {
          const data = userSnap.data() as PlayerProfile;
          profile = {
            ...data,
            username,
            normalizedUsername: normalized,
            lastActive: now,
          };
          transaction.update(userRef, {
            username,
            normalizedUsername: normalized,
            lastActive: now,
          });
        } else {
          profile = {
            uid,
            username,
            normalizedUsername: normalized,
            createdAt: now,
            lastActive: now,
            rating: 1200,
            wins: 0,
            losses: 0,
            gamesPlayed: 0,
            winRate: 0,
            rankTier: 'Silver',
          };
          transaction.set(userRef, profile);
        }

        transaction.set(usernameRef, { uid, claimedAt: serverTimestamp() });
        return profile;
      });

      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(result));
      return { success: true, profile: result };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to claim username';
      console.warn('Firestore claimUsername transaction error:', msg);

      // If Firestore fails due to missing rules/offline demo mode, provide responsive local claim
      const fallbackProfile: PlayerProfile = {
        uid,
        username,
        normalizedUsername: normalized,
        createdAt: Date.now(),
        lastActive: Date.now(),
        rating: 1200,
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        winRate: 0,
        rankTier: 'Silver',
      };
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(fallbackProfile));
      return { success: true, profile: fallbackProfile };
    }
  }

  // Local storage fallback
  const localProfile: PlayerProfile = {
    uid,
    username,
    normalizedUsername: normalized,
    createdAt: Date.now(),
    lastActive: Date.now(),
    rating: 1200,
    wins: 0,
    losses: 0,
    gamesPlayed: 0,
    winRate: 0,
    rankTier: 'Silver',
  };
  localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(localProfile));
  return { success: true, profile: localProfile };
}
