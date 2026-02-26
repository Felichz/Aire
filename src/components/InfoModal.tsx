import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Easing, ScrollView } from 'react-native';
import { COLORS } from '../constants';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type InfoModalProps = {
    visible: boolean;
    onClose: () => void;
};

export function InfoModal({ visible, onClose }: InfoModalProps) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                Animated.timing(translateY, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 0, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
                Animated.timing(translateY, { toValue: 30, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
            ]).start();
        }
    }, [visible]);

    return (
        <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity }]} pointerEvents={visible ? 'auto' : 'none'}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />

            <Animated.View style={[styles.modalContent, { transform: [{ translateY }] }]}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close" size={28} color={COLORS.textSecondary} />
                </TouchableOpacity>

                <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    <View style={styles.header}>
                        <View style={styles.iconCircle}>
                            <MaterialCommunityIcons name="lightning-bolt" size={32} color={COLORS.accent3} />
                        </View>
                        <Text style={styles.title}>The 4-7-8 Concept</Text>
                        <Text style={styles.subtitle}>A natural tranquilizer for the nervous system.</Text>
                    </View>

                    <LinearGradient colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']} style={styles.card}>
                        <Text style={styles.cardTitle}>How it works</Text>
                        <Text style={styles.paragraph}>
                            Breathe in through your nose for <Text style={styles.highlight}>4 seconds</Text>, hold your breath for <Text style={styles.highlight}>7 seconds</Text>, and exhale completely through your mouth for <Text style={styles.highlight}>8 seconds</Text>.
                        </Text>
                        <Text style={styles.paragraph}>
                            This pattern acts as a natural tranquilizer for the nervous system, forcing the mind and body to focus on regulating the breath, rather than replaying your worries.
                        </Text>
                    </LinearGradient>

                    <LinearGradient colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']} style={styles.card}>
                        <Text style={styles.cardTitle}>Posture & Technique</Text>
                        <View style={styles.listItem}>
                            <Ionicons name="body-outline" size={20} color={COLORS.accent2} style={styles.listIcon} />
                            <Text style={styles.listText}>Always sit with your back straight.</Text>
                        </View>
                        <View style={styles.listItem}>
                            <Ionicons name="medical-outline" size={20} color={COLORS.accent2} style={styles.listIcon} />
                            <Text style={styles.listText}>Place the tip of your tongue against the ridge of tissue just behind your upper front teeth, and keep it there through the entire exercise.</Text>
                        </View>
                        <View style={styles.listItem}>
                            <MaterialCommunityIcons name="weather-windy" size={20} color={COLORS.accent2} style={styles.listIcon} />
                            <Text style={styles.listText}>You will be exhaling through your mouth around your tongue. Try pursing your lips slightly if this feels awkward.</Text>
                        </View>
                    </LinearGradient>

                    <LinearGradient colors={['rgba(240,110,126,0.1)', 'rgba(255,255,255,0.02)']} style={[styles.card, { borderColor: 'rgba(240,110,126,0.2)' }]}>
                        <Text style={[styles.cardTitle, { color: COLORS.danger }]}>Important Rules</Text>
                        <Text style={styles.paragraph}>
                            <Text style={styles.highlightDanger}>Never do more than 4 breath cycles at one time</Text> for the first month of practice. Your body needs time to adapt to this new pattern of respiration.
                        </Text>
                        <Text style={styles.paragraph}>
                            Later, if you wish, you can extend it to 8 breath cycles. Do not exceed 8 cycles. To see profound benefits, perform this practice at least twice a day.
                        </Text>
                    </LinearGradient>

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
        height: '85%',
        backgroundColor: 'rgba(12, 12, 28, 0.95)',
        borderTopLeftRadius: 44,
        borderTopRightRadius: 44,
        paddingTop: 30,
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
        paddingHorizontal: 25,
        paddingBottom: 60,
    },
    header: {
        alignItems: 'center',
        marginBottom: 35,
        marginTop: 10,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(92,196,200,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(92,196,200,0.3)',
    },
    title: {
        fontFamily: 'Outfit-Medium',
        fontSize: 28,
        color: COLORS.textPrimary,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontFamily: 'Outfit-Regular',
        fontSize: 16,
        color: COLORS.textSecondary,
        textAlign: 'center',
        paddingHorizontal: 20,
        lineHeight: 24,
    },
    card: {
        borderRadius: 24,
        padding: 24,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    cardTitle: {
        fontFamily: 'Outfit-Medium',
        fontSize: 18,
        color: COLORS.textPrimary,
        marginBottom: 12,
        letterSpacing: 0.5,
    },
    paragraph: {
        fontFamily: 'Outfit-Regular',
        fontSize: 15,
        color: COLORS.textSecondary,
        lineHeight: 24,
        marginBottom: 12,
    },
    highlight: {
        color: COLORS.textPrimary,
        fontFamily: 'Outfit-Medium',
    },
    highlightDanger: {
        color: COLORS.danger,
        fontFamily: 'Outfit-Medium',
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    listIcon: {
        marginTop: 2,
        marginRight: 12,
        opacity: 0.8,
    },
    listText: {
        flex: 1,
        fontFamily: 'Outfit-Regular',
        fontSize: 15,
        color: COLORS.textSecondary,
        lineHeight: 22,
    }
});
