import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserSettings = {
    enableMood: boolean;
    enableVault: boolean;
    enableTracking: boolean;
    notificationsEnabled: boolean;
    notificationAM: string;
    notificationPM: string;
};

export type UserProfile = {
    installDate: number; // timestamp
    totalMinutes: number;
    currentStreak: number;
    lastSessionDate: string | null; // YYYY-MM-DD
    dailySessions: {
        date: string | null; // YYYY-MM-DD
        am: boolean;
        pm: boolean;
    };
    settings: UserSettings;
    vaultNotes: string[];
};

export type MoodLog = {
    timestamp: number;
    preMood: number; // 0 - 10
    postMood: number; // 0 - 10
    note?: string; // Optional reflection note
};

const PROFILE_KEY = '@belu_profile';
const MOOD_LOGS_KEY = '@belu_mood_logs';

const DEFAULT_PROFILE: UserProfile = {
    installDate: Date.now(),
    totalMinutes: 0,
    currentStreak: 0,
    lastSessionDate: null,
    dailySessions: {
        date: null,
        am: false,
        pm: false,
    },
    settings: {
        enableMood: true,
        enableVault: true,
        enableTracking: true,
        notificationsEnabled: false,
        notificationAM: '08:00',
        notificationPM: '21:00',
    },
    vaultNotes: [],
};

// --- Profile ---

export async function getUserProfile(): Promise<UserProfile> {
    try {
        const jsonValue = await AsyncStorage.getItem(PROFILE_KEY);
        if (jsonValue != null) {
            const parsed = JSON.parse(jsonValue);
            // Merge with default settings to handle backward compatibility gracefully
            return {
                ...DEFAULT_PROFILE,
                ...parsed,
                settings: {
                    ...DEFAULT_PROFILE.settings,
                    ...(parsed.settings || {})
                },
                vaultNotes: parsed.vaultNotes || []
            };
        }
    } catch (e) {
        console.error('Error reading profile', e);
    }
    // Initialize if missing
    await saveUserProfile(DEFAULT_PROFILE);
    return DEFAULT_PROFILE;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
    try {
        const jsonValue = JSON.stringify(profile);
        await AsyncStorage.setItem(PROFILE_KEY, jsonValue);
    } catch (e) {
        console.error('Error saving profile', e);
    }
}

// --- Logic Helpers ---

// Get YYYY-MM-DD in local time
export function getLocalDateString(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Check if currently AM or PM
export function isAM(date: Date = new Date()): boolean {
    return date.getHours() < 12;
}

export async function logSession(minutesCount: number, customDate?: Date): Promise<UserProfile> {
    const profile = await getUserProfile();
    const now = customDate || new Date();
    const todayStr = getLocalDateString(now);
    const am = isAM(now);

    profile.totalMinutes += minutesCount;

    // Reset daily sessions if it's a new day
    if (profile.dailySessions.date !== todayStr) {
        profile.dailySessions = {
            date: todayStr,
            am: false,
            pm: false,
        };
    }

    // Mark AM or PM as done
    if (am) {
        profile.dailySessions.am = true;
    } else {
        profile.dailySessions.pm = true;
    }

    // Calculate Streak
    // Basic logic: if lastSessionDate is yesterday, streak++, if today, keep same, else reset to 1
    if (profile.lastSessionDate !== todayStr) {
        if (profile.lastSessionDate) {
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            const yesterdayStr = getLocalDateString(yesterday);

            if (profile.lastSessionDate === yesterdayStr) {
                profile.currentStreak += 1;
            } else {
                profile.currentStreak = 1; // broken streak
            }
        } else {
            profile.currentStreak = 1; // first session ever
        }
        profile.lastSessionDate = todayStr;
    }

    await saveUserProfile(profile);
    return profile;
}

// --- Mood Logs ---

export async function saveMoodLog(log: MoodLog): Promise<void> {
    try {
        const logs = await getMoodLogs();
        logs.push(log);
        await AsyncStorage.setItem(MOOD_LOGS_KEY, JSON.stringify(logs));

        // Save note to vault if present
        if (log.note && log.note.trim().length > 0) {
            const profile = await getUserProfile();
            profile.vaultNotes.push(log.note.trim());
            await saveUserProfile(profile);
        }
    } catch (e) {
        console.error('Error saving mood log', e);
    }
}

export async function getMoodLogs(): Promise<MoodLog[]> {
    try {
        const jsonValue = await AsyncStorage.getItem(MOOD_LOGS_KEY);
        return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
        console.error('Error reading mood logs', e);
        return [];
    }
}

// --- Data Export / Import ---

export async function exportDataJSON(): Promise<string> {
    try {
        const profile = await getUserProfile();
        const logs = await getMoodLogs();
        return JSON.stringify({ profile, logs }, null, 2);
    } catch (e) {
        console.error('Error exporting data', e);
        return '';
    }
}

export async function importDataJSON(jsonString: string): Promise<boolean> {
    try {
        const data = JSON.parse(jsonString);
        if (data.profile) {
            await saveUserProfile(data.profile);
        }
        if (data.logs && Array.isArray(data.logs)) {
            await AsyncStorage.setItem(MOOD_LOGS_KEY, JSON.stringify(data.logs));
        }
        return true;
    } catch (e) {
        console.error('Error importing data', e);
        return false;
    }
}
