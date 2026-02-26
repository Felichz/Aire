import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Easing } from 'react-native';
import { COLORS } from '../constants';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export type CustomAlertProps = {
    visible: boolean;
    title: string;
    message: string;
    icon?: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
    onClose: () => void;
};

export function CustomAlertModal({ visible, title, message, icon = 'information-circle', iconColor = COLORS.playBtn, onClose }: CustomAlertProps) {
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

                <View style={[styles.iconContainer, { borderColor: iconColor, backgroundColor: iconColor + '15' }]}>
                    <View style={[styles.iconGlow, { backgroundColor: iconColor, shadowColor: iconColor }]} />
                    <Ionicons name={icon} size={36} color={iconColor} />
                </View>

                <Text style={styles.title}>{title}</Text>
                <Text style={styles.message}>{message}</Text>

                <TouchableOpacity style={[styles.button, { borderColor: iconColor + '66', backgroundColor: iconColor + '33' }]} onPress={onClose} activeOpacity={0.7}>
                    <Text style={[styles.buttonText, { color: iconColor }]}>Got it</Text>
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
    iconContainer: {
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'center',
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 1,
    },
    iconGlow: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 32,
        opacity: 0.2,
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
        borderWidth: 1,
        alignItems: 'center',
    },
    buttonText: {
        fontFamily: 'Outfit-Medium',
        fontSize: 16,
        letterSpacing: 1,
    }
});
