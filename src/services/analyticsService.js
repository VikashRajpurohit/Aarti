// Analytics Service - Firebase Firestore Integration
// Tracks daily app opens, challan count, and QR scan count
import { db } from '../config/firebaseConfig';
import { doc, updateDoc, increment, setDoc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';

const ANALYTICS_COLLECTION = 'analytics';
const GLOBAL_STATS_DOC = 'global_stats';
const DAILY_STATS_PREFIX = 'daily_';

/**
 * Get today's date string in YYYY-MM-DD format
 */
const getTodayDateString = () => {
  return format(new Date(), 'yyyy-MM-dd');
};

/**
 * Get the daily stats document ID for today
 */
const getDailyDocId = () => {
  return `${DAILY_STATS_PREFIX}${getTodayDateString()}`;
};

/**
 * Initialize global analytics document if it doesn't exist
 */
const initializeGlobalAnalytics = async () => {
  try {
    const docRef = doc(db, ANALYTICS_COLLECTION, GLOBAL_STATS_DOC);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      await setDoc(docRef, {
        totalChallanCount: 0,
        totalQrScanCount: 0,
        totalAppOpens: 0,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Analytics initialization error:', error);
  }
};

/**
 * Initialize or get daily stats document
 */
const initializeDailyStats = async () => {
  try {
    const dailyDocId = getDailyDocId();
    const docRef = doc(db, ANALYTICS_COLLECTION, dailyDocId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      await setDoc(docRef, {
        date: getTodayDateString(),
        appOpens: 0,
        challansCreated: 0,
        qrScans: 0,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });
    }
    return docRef;
  } catch (error) {
    console.error('Daily stats initialization error:', error);
    return null;
  }
};

/**
 * Track app open - called when app starts
 */
export const trackAppOpen = async () => {
  try {
    // Update global stats
    const globalRef = doc(db, ANALYTICS_COLLECTION, GLOBAL_STATS_DOC);
    try {
      await updateDoc(globalRef, {
        totalAppOpens: increment(1),
        lastUpdated: new Date().toISOString(),
      });
    } catch {
      await initializeGlobalAnalytics();
      await updateDoc(globalRef, {
        totalAppOpens: increment(1),
        lastUpdated: new Date().toISOString(),
      });
    }

    // Update daily stats
    const dailyDocId = getDailyDocId();
    const dailyRef = doc(db, ANALYTICS_COLLECTION, dailyDocId);
    try {
      await updateDoc(dailyRef, {
        appOpens: increment(1),
        lastUpdated: new Date().toISOString(),
      });
    } catch {
      await initializeDailyStats();
      await updateDoc(dailyRef, {
        appOpens: increment(1),
        lastUpdated: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error tracking app open:', error);
  }
};

/**
 * Increment challan count - called when a new challan is created
 */
export const incrementChallanCount = async () => {
  try {
    // Update global stats
    const globalRef = doc(db, ANALYTICS_COLLECTION, GLOBAL_STATS_DOC);
    try {
      await updateDoc(globalRef, {
        totalChallanCount: increment(1),
        lastUpdated: new Date().toISOString(),
      });
    } catch {
      await initializeGlobalAnalytics();
      await updateDoc(globalRef, {
        totalChallanCount: increment(1),
        lastUpdated: new Date().toISOString(),
      });
    }

    // Update daily stats
    const dailyDocId = getDailyDocId();
    const dailyRef = doc(db, ANALYTICS_COLLECTION, dailyDocId);
    try {
      await updateDoc(dailyRef, {
        challansCreated: increment(1),
        lastUpdated: new Date().toISOString(),
      });
    } catch {
      await initializeDailyStats();
      await updateDoc(dailyRef, {
        challansCreated: increment(1),
        lastUpdated: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error incrementing challan count:', error);
  }
};

/**
 * Increment QR scan count - called when a QR code is successfully scanned
 */
export const incrementQRScanCount = async () => {
  try {
    // Update global stats
    const globalRef = doc(db, ANALYTICS_COLLECTION, GLOBAL_STATS_DOC);
    try {
      await updateDoc(globalRef, {
        totalQrScanCount: increment(1),
        lastUpdated: new Date().toISOString(),
      });
    } catch {
      await initializeGlobalAnalytics();
      await updateDoc(globalRef, {
        totalQrScanCount: increment(1),
        lastUpdated: new Date().toISOString(),
      });
    }

    // Update daily stats
    const dailyDocId = getDailyDocId();
    const dailyRef = doc(db, ANALYTICS_COLLECTION, dailyDocId);
    try {
      await updateDoc(dailyRef, {
        qrScans: increment(1),
        lastUpdated: new Date().toISOString(),
      });
    } catch {
      await initializeDailyStats();
      await updateDoc(dailyRef, {
        qrScans: increment(1),
        lastUpdated: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error incrementing QR scan count:', error);
  }
};

/**
 * Get global analytics stats
 */
export const getGlobalStats = async () => {
  try {
    const docRef = doc(db, ANALYTICS_COLLECTION, GLOBAL_STATS_DOC);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      await initializeGlobalAnalytics();
      return {
        totalChallanCount: 0,
        totalQrScanCount: 0,
        totalAppOpens: 0,
      };
    }
  } catch (error) {
    console.error('Error getting global stats:', error);
    return null;
  }
};

/**
 * Get daily stats for a specific date
 * @param {string} dateString - Date in YYYY-MM-DD format (defaults to today)
 */
export const getDailyStats = async (dateString = null) => {
  try {
    const date = dateString || getTodayDateString();
    const dailyDocId = `${DAILY_STATS_PREFIX}${date}`;
    const docRef = doc(db, ANALYTICS_COLLECTION, dailyDocId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      return {
        date,
        appOpens: 0,
        challansCreated: 0,
        qrScans: 0,
      };
    }
  } catch (error) {
    console.error('Error getting daily stats:', error);
    return null;
  }
};

// Initialize analytics on service load
initializeGlobalAnalytics();
