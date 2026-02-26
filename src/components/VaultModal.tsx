import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Easing, ScrollView, TextInput, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { COLORS } from '../constants';
import { UserProfile, saveUserProfile } from '../storage';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type VaultModalProps = {
    visible: boolean;
    profile: UserProfile | null;
    onProfileChange: (p: UserProfile) => void;
    onClose: () => void;
};

export function VaultModal({ visible, profile, onProfileChange, onClose }: VaultModalProps) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(30)).current;
    const [note, setNote] = useState('');

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

    const notes = profile?.vaultNotes || [];

    const handleSaveNote = async () => {
        if (!note.trim() || !profile) return;
        const newNotes = [...notes, note.trim()];
        const updatedProfile = { ...profile, vaultNotes: newNotes };
        await saveUserProfile(updatedProfile);
        onProfileChange(updatedProfile);
        setNote('');
        Keyboard.dismiss();
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[StyleSheet.absoluteFill, { zIndex: 1000 }]} pointerEvents={visible ? 'auto' : 'none'}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity }]}>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
                <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />

                <Animated.View style={[styles.modalContent, { transform: [{ translateY }] }]}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color={COLORS.textSecondary} />
                    </TouchableOpacity>

                    <View style={styles.header}>
                        <Text style={styles.title}>Your Vault</Text>
                        <Text style={styles.subtitle}>Notes from your past self</Text>
                    </View>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Write a note to your future self..."
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            value={note}
                            onChangeText={setNote}
                            multiline
                            maxLength={200}
                        />
                        <TouchableOpacity style={[styles.addButton, !note.trim() && { opacity: 0.5 }]} disabled={!note.trim()} onPress={handleSaveNote}>
                            <Ionicons name="add" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {notes.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="book-outline" size={48} color="rgba(255,255,255,0.1)" />
                            <Text style={styles.placeholderText}>Your vault is empty. You can write notes to yourself at the end of each session.</Text>
                        </View>
                    ) : (
                        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                            {notes.slice().reverse().map((note, idx) => (
                                <LinearGradient
                                    key={idx}
                                    colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']}
                                    style={styles.noteCard}
                                >
                                    <Ionicons name="sparkles" size={16} color={COLORS.playBtn} style={{ marginBottom: 8 }} />
                                    <Text style={styles.noteText}>{note}</Text>
                                </LinearGradient>
                            ))}
                        </ScrollView>
                    )}
                </Animated.View>
            </Animated.View>
        </KeyboardAvoidingView>
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
    header: {
        alignItems: 'center',
        marginBottom: 25,
    },
    title: {
        fontFamily: 'Outfit-Medium',
        fontSize: 32,
        color: COLORS.textPrimary,
        marginBottom: 6,
    },
    subtitle: {
        fontFamily: 'Outfit-Regular',
        fontSize: 15,
        color: COLORS.textSecondary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingBottom: 60,
    },
    placeholderText: {
        fontFamily: 'Outfit-Regular',
        color: COLORS.textSecondary,
        fontSize: 16,
        textAlign: 'center',
        marginTop: 16,
        lineHeight: 24,
    },
    scrollContainer: {
        flex: 1,
        width: '100%',
    },
    scrollContent: {
        paddingHorizontal: 25,
        paddingBottom: 60,
    },
    inputContainer: {
        flexDirection: 'row',
        paddingHorizontal: 25,
        marginBottom: 20,
        alignItems: 'center',
    },
    textInput: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        color: COLORS.textPrimary,
        fontFamily: 'Outfit-Regular',
        fontSize: 15,
        minHeight: 50,
        maxHeight: 120,
        textAlignVertical: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginRight: 10,
    },
    addButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: COLORS.playBtn,
        alignItems: 'center',
        justifyContent: 'center',
    },
    noteCard: {
        borderRadius: 24,
        padding: 24,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    noteText: {
        fontFamily: 'Outfit-Regular',
        fontSize: 16,
        color: COLORS.textPrimary,
        lineHeight: 24,
    }
});
