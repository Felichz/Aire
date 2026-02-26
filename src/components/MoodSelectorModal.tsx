import React, { useEffect, useRef, useState, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Easing, TextInput, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { COLORS } from '../constants';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { CustomAlertModal } from './CustomAlertModal';

type MoodSelectorModalProps = {
    visible: boolean;
    title: string;
    quote?: string | null;
    showNoteInput?: boolean;
    onSelectMood: (moodIndex: number, note: string) => void;
    onClose: () => void;
};

export function MoodSelectorModal({ visible, title, quote, showNoteInput = true, onSelectMood, onClose }: MoodSelectorModalProps) {
    const opacity = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0.9)).current;
    const [sliderValue, setSliderValue] = useState(5);
    const [note, setNote] = useState('');
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        if (visible) {
            setSliderValue(5);
            setNote('');
            Animated.parallel([
                Animated.timing(opacity, { toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                Animated.spring(scale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
                Animated.timing(scale, { toValue: 0.9, duration: 200, easing: Easing.in(Easing.ease), useNativeDriver: true }),
            ]).start();
            Keyboard.dismiss();
        }
    }, [visible]);

    const handleConfirm = () => {
        Keyboard.dismiss();
        onSelectMood(sliderValue, note);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}
            pointerEvents={visible ? 'auto' : 'none'}
        >
            <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity }]}>
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

                <Animated.View style={[styles.modalContent, { transform: [{ scale }] }]}>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                    </TouchableOpacity>

                    <Text style={styles.title}>{title}</Text>

                    {quote ? (
                        <View style={styles.quoteBlock}>
                            <Text style={styles.quoteLabel}>Note from your past self</Text>
                            <View style={styles.quoteBody}>
                                <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.playBtn} style={{ marginRight: 10, marginTop: 2 }} />
                                <Text style={styles.quoteText}>"{quote}"</Text>
                            </View>
                        </View>
                    ) : null}

                    <View style={styles.sliderContainer}>
                        <Text style={styles.sliderLabel}>Stressed</Text>
                        {useMemo(() => (
                            <Slider
                                key={visible ? 'visible' : 'hidden'}
                                style={{ flex: 1, height: 40, marginHorizontal: 10 }}
                                minimumValue={0}
                                maximumValue={10}
                                step={1}
                                value={5}
                                onValueChange={setSliderValue}
                                minimumTrackTintColor={COLORS.playBtn}
                                maximumTrackTintColor="rgba(255,255,255,0.1)"
                                thumbTintColor="#FFFFFF"
                            />
                        ), [visible])}
                        <Text style={styles.sliderLabel}>Relaxed</Text>
                    </View>
                    <Text style={styles.currentValue}>{sliderValue} / 10</Text>

                    {showNoteInput && (
                        <View style={styles.noteContainer}>
                            <View style={styles.noteLabelRow}>
                                <Text style={styles.noteLabel}>Note to Self (Optional)</Text>
                                <TouchableOpacity style={styles.infoBtn} onPress={() => setShowInfo(true)}>
                                    <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
                                </TouchableOpacity>
                            </View>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Write an encouraging message for your future self..."
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                value={note}
                                onChangeText={setNote}
                                multiline
                                maxLength={200}
                            />
                        </View>
                    )}

                    <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                        <Text style={styles.confirmButtonText}>Confirm</Text>
                    </TouchableOpacity>
                </Animated.View>

                <CustomAlertModal
                    visible={showInfo}
                    title="Vault Notes"
                    message="Messages written here are saved to your Vault. They will be shown to you randomly after future sessions to provide encouragement from your past self!"
                    icon="bookmarks-outline"
                    iconColor={COLORS.playBtn}
                    onClose={() => setShowInfo(false)}
                />
            </Animated.View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    overlay: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '90%',
        backgroundColor: 'rgba(20, 20, 40, 0.95)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderRadius: 40,
        padding: 30,
        paddingTop: 45,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.4,
        shadowRadius: 30,
    },
    closeButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        padding: 5,
        zIndex: 10,
    },
    title: {
        fontFamily: 'Outfit-Medium',
        fontSize: 22,
        color: COLORS.textPrimary,
        marginBottom: 20,
        textAlign: 'center',
    },
    sliderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginBottom: 10,
    },
    sliderLabel: {
        fontFamily: 'Outfit-Regular',
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    currentValue: {
        fontFamily: 'Outfit-Medium',
        fontSize: 24,
        color: COLORS.playBtn,
        marginBottom: 25,
    },
    quoteBlock: {
        width: '100%',
        marginBottom: 20,
        paddingHorizontal: 4,
    },
    quoteLabel: {
        fontFamily: 'Outfit-Regular',
        fontSize: 11,
        color: COLORS.textMuted,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    quoteBody: {
        flexDirection: 'row',
        backgroundColor: 'rgba(139,124,248,0.06)',
        borderLeftWidth: 3,
        borderLeftColor: COLORS.playBtn,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    quoteText: {
        fontFamily: 'Outfit-Regular',
        fontSize: 15,
        color: 'rgba(238,238,245,0.85)',
        fontStyle: 'italic',
        flex: 1,
        lineHeight: 22,
    },
    noteContainer: {
        width: '100%',
        marginBottom: 30,
    },
    noteLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    noteLabel: {
        fontFamily: 'Outfit-Medium',
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    infoBtn: {
        marginLeft: 6,
        padding: 4,
    },
    textInput: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        color: COLORS.textPrimary,
        fontFamily: 'Outfit-Regular',
        fontSize: 15,
        minHeight: 100,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    confirmButton: {
        backgroundColor: COLORS.playBtn,
        paddingVertical: 16,
        paddingHorizontal: 40,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
    },
    confirmButtonText: {
        fontFamily: 'Outfit-Medium',
        fontSize: 16,
        color: '#FFFFFF',
    }
});
