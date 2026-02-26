import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Easing, ScrollView, Switch, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { COLORS } from '../constants';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile, saveUserProfile, exportDataJSON, importDataJSON } from '../storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { CustomAlertModal } from './CustomAlertModal';
import { CustomTimePickerModal } from './CustomTimePickerModal';

type SettingsModalProps = {
    visible: boolean;
    profile: UserProfile | null;
    onProfileChange: (p: UserProfile) => void;
    onClose: () => void;
};

export function SettingsModal({ visible, profile, onProfileChange, onClose }: SettingsModalProps) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(30)).current;

    const [settings, setSettings] = useState(profile?.settings || {
        enableMood: true,
        enableVault: true,
        enableTracking: true,
        notificationsEnabled: false,
        notificationAM: '08:00',
        notificationPM: '21:00',
    });

    // Custom Alert State
    const [alertConfig, setAlertConfig] = useState<{ visible: boolean; title: string; message: string; icon?: any; color?: string; action?: () => void }>({
        visible: false,
        title: '',
        message: ''
    });

    const showAlert = (title: string, message: string, icon?: any, color?: string, action?: () => void) => {
        setAlertConfig({ visible: true, title, message, icon, color, action });
    };

    const hideAlert = () => {
        const action = alertConfig.action;
        setAlertConfig(prev => ({ ...prev, visible: false }));
        if (action) action();
    };

    const [showPicker, setShowPicker] = useState<'am' | 'pm' | null>(null);

    const handleTimeConfirm = (timeStr: string) => {
        if (showPicker) {
            const key = showPicker === 'am' ? 'notificationAM' : 'notificationPM';
            setSettings({ ...settings, [key]: timeStr });
            updateSetting(key, timeStr);
        }
        setShowPicker(null);
    };

    useEffect(() => {
        if (visible && profile) {
            setSettings(profile.settings);
            Animated.parallel([
                Animated.timing(opacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                Animated.timing(translateY, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]).start();
        } else if (!visible) {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 0, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
                Animated.timing(translateY, { toValue: 30, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
            ]).start();
        }
    }, [visible, profile]);

    const updateSetting = async (key: keyof typeof settings, value: any) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        if (profile) {
            const updatedProfile = { ...profile, settings: newSettings };
            await saveUserProfile(updatedProfile);
            onProfileChange(updatedProfile);
        }
    };

    const applyPreset = async (preset: 'complete' | 'minimal') => {
        const newSettings = {
            ...settings,
            enableMood: preset === 'complete',
            enableVault: preset === 'complete',
            enableTracking: preset === 'complete'
        };
        setSettings(newSettings);
        if (profile) {
            const updatedProfile = { ...profile, settings: newSettings };
            await saveUserProfile(updatedProfile);
            onProfileChange(updatedProfile);
        }
    };

    const handleExport = async () => {
        try {
            const data = await exportDataJSON();
            const fileUri = FileSystem.documentDirectory + `belu_export_${Date.now()}.json`;
            await FileSystem.writeAsStringAsync(fileUri, data, { encoding: FileSystem.EncodingType.UTF8 });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'application/json',
                    dialogTitle: 'Export Belu Data',
                    UTI: 'public.json'
                });
            } else {
                showAlert("Error", "Sharing is not available on this device.", "warning", COLORS.accent3);
            }
        } catch (e) {
            console.error(e);
            showAlert("Error", "Could not export data.", "close-circle", COLORS.accent3);
        }
    };

    const handleImport = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/json', 'text/plain', '*/*'],
                copyToCacheDirectory: true
            });

            if (result.canceled || !result.assets || result.assets.length === 0) return;

            const fileUri = result.assets[0].uri;
            const fileContent = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });

            const success = await importDataJSON(fileContent);
            if (success) {
                showAlert("Success", "Data imported successfully. Please restart the app for full effect.", "checkmark-circle", COLORS.playBtn, onClose);
            } else {
                showAlert("Error", "Invalid JSON format or corrupted file.", "warning", COLORS.accent3);
            }
        } catch (e) {
            console.error(e);
            showAlert("Error", "Could not read file.", "close-circle", COLORS.accent3);
        }
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

                    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.header}>
                            <Text style={styles.title}>Settings</Text>
                            <Text style={styles.subtitle}>Customize your coaching experience</Text>
                        </View>

                        {/* Presets */}
                        <View style={styles.presetsRow}>
                            <TouchableOpacity style={[styles.presetBtn, settings.enableMood && settings.enableVault && settings.enableTracking && styles.presetBtnActive]} onPress={() => applyPreset('complete')}>
                                <Ionicons name="star" size={18} color={settings.enableMood && settings.enableVault && settings.enableTracking ? COLORS.playBtn : COLORS.textMuted} />
                                <Text style={[styles.presetText, settings.enableMood && settings.enableVault && settings.enableTracking && styles.presetTextActive]}>Complete</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.presetBtn, !settings.enableMood && !settings.enableVault && !settings.enableTracking && styles.presetBtnActive]} onPress={() => applyPreset('minimal')}>
                                <Ionicons name="leaf" size={18} color={!settings.enableMood && !settings.enableVault && !settings.enableTracking ? COLORS.playBtn : COLORS.textMuted} />
                                <Text style={[styles.presetText, !settings.enableMood && !settings.enableVault && !settings.enableTracking && styles.presetTextActive]}>Minimalist</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.helperText}>• Complete: Full journaling, tracking, and charts.</Text>
                        <Text style={styles.helperText}>• Minimalist: Pure breathing tool. No logs, just you and your breath.</Text>

                        <View style={styles.divider} />

                        {/* Toggles */}
                        <Text style={styles.sectionTitle}>Features</Text>

                        <View style={styles.settingRow}>
                            <View style={styles.settingTextCol}>
                                <Text style={styles.settingLabel}>Mood Tracking</Text>
                                <Text style={styles.settingDesc}>Ask for mood before and after sessions.</Text>
                            </View>
                            <Switch
                                value={settings.enableMood}
                                onValueChange={(val) => updateSetting('enableMood', val)}
                                trackColor={{ false: 'rgba(255,255,255,0.1)', true: COLORS.playBtn }}
                            />
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingTextCol}>
                                <Text style={styles.settingLabel}>Notes Vault</Text>
                                <Text style={styles.settingDesc}>Enable optional journaling and random vault notes.</Text>
                            </View>
                            <Switch
                                value={settings.enableVault}
                                onValueChange={(val) => updateSetting('enableVault', val)}
                                trackColor={{ false: 'rgba(255,255,255,0.1)', true: COLORS.playBtn }}
                            />
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingTextCol}>
                                <Text style={styles.settingLabel}>Stats Tracking</Text>
                                <Text style={styles.settingDesc}>Track your days, minutes and milestones.</Text>
                            </View>
                            <Switch
                                value={settings.enableTracking}
                                onValueChange={(val) => updateSetting('enableTracking', val)}
                                trackColor={{ false: 'rgba(255,255,255,0.1)', true: COLORS.playBtn }}
                            />
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingTextCol}>
                                <Text style={styles.settingLabel}>Notifications</Text>
                                <Text style={styles.settingDesc}>Enable daily reminders for your practice.</Text>
                            </View>
                            <Switch
                                value={settings.notificationsEnabled}
                                onValueChange={(val) => updateSetting('notificationsEnabled', val)}
                                trackColor={{ false: 'rgba(255,255,255,0.1)', true: COLORS.playBtn }}
                            />
                        </View>

                        {settings.notificationsEnabled && (
                            <View style={styles.timePickerContainer}>
                                <View style={styles.timePickerRow}>
                                    <Text style={styles.timeLabel}>Morning</Text>
                                    <TouchableOpacity style={styles.timeInputBtn} onPress={() => setShowPicker('am')}>
                                        <Text style={styles.timeInputBtnText}>{settings.notificationAM}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.timePickerRow}>
                                    <Text style={styles.timeLabel}>Evening</Text>
                                    <TouchableOpacity style={styles.timeInputBtn} onPress={() => setShowPicker('pm')}>
                                        <Text style={styles.timeInputBtnText}>{settings.notificationPM}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        <View style={styles.divider} />

                        {/* Data Management */}
                        <Text style={styles.sectionTitle}>Your Data</Text>
                        <Text style={styles.helperText}>All your data is stored locally on this device. You own it completely.</Text>

                        <TouchableOpacity style={styles.actionButton} onPress={handleExport}>
                            <Ionicons name="download-outline" size={20} color={COLORS.textPrimary} style={{ marginRight: 8 }} />
                            <Text style={styles.actionButtonText}>Export Data to Device</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.actionButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]} onPress={handleImport}>
                            <Ionicons name="push-outline" size={20} color={COLORS.textPrimary} style={{ marginRight: 8 }} />
                            <Text style={styles.actionButtonText}>Import Data from Device</Text>
                        </TouchableOpacity>

                    </ScrollView>
                </Animated.View>

                <CustomTimePickerModal
                    visible={showPicker !== null}
                    title={showPicker === 'am' ? 'Morning Reminder' : 'Evening Reminder'}
                    initialTime={showPicker === 'am' ? settings.notificationAM : settings.notificationPM}
                    onConfirm={handleTimeConfirm}
                    onClose={() => setShowPicker(null)}
                />

                <CustomAlertModal
                    visible={alertConfig.visible}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    icon={alertConfig.icon}
                    iconColor={alertConfig.color}
                    onClose={hideAlert}
                />
            </Animated.View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    overlay: {
        justifyContent: 'flex-end',
        alignItems: 'center',
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
        marginBottom: 0,
        marginRight: 20,
        zIndex: 10,
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
    presetsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    presetBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        paddingVertical: 14,
        borderRadius: 16,
        marginHorizontal: 5,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    presetBtnActive: {
        backgroundColor: 'rgba(139,124,248,0.1)',
        borderColor: 'rgba(139,124,248,0.3)',
    },
    presetText: {
        fontFamily: 'Outfit-Medium',
        color: COLORS.textMuted,
        marginLeft: 8,
    },
    presetTextActive: {
        color: COLORS.textPrimary,
    },
    helperText: {
        fontFamily: 'Outfit-Regular',
        fontSize: 13,
        color: COLORS.textSecondary,
        marginBottom: 6,
        lineHeight: 20,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginVertical: 24,
    },
    sectionTitle: {
        fontFamily: 'Outfit-Medium',
        fontSize: 18,
        color: COLORS.textPrimary,
        marginBottom: 16,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    settingTextCol: {
        flex: 1,
        paddingRight: 15,
    },
    settingLabel: {
        fontFamily: 'Outfit-Medium',
        fontSize: 16,
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    settingDesc: {
        fontFamily: 'Outfit-Regular',
        fontSize: 13,
        color: COLORS.textSecondary,
        lineHeight: 18,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingVertical: 14,
        borderRadius: 16,
        marginBottom: 12,
        marginTop: 10,
    },
    actionButtonText: {
        fontFamily: 'Outfit-Medium',
        fontSize: 15,
        color: COLORS.textPrimary,
    },
    timePickerContainer: {
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },
    timePickerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 6,
    },
    timeLabel: {
        fontFamily: 'Outfit-Regular',
        color: COLORS.textSecondary,
        fontSize: 15,
    },
    timeInputBtn: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        minWidth: 80,
        alignItems: 'center',
    },
    timeInputBtnText: {
        color: COLORS.textPrimary,
        fontFamily: 'Outfit-Medium',
        fontSize: 16,
    }
});
