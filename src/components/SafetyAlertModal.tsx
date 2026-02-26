import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Easing } from 'react-native';
import { COLORS } from '../constants';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type SafetyAlertModalProps = {
    visible: boolean;
    message: string;
    onClose: () => void;
};

export function SafetyAlertModal({ visible, message, onClose }: SafetyAlertModalProps) {
    const opacity = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0.9)).current;

    useEffect(() => {
        if (visible) {
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
    }, [visible]);

    return (
        <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity }]} pointerEvents={visible ? 'auto' : 'none'}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8, 8, 26, 0.9)' }]} />

            <Animated.View style={[styles.modalContent, { transform: [{ scale }] }]}>
                <LinearGradient
                    colors={['rgba(30, 30, 50, 0.9)', 'rgba(20, 20, 40, 0.95)']}
                    style={[StyleSheet.absoluteFill, { borderRadius: 32 }]}
                />

                <View style={styles.iconContainer}>
                    <View style={styles.iconGlow} />
                    <Ionicons name="shield-checkmark" size={36} color={COLORS.accent3} />
                </View>

                <Text style={styles.title}>Safety First</Text>
                <Text style={styles.message}>{message}</Text>

                <TouchableOpacity style={styles.button} onPress={onClose} activeOpacity={0.7}>
                    <Text style={styles.buttonText}>Got it</Text>
                </TouchableOpacity>
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
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
    iconContainer: {
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'center',
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(92,196,200,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(92,196,200,0.3)',
    },
    iconGlow: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: COLORS.accent3,
        borderRadius: 32,
        opacity: 0.2,
        shadowColor: COLORS.accent3,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 20,
    },
    title: {
        fontFamily: 'Outfit-Medium',
        fontSize: 24,
        color: COLORS.textPrimary,
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontFamily: 'Outfit-Regular',
        fontSize: 15,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 30,
        minHeight: 60,
    },
    button: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 20,
        backgroundColor: 'rgba(139,124,248,0.2)',
        borderWidth: 1,
        borderColor: 'rgba(139,124,248,0.4)',
        alignItems: 'center',
    },
    buttonText: {
        fontFamily: 'Outfit-Medium',
        fontSize: 16,
        color: COLORS.playBtn,
        letterSpacing: 1,
    }
});
