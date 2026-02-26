import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Easing, ScrollView, Platform } from 'react-native';
import { UserProfile, MoodLog, getMoodLogs } from '../storage';
import { COLORS } from '../constants';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;

type StatsModalProps = {
    visible: boolean;
    profile: UserProfile | null;
    onClose: () => void;
};

export function StatsModal({ visible, profile, onClose }: StatsModalProps) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(50)).current;
    const [greeting, setGreeting] = useState('');
    const [latestMood, setLatestMood] = useState<MoodLog | null>(null);
    const [moodData, setMoodData] = useState<number[]>([]);
    const [preMoodData, setPreMoodData] = useState<number[]>([]);
    const [moodLabels, setMoodLabels] = useState<string[]>([]);

    useEffect(() => {
        if (visible) {
            getMoodLogs().then(logs => {
                if (logs.length > 0) {
                    setLatestMood(logs[logs.length - 1]);

                    // Take last 7 sessions
                    const recentLogs = logs.slice(-7);
                    setMoodData(recentLogs.map(l => l.postMood));
                    setPreMoodData(recentLogs.map(l => l.preMood));
                    setMoodLabels(recentLogs.map(l => {
                        const d = new Date(l.timestamp);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                    }));
                }
            });

            // Set greeting based on time of day
            const hour = new Date().getHours();
            if (hour < 12) setGreeting('Good Morning');
            else if (hour < 18) setGreeting('Good Afternoon');
            else setGreeting('Good Evening');
        }
    }, [visible]);

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                Animated.timing(translateY, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 0, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
                Animated.timing(translateY, { toValue: 50, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
            ]).start();
        }
    }, [visible]);

    const statsOpacity = opacity.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });

    // Derive some data
    const totalMinutes = profile?.totalMinutes || 0;
    const streak = profile?.currentStreak || 0;

    // Level logic placeholder
    const levelIndex = Math.min(Math.floor(totalMinutes / 60), 4);
    const levels = ['Novice', 'Beginner', 'Practitioner', 'Advanced', 'Master'];
    const displayLevel = levels[levelIndex];

    return (
        <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity }]} pointerEvents={visible ? 'auto' : 'none'}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />

            <Animated.View style={[styles.modalContent, { transform: [{ translateY }] }]}>

                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close" size={28} color={COLORS.textSecondary} />
                </TouchableOpacity>

                <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.header}>
                        <Text style={styles.greeting}>{greeting},</Text>
                        <View style={styles.titleRow}>
                            <Text style={styles.title}>Your Journey</Text>
                            <View style={styles.levelBadge}>
                                <Text style={styles.levelText}>{displayLevel}</Text>
                            </View>
                        </View>
                    </View>

                    {/* --- stats row --- */}
                    <View style={styles.statsGrid}>
                        {/* Streak Card */}
                        <View style={styles.statCardWrapper}>
                            <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.01)']} style={styles.statCard}>
                                <View style={[styles.iconBox, { backgroundColor: 'rgba(232,160,101,0.15)' }]}>
                                    <Ionicons name="flame" size={24} color={COLORS.accent2} />
                                </View>
                                <Text style={styles.statValue}>{streak}</Text>
                                <Text style={styles.statLabel}>Day Streak</Text>
                            </LinearGradient>
                        </View>

                        {/* Minutes Card */}
                        <View style={styles.statCardWrapper}>
                            <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.01)']} style={styles.statCard}>
                                <View style={[styles.iconBox, { backgroundColor: 'rgba(92,196,200,0.15)' }]}>
                                    <Ionicons name="time" size={24} color={COLORS.accent3} />
                                </View>
                                <Text style={styles.statValue}>{totalMinutes}</Text>
                                <Text style={styles.statLabel}>Min Breathed</Text>
                            </LinearGradient>
                        </View>
                    </View>

                    {/* --- daily goal --- */}
                    <LinearGradient colors={['rgba(139,124,248,0.1)', 'rgba(255,255,255,0.02)']} style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>Daily Goal</Text>
                        <View style={styles.dailyRow}>
                            <View style={[styles.dailyPill, profile?.dailySessions?.am && styles.dailyPillActive]}>
                                <Ionicons name="partly-sunny" size={16} color={profile?.dailySessions?.am ? COLORS.playBtn : COLORS.textMuted} />
                                <Text style={[styles.dailyLabel, profile?.dailySessions?.am && { color: COLORS.textPrimary }]}>Morning</Text>
                            </View>
                            <View style={[styles.dailyPill, profile?.dailySessions?.pm && styles.dailyPillActive]}>
                                <Ionicons name="moon" size={16} color={profile?.dailySessions?.pm ? COLORS.playBtn : COLORS.textMuted} />
                                <Text style={[styles.dailyLabel, profile?.dailySessions?.pm && { color: COLORS.textPrimary }]}>Evening</Text>
                            </View>
                        </View>
                    </LinearGradient>

                    {/* --- mood shift chart --- */}
                    {moodData.length > 0 && (
                        <LinearGradient colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']} style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>Mood Tracking</Text>
                            <Text style={styles.chartSubtitle}>Pre vs post-session mood over your last {moodData.length} session{moodData.length > 1 ? 's' : ''}</Text>
                            <View style={{ overflow: 'hidden', borderRadius: 16 }}>
                                <LineChart
                                    data={{
                                        labels: moodLabels,
                                        datasets: [{
                                            data: moodData,
                                            color: (opacity = 1) => `rgba(92, 196, 200, ${opacity})`,
                                            strokeWidth: 2,
                                        }, {
                                            data: preMoodData.length > 0 ? preMoodData : [5],
                                            color: (opacity = 1) => `rgba(139, 124, 248, ${opacity * 0.7})`,
                                            strokeWidth: 2,
                                        }, {
                                            data: [0], // Min bound
                                            withDots: false,
                                        }, {
                                            data: [10], // Max bound
                                            withDots: false,
                                        }]
                                    }}
                                    width={screenWidth - 100}
                                    height={220}
                                    yAxisLabel=""
                                    yAxisSuffix=""
                                    yAxisInterval={1}
                                    chartConfig={{
                                        backgroundColor: 'rgba(12, 12, 28, 1)',
                                        backgroundGradientFrom: 'rgba(20, 20, 40, 1)',
                                        backgroundGradientTo: 'rgba(12, 12, 28, 1)',
                                        decimalPlaces: 0,
                                        color: (opacity = 1) => `rgba(92, 196, 200, ${opacity})`,
                                        labelColor: (opacity = 1) => `rgba(238, 238, 245, ${opacity * 0.5})`,
                                        style: { borderRadius: 16 },
                                        propsForDots: {
                                            r: "5",
                                            strokeWidth: "2",
                                            stroke: COLORS.accent3,
                                            fill: 'rgba(12, 12, 28, 1)',
                                        },
                                        propsForBackgroundLines: {
                                            stroke: 'rgba(255,255,255,0.06)',
                                            strokeDasharray: '4 4',
                                        },
                                        fillShadowGradientFrom: COLORS.accent3,
                                        fillShadowGradientFromOpacity: 0.08,
                                        fillShadowGradientTo: 'rgba(12, 12, 28, 0)',
                                        fillShadowGradientToOpacity: 0,
                                    }}
                                    bezier
                                    style={{ marginVertical: 8, borderRadius: 16, marginLeft: -15 }}
                                    fromZero={true}
                                    segments={5}
                                />
                            </View>
                            {/* Legend */}
                            <View style={styles.legendRow}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: COLORS.accent3 }]} />
                                    <Text style={styles.legendText}>After session</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: COLORS.playBtn }]} />
                                    <Text style={styles.legendText}>Before session</Text>
                                </View>
                                <Text style={styles.legendScale}>0 stressed — 10 relaxed</Text>
                            </View>
                        </LinearGradient>
                    )}
                </ScrollView>
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        justifyContent: 'flex-end',
        alignItems: 'center',
        zIndex: 1000,
    },
    modalContent: {
        width: '100%',
        height: '82%',
        backgroundColor: 'rgba(12, 12, 28, 0.95)',
        borderTopLeftRadius: 44,
        borderTopRightRadius: 44,
        paddingTop: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -20 },
        shadowOpacity: 0.8,
        shadowRadius: 40,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderBottomWidth: 0,
    },
    closeButton: {
        alignSelf: 'flex-end',
        padding: 5,
        marginBottom: 10,
        marginRight: 20,
    },
    scrollContainer: {
        flex: 1,
        width: '100%',
    },
    scrollContent: {
        paddingHorizontal: 30,
        paddingBottom: 50,
    },
    header: {
        marginBottom: 25,
    },
    greeting: {
        fontFamily: 'Outfit-Regular',
        fontSize: 18,
        color: COLORS.textSecondary,
        marginBottom: 4,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        fontFamily: 'Outfit-Medium',
        fontSize: 32,
        color: COLORS.textPrimary,
        letterSpacing: 0.5,
    },
    levelBadge: {
        backgroundColor: 'rgba(139,124,248,0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(139,124,248,0.3)',
    },
    levelText: {
        fontFamily: 'Outfit-Medium',
        color: COLORS.playBtn,
        fontSize: 11,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    statCardWrapper: {
        width: '47%',
    },
    statCard: {
        borderRadius: 24,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    statValue: {
        fontFamily: 'Outfit-Regular',
        fontSize: 36,
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    statLabel: {
        fontFamily: 'Outfit-Medium',
        fontSize: 13,
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sectionCard: {
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    sectionTitle: {
        fontFamily: 'Outfit-Medium',
        fontSize: 16,
        color: COLORS.textPrimary,
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    chartSubtitle: {
        fontFamily: 'Outfit-Regular',
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 14,
        lineHeight: 18,
    },
    dailyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dailyPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        width: '48%',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    dailyPillActive: {
        backgroundColor: 'rgba(139,124,248,0.15)',
        borderColor: 'rgba(139,124,248,0.3)',
    },
    dailyLabel: {
        fontFamily: 'Outfit-Medium',
        fontSize: 14,
        color: COLORS.textSecondary,
        marginLeft: 8,
    },
    moodShiftRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
    },
    moodShiftItem: {
        alignItems: 'center',
    },
    moodEmoji: {
        fontSize: 40,
        marginBottom: 6,
    },
    moodShiftLabel: {
        fontFamily: 'Outfit-Medium',
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    infoText: {
        fontFamily: 'Outfit-Regular',
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 22,
        marginBottom: 10,
    },
    legendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: 12,
        gap: 14,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    legendText: {
        fontFamily: 'Outfit-Regular',
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    legendScale: {
        fontFamily: 'Outfit-Regular',
        fontSize: 11,
        color: COLORS.textMuted,
        marginLeft: 'auto',
    },
});
