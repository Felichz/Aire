import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Easing, Platform } from 'react-native';
import { COLORS } from '../constants';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

export type CustomTimePickerProps = {
    visible: boolean;
    title: string;
    initialTime: string; // "HH:MM"
    onConfirm: (time: string) => void;
    onClose: () => void;
};

export function CustomTimePickerModal({ visible, title, initialTime, onConfirm, onClose }: CustomTimePickerProps) {
    const opacity = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0.9)).current;

    const [hour, setHour] = useState(8);
    const [minute, setMinute] = useState(0);

    useEffect(() => {
        if (visible) {
            const [h, m] = (initialTime || '08:00').split(':');
            setHour(parseInt(h, 10));
            setMinute(parseInt(m, 10));

            Animated.parallel([
                Animated.timing(opacity, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                Animated.spring(scale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
                Animated.timing(scale, { toValue: 0.9, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
            ]).start();
        }
    }, [visible, initialTime]);

    const handleConfirm = () => {
        const hh = hour.toString().padStart(2, '0');
        const mm = minute.toString().padStart(2, '0');
        onConfirm(`${hh}:${mm}`);
    };

    const changeHour = (delta: number) => {
        if (Platform.OS !== 'web') Haptics.selectionAsync();
        setHour((prev) => {
            let next = prev + delta;
            if (next > 23) next = 0;
            if (next < 0) next = 23;
            return next;
        });
    };

    const changeMinute = (delta: number) => {
        if (Platform.OS !== 'web') Haptics.selectionAsync();
        setMinute((prev) => {
            // Standardizing to 5 minute jumps to make button tapping reasonable
            let next = prev + delta * 5;
            if (next > 59) next = 0;
            if (next < 0) next = 55;
            return next;
        });
    };

    return (
        <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity }]} pointerEvents={visible ? 'auto' : 'none'}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8, 8, 26, 0.9)' }]} />

            <Animated.View style={[styles.modalContent, { transform: [{ scale }] }]}>
                <LinearGradient
                    colors={['rgba(30, 30, 50, 0.9)', 'rgba(20, 20, 40, 0.95)']}
                    style={[StyleSheet.absoluteFill, { borderRadius: 32 }]}
                />

                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>

                <View style={styles.iconContainer}>
                    <View style={styles.iconGlow} />
                    <Ionicons name="time-outline" size={32} color={COLORS.playBtn} />
                </View>

                <Text style={styles.title}>{title}</Text>

                <View style={styles.pickerContainer}>
                    {/* Hours */}
                    <View style={styles.column}>
                        <TouchableOpacity style={styles.controlBtn} onPress={() => changeHour(1)} activeOpacity={0.6}>
                            <Ionicons name="chevron-up" size={28} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                        <Text style={styles.timeValue}>{hour.toString().padStart(2, '0')}</Text>
                        <TouchableOpacity style={styles.controlBtn} onPress={() => changeHour(-1)} activeOpacity={0.6}>
                            <Ionicons name="chevron-down" size={28} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.colon}>:</Text>

                    {/* Minutes */}
                    <View style={styles.column}>
                        <TouchableOpacity style={styles.controlBtn} onPress={() => changeMinute(1)} activeOpacity={0.6}>
                            <Ionicons name="chevron-up" size={28} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                        <Text style={styles.timeValue}>{minute.toString().padStart(2, '0')}</Text>
                        <TouchableOpacity style={styles.controlBtn} onPress={() => changeMinute(-1)} activeOpacity={0.6}>
                            <Ionicons name="chevron-down" size={28} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity style={styles.button} onPress={handleConfirm} activeOpacity={0.7}>
                    <Text style={styles.buttonText}>Set Time</Text>
                </TouchableOpacity>
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
    },
    modalContent: {
        width: '85%',
        backgroundColor: '#121220',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderRadius: 32,
        padding: 30,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.6,
        shadowRadius: 40,
    },
    closeButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        padding: 5,
        zIndex: 10,
    },
    iconContainer: {
        marginBottom: 16,
        alignItems: 'center',
        justifyContent: 'center',
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(139,124,248,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(139,124,248,0.2)',
    },
    iconGlow: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: COLORS.playBtn,
        borderRadius: 28,
        opacity: 0.2,
        shadowColor: COLORS.playBtn,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 20,
    },
    title: {
        fontFamily: 'Outfit-Medium',
        fontSize: 20,
        color: COLORS.textPrimary,
        marginBottom: 30,
        textAlign: 'center',
    },
    pickerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 35,
    },
    column: {
        alignItems: 'center',
        width: 80,
    },
    controlBtn: {
        width: 50,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    timeValue: {
        fontFamily: 'Outfit-Medium',
        fontSize: 54,
        color: COLORS.textPrimary,
        fontVariant: ['tabular-nums'],
        marginVertical: 15,
    },
    colon: {
        fontFamily: 'Outfit-Medium',
        fontSize: 40,
        color: COLORS.textSecondary,
        marginHorizontal: 10,
        marginBottom: 5,
    },
    button: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 20,
        backgroundColor: COLORS.playBtn,
        alignItems: 'center',
        shadowColor: COLORS.playBtn,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    buttonText: {
        fontFamily: 'Outfit-Medium',
        fontSize: 16,
        color: '#fff',
        letterSpacing: 1,
    }
});
