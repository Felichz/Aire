import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  TextInput,
  Platform,
  Easing,
  useWindowDimensions,
  AppState,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  cancelAnimation,
  useDerivedValue,
  Easing as ReanimatedEasing,
  useAnimatedStyle,
  interpolateColor
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import {
  Canvas,
  Fill,
  BackdropFilter,
  Blur,
  Skia,
  Group,
  Circle,
  Shader,
  Rect,
  RoundedRect,
} from '@shopify/react-native-skia';

import { COLORS, PHASES, HEALTH_TIPS } from './src/constants';
import { UserProfile, getUserProfile, logSession, saveMoodLog } from './src/storage';
import { MoodSelectorModal } from './src/components/MoodSelectorModal';
import { SafetyAlertModal } from './src/components/SafetyAlertModal';
import { StatsModal } from './src/components/StatsModal';
import { InfoModal } from './src/components/InfoModal';
import { VaultModal } from './src/components/VaultModal';
import { SettingsModal } from './src/components/SettingsModal';
import { CustomAlertModal } from './src/components/CustomAlertModal';

const LENS_REFRACTION_GLSL = `
  uniform shader s_backdrop;
  uniform float2 iResolution;
  uniform float2 lensPos;
  uniform float active;
  uniform float strength;

  half4 main(vec2 fragCoord) {
    vec2 center = lensPos + 125.0;
    vec2 dir = fragCoord - center;
    float dist = length(dir);
    float radius = 125.0;

    // Obtener color base del fondo original
    half4 baseColor = s_backdrop.eval(fragCoord);

    // Si está fuera del radio, devolver fondo normal
    if (dist > radius) {
      return baseColor;
    }

    // Efecto de lente con caída suave en los bordes para look "líquido"
    float normalizedDist = dist / radius;
    float edgeSoftness = smoothstep(0.85, 1.0, normalizedDist);
    
    // Potencia de refracción
    float power = strength * active * 48.0;
    vec2 offset = normalize(dir) * power * (1.0 - normalizedDist);
    
    // Evaluar fondo con desplazamiento
    half4 shiftedColor = s_backdrop.eval(fragCoord + offset * (1.0 - edgeSoftness));
    
    // Mezclar con el borde para suavidad extrema
    half4 finalColor = mix(shiftedColor, baseColor, edgeSoftness);
    
    // Brillos de cristal premium
    float highlight = (1.0 - normalizedDist) * 0.04 * active;
    finalColor.rgb += highlight;
    
    return finalColor;
  }
`;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// ─── Color palette ───────────────────────────────────────────
// COLORS and PHASES are now imported from src/constants.ts

const MODES = [
  { id: 'ocean', video: require('./assets/sea.mp4'), audio: require('./assets/waves.mp3'), icon: 'sunny-outline' },
  { id: 'rain', video: require('./assets/rain_video.mp4'), audio: require('./assets/rain_audio.mp3'), icon: 'rainy-outline' }
];

// ─── Skia Particle System ───────────────────────────────────
// ─── Individual Particle Component ──────────────────────────
const ParticleItem = React.memo(({
  p,
  anim,
  isRunning,
  progress,
  focalPoint,
  color
}: {
  p: any,
  anim: Reanimated.SharedValue<number>,
  isRunning: boolean,
  progress: Reanimated.SharedValue<number>,
  focalPoint: Reanimated.SharedValue<{ x: number; y: number }>,
  color: Reanimated.SharedValue<string>
}) => {
  const cx = useDerivedValue(() => {
    const orbit = Math.sin(anim.value * Math.PI * 2 * p.speed + p.phase) * 35;
    const factor = isRunning ? progress.value : 0;
    const currentR = (p.outerR * (1.0 - factor)) + (p.innerR * factor);
    return focalPoint.value.x + Math.cos(p.angle) * currentR + orbit;
  });

  const cy = useDerivedValue(() => {
    const orbit = Math.cos(anim.value * Math.PI * 2 * p.speed + p.phase) * 35;
    const factor = isRunning ? progress.value : 0;
    const currentR = (p.outerR * (1.0 - factor)) + (p.innerR * factor);
    return focalPoint.value.y + Math.sin(p.angle) * currentR + orbit;
  });

  return (
    <Circle
      cx={cx}
      cy={cy}
      r={p.r}
      color={color}
      opacity={p.opacity}
    />
  );
});

function SkiaParticles({
  width,
  height,
  color,
  isRunning,
  activePhase,
  progress,
  focalPoint
}: {
  width: number;
  height: number;
  color: any;
  isRunning: boolean;
  activePhase: number;
  progress: any;
  focalPoint: Reanimated.SharedValue<{ x: number; y: number }>;
}) {
  const anim = useSharedValue(0);

  useEffect(() => {
    // Aumentamos la duración y el tope al que llega la animación a 100, 
    // y hacemos que coincida con las velocidades para borrar el temblor de 25 segundos.
    anim.value = withRepeat(
      withTiming(100, { duration: 25000 * 100, easing: ReanimatedEasing.linear }),
      -1,
      false
    );
  }, []);

  // Usamos un radio generoso que no cambie frecuentemente para evitar reseteos por layout
  const stableMaxRadius = useMemo(() => {
    // Redondeamos a rangos de 100px para ignorar micropulsaciones de resize por estado o reproductor web
    const w = Math.round(width / 100) * 100;
    const h = Math.round(height / 100) * 100;
    return Math.sqrt(w * w + h * h) * 0.9;
  }, [Math.round(width / 100), Math.round(height / 100)]); // Se recalcula si cambia drásticamente la orientación

  const particles = useMemo(() => {
    return Array.from({ length: 160 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const outerR = Math.sqrt(Math.random()) * stableMaxRadius;
      const innerR = Math.sqrt(Math.random()) * 90;

      return {
        angle,
        outerR,
        innerR,
        r: Math.random() * 2.8 + 1.2,
        opacity: Math.random() * 0.5 + 0.3,
        phase: Math.random() * Math.PI * 2,
        // Redondeamos la velocidad para que encaje como un múltiplo exacto de 100.
        // Así logramos un bucle matemático sin teletransportaciones.
        speed: Math.round((Math.random() * 0.35 + 0.6) * 100) / 100,
      };
    });
  }, [stableMaxRadius]);

  return (
    <Group>
      {particles.map((p, i) => (
        <ParticleItem
          key={i}
          p={p}
          anim={anim}
          isRunning={isRunning}
          progress={progress}
          focalPoint={focalPoint}
          color={color}
        />
      ))}
    </Group>
  );
}

// ─── Skia Field Glow ────────────────────────────────────────
function SkiaFieldGlow({ color, focalPoint, scale }: { color: any, focalPoint: Reanimated.SharedValue<{ x: number; y: number }>, scale: Reanimated.SharedValue<number> }) {
  const cx = useDerivedValue(() => focalPoint.value.x);
  const cy = useDerivedValue(() => focalPoint.value.y);
  const r = useDerivedValue(() => 300 * scale.value);

  return (
    <Circle
      cx={cx}
      cy={cy}
      r={r}
      color={color}
      opacity={0.14}
    >
      <Blur blur={80} />
    </Circle>
  );
}

// ─── Refraction Overlay ─────────────────────────────────────
function RefractionOverlay({
  skEffect,
  focalPoint,
  isRunning,
  width,
  height
}: {
  skEffect: any,
  focalPoint: Reanimated.SharedValue<{ x: number; y: number }>,
  isRunning: boolean,
  width: number,
  height: number
}) {
  const lensSize = 250;
  const clipRect = useDerivedValue(() => {
    return {
      x: focalPoint.value.x - lensSize / 2,
      y: focalPoint.value.y - lensSize / 2,
      width: lensSize,
      height: lensSize
    };
  });

  const uniforms = useDerivedValue(() => {
    return {
      iResolution: [width, height],
      lensPos: [focalPoint.value.x - lensSize / 2, focalPoint.value.y - lensSize / 2],
      strength: isRunning ? 0.85 : 0.4,
      active: isRunning ? 1.0 : 0.5,
    };
  });

  return (
    <Group clip={clipRect}>
      <BackdropFilter
        filter={
          <Shader
            source={skEffect}
            uniforms={uniforms}
          />
        }
      >
        <Blur blur={6} />
      </BackdropFilter>
    </Group>
  );
}

// ─── Glass wrapper for cards ────────────────────────────────
function GlassCard({ children, isActive, accent, showGlow = true, isVideoOn = true }: { children: React.ReactNode; isActive: boolean; accent: string; showGlow?: boolean; isVideoOn?: boolean }) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  return (
    <View
      onLayout={(e) => setLayout(e.nativeEvent.layout)}
      style={[
        styles.glassCardBase,
        {
          backgroundColor: isVideoOn
            ? (isActive ? COLORS.cardActive : COLORS.card)
            : (isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.035)'),
          borderColor: isActive ? `${accent}40` : 'rgba(255,255,255,0.06)',
          borderWidth: 1,
        },
        isActive && Platform.OS === 'ios' && {
          shadowColor: accent,
          shadowOpacity: 0.25,
          shadowRadius: 25,
          shadowOffset: { width: 0, height: 12 },
        }
      ]}
    >
      {/* Simulation of the inner illumination / top light */}
      <View style={[StyleSheet.absoluteFill, { borderRadius: 24, overflow: 'hidden' }]}>
        <LinearGradient
          colors={isActive ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.0)'] : ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.0)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.8 }}
          pointerEvents="none"
        />
      </View>
      {/* Skia Glow for Android & consistent look */}
      {showGlow && isActive && layout.width > 0 && Platform.OS !== 'web' && (
        <SkiaErrorBoundary>
          <Canvas
            style={{
              position: 'absolute',
              left: -80,
              top: -80,
              width: layout.width + 160,
              height: layout.height + 160,
            }}
            pointerEvents="none"
          >
            <Group
              clip={(() => {
                const p = Skia.Path.Make();
                // Lienzo completo
                p.addRect(Skia.XYWHRect(0, 0, layout.width + 160, layout.height + 160));
                // Hueco para la tarjeta (1px extra hacia adentro para antialiasing)
                p.addRRect(Skia.RRectXY(Skia.XYWHRect(79, 79, layout.width + 2, layout.height + 2), 25, 25));
                p.setFillType(1); // EvenOdd hole
                return p;
              })()}
            >
              <RoundedRect
                x={80}
                y={80}
                width={layout.width}
                height={layout.height}
                r={24}
                color={accent}
                opacity={0.4}
              >
                <Blur blur={35} />
              </RoundedRect>
            </Group>
          </Canvas>
        </SkiaErrorBoundary>
      )
      }

      {/* Web Fallback Glow */}
      {
        Platform.OS === 'web' && isActive && (
          <View
            style={{
              position: 'absolute',
              top: -30,
              left: -30,
              right: -30,
              bottom: -30,
              borderRadius: 54,
              boxShadow: `0 0 50px 10px ${accent}25`,
              zIndex: -1,
              pointerEvents: 'none',
            }}
          />
        )
      }

      {/* Children content */}
      <View style={{ width: '100%', alignItems: 'center' }}>
        {children}
      </View>
    </View >
  );
}

// ─── Sparkle effect around circle ────────────────────────────
// ─── Sparkle effect around circle ────────────────────────────
function SparkleItem({
  angle,
  delay,
  color,
  isActive,
  radius
}: {
  angle: number;
  delay: number;
  color: any;
  isActive: boolean;
  radius: number;
}) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    if (isActive) {
      opacity.value = 0;
      scale.value = 0.5;

      opacity.value = withDelay(delay, withRepeat(
        withSequence(
          withTiming(0.6, { duration: 600, easing: ReanimatedEasing.out(ReanimatedEasing.quad) }),
          withTiming(0, { duration: 800 })
        ),
        -1,
        false
      ));

      scale.value = withDelay(delay, withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: ReanimatedEasing.out(ReanimatedEasing.quad) }),
          withTiming(0.3, { duration: 800 })
        ),
        -1,
        false
      ));
    } else {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      opacity.value = withTiming(0, { duration: 300 });
      scale.value = withTiming(0.5, { duration: 300 });
    }
  }, [isActive]);

  const style = useAnimatedStyle(() => ({
    backgroundColor: typeof color === 'string' ? color : color.value,
    opacity: opacity.value,
    transform: [
      { translateX: Math.cos(angle) * radius },
      { translateY: Math.sin(angle) * radius },
      { scale: scale.value }
    ]
  }));

  return (
    <Reanimated.View
      style={[
        {
          position: 'absolute',
          width: 4,
          height: 4,
          borderRadius: 2,
        },
        style
      ]}
    />
  );
}

function SparkleRing({ color, isActive, radius }: { color: any; isActive: boolean; radius: number }) {
  const sparkles = Array.from({ length: 6 }, (_, i) => ({
    angle: (i / 6) * Math.PI * 2,
    delay: i * 400,
  }));

  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
      {sparkles.map((s, i) => (
        <SparkleItem
          key={i}
          angle={s.angle}
          delay={s.delay}
          color={color}
          isActive={isActive}
          radius={radius}
        />
      ))}
    </View>
  );
}

// ─── Orbital Ring ────────────────────────────────────────────
function OrbitalRing({ width }: { width: number }) {
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 30000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: width,
        height: width,
        borderRadius: width / 2,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        borderStyle: 'dashed',
        transform: [{ rotate: spin }],
      }}
      pointerEvents="none"
    />
  );
}

// ─── Animated count helper ───────────────────────────────────
// ─── Animated count helper ───────────────────────────────────
function AnimatedNumber({ value, color, style }: { value: number; color: any; style: any }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const progress = useSharedValue(1); // 1 = showing displayValue, 0 = transition start

  useEffect(() => {
    if (value !== displayValue) {
      setPrevValue(displayValue);
      setDisplayValue(value);
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: 250, // Faster transition
        easing: ReanimatedEasing.out(ReanimatedEasing.quad)
      });
    }
  }, [value, displayValue]);

  const oldStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: -25 * progress.value }], // Slide up and fade out
    color: typeof color === 'string' ? color : color.value,
  }));

  const newStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: 25 * (1 - progress.value) }], // Slide up and fade in
    color: typeof color === 'string' ? color : color.value,
  }));

  return (
    <View style={{ height: 50, justifyContent: 'center', alignItems: 'center' }}>
      <Reanimated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, oldStyle]}>
        <Text style={style}>{prevValue}</Text>
      </Reanimated.View>
      <Reanimated.View style={[{ alignItems: 'center', justifyContent: 'center' }, newStyle]}>
        <Text style={style}>{displayValue}</Text>
      </Reanimated.View>
    </View>
  );
}

// ─── Phase card ──────────────────────────────────────────────
function PhaseCard({
  phase,
  index,
  isActive,
  isEditing,
  seconds,
  onChangeSeconds,
  scrollX,
  cardTotal,
  style,
  progress,
  isVideoOn,
}: {
  phase: typeof PHASES[0];
  index: number;
  isActive: boolean;
  isEditing: boolean;
  seconds: number;
  onChangeSeconds: (v: number) => void;
  scrollX: Animated.Value;
  cardTotal: number;
  style?: any;
  progress: Animated.Value;
  isVideoOn?: boolean;
}) {
  const inputPosition = Animated.subtract(scrollX, index * cardTotal);
  const scale = inputPosition.interpolate({
    inputRange: [-cardTotal, 0, cardTotal],
    outputRange: [0.88, 1, 0.88],
    extrapolate: 'clamp',
  });
  const opacity = inputPosition.interpolate({
    inputRange: [-cardTotal, 0, cardTotal],
    outputRange: [0.35, 1, 0.35],
    extrapolate: 'clamp',
  });
  const translateY = inputPosition.interpolate({
    inputRange: [-cardTotal, 0, cardTotal],
    outputRange: [4, 0, 4],
    extrapolate: 'clamp',
  });

  const [localValue, setLocalValue] = useState(String(seconds));
  const activeScale = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setLocalValue(String(seconds));
  }, [seconds]);

  useEffect(() => {
    Animated.spring(activeScale, {
      toValue: isActive ? 1.03 : 1,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Icon micro-bounce when active
    if (isActive) {
      iconScale.setValue(0.6);
      Animated.spring(iconScale, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }).start();
    }
  }, [isActive]);

  const handleEndEditing = () => {
    const num = parseInt(localValue, 10);
    if (!isNaN(num) && num > 0 && num <= 60) {
      onChangeSeconds(num);
    } else {
      setLocalValue(String(seconds));
    }
  };

  // Resolve animated colors to avoid snapping 
  const resolvedAccent = isActive ? phase.accent : COLORS.textSecondary;
  const resolvedLabelAccent = isActive ? phase.accent : 'rgba(238,238,245,0.7)'; // Brighter idle 
  const resolvedUnitColor = isActive ? `${phase.accent}70` : 'rgba(238,238,245,0.5)'; // Brighter idle

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        style,
        {
          transform: [{ scale: Animated.multiply(scale, activeScale) }, { translateY }],
          opacity,
        },
      ]}
    >
      <GlassCard isActive={isActive} accent={phase.accent} isVideoOn={isVideoOn}>
        {/* Step badge */}
        <View style={[styles.phaseBadge, { backgroundColor: `${phase.accent}15` }]}>
          <Text style={[styles.phaseBadgeText, { color: phase.accent }]}>{index + 1}</Text>
        </View>

        {/* Label and Duration */}
        <Animated.Text style={[styles.cardIcon, { transform: [{ scale: isActive ? iconScale : 1 }] }]}>{phase.icon}</Animated.Text>
        <Text style={[styles.cardLabel, { color: resolvedLabelAccent }]}>
          {phase.label}
        </Text>

        {/* Seconds display */}
        {isEditing ? (
          <View style={styles.editorRow}>
            <TouchableOpacity
              onPress={() => {
                const newVal = Math.max(1, seconds - 1);
                onChangeSeconds(newVal);
                if (Platform.OS !== 'web') Haptics.selectionAsync();
              }}
              style={[styles.editorBtn, { borderColor: `${phase.accent}30` }]}
              activeOpacity={0.6}
            >
              <Text style={[styles.editorBtnText, { color: phase.accent }]}>−</Text>
            </TouchableOpacity>

            <TextInput
              style={[styles.cardSecondsInput, { color: phase.accent, borderBottomColor: `${phase.accent}35` }]}
              value={localValue}
              onChangeText={setLocalValue}
              onEndEditing={handleEndEditing}
              keyboardType="number-pad"
              maxLength={2}
              selectTextOnFocus
            />

            <TouchableOpacity
              onPress={() => {
                const newVal = Math.min(60, seconds + 1);
                onChangeSeconds(newVal);
                if (Platform.OS !== 'web') Haptics.selectionAsync();
              }}
              style={[styles.editorBtn, { borderColor: `${phase.accent}30` }]}
              activeOpacity={0.6}
            >
              <Text style={[styles.editorBtnText, { color: phase.accent }]}>+</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.secondsRow}>
            <Text style={[styles.cardSecondsNum, { color: isActive ? phase.accent : 'rgba(238,238,245,0.85)' }]}>{seconds}</Text>
            <Text style={[styles.cardSecondsUnit, { color: resolvedUnitColor }]}>s</Text>
          </View>
        )}
      </GlassCard>
    </Animated.View>
  );
}

// ─── Error Boundary for Skia ────────────────────────────────
class SkiaErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, info: any) {
    console.error("Skia Rendering Error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return null;
    }
    return this.props.children;
  }
}

// ─── Main App ────────────────────────────────────────────────
export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  // Load Skia on web
  const [isSkiaReady, setIsSkiaReady] = useState(Platform.OS !== 'web');
  const [skEffect, setSkEffect] = useState<any>(null);

  const [activeModeIdx, setActiveModeIdx] = useState(0);
  const [isZenMode, setIsZenMode] = useState(false);
  const activeMode = MODES[activeModeIdx];

  const player = useVideoPlayer(activeMode.video, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    if (player && player.replace) {
      player.replace(activeMode.video);
      player.play();
    }
  }, [activeModeIdx, player]);

  // Bug Fix: Video auto-pauses occasionally on load or app resume
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && player) {
        player.play();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player]);

  const loopOverlayOpacity = useRef(new Animated.Value(0)).current;
  const isVideoFadedOut = useRef(false);
  const learnedDuration = useRef(0);    // We learn this from observing max currentTime
  const maxTimeSeen = useRef(0);

  // ─── Loop Crossfade Transition ──────────────────────────────
  // player.duration returns 0 on Android, so we learn the real duration
  // by tracking the max currentTime before playToEnd fires.
  useEffect(() => {
    if (!player) return;

    player.timeUpdateEventInterval = 0.5;

    const handleTimeUpdate = ({ currentTime }: { currentTime: number }) => {
      // Track the highest time we've seen to learn the duration
      if (currentTime > maxTimeSeen.current) {
        maxTimeSeen.current = currentTime;
      }

      const knownDuration = learnedDuration.current;

      // Only trigger fade-out if we already know the duration (after first loop)
      if (knownDuration > 0 && currentTime >= knownDuration - 2.5) {
        if (!isVideoFadedOut.current) {
          console.log(`[VIDEO-DEBUG] FADE OUT at ${currentTime.toFixed(2)}s (duration=${knownDuration.toFixed(2)})`);
          isVideoFadedOut.current = true;
          Animated.timing(loopOverlayOpacity, {
            toValue: 1,
            duration: 2500,
            easing: Easing.linear,
            useNativeDriver: true,
          }).start();
        }
      }
    };

    const handlePlayToEnd = () => {
      // Learn the duration from the max time we saw
      if (learnedDuration.current === 0 && maxTimeSeen.current > 5) {
        learnedDuration.current = maxTimeSeen.current + 0.5; // small buffer
        console.log(`[VIDEO-DEBUG] Learned video duration: ${learnedDuration.current.toFixed(2)}s`);
      }
      maxTimeSeen.current = 0; // Reset for next loop

      // Fade the overlay back out (reveal the restarted video)
      console.log(`[VIDEO-DEBUG] playToEnd → scheduling FADE IN, fadedOut=${isVideoFadedOut.current}`);
      setTimeout(() => {
        if (isVideoFadedOut.current) {
          console.log('[VIDEO-DEBUG] FADE IN (reveal video)');
          isVideoFadedOut.current = false;
          Animated.timing(loopOverlayOpacity, {
            toValue: 0,
            duration: 2500,
            easing: Easing.linear,
            useNativeDriver: true,
          }).start();
        }
      }, 500);
    };

    const timeSub = player.addListener('timeUpdate', handleTimeUpdate);
    const endSub = player.addListener('playToEnd', handlePlayToEnd);

    return () => {
      timeSub.remove();
      endSub.remove();
    };
  }, [player]);

  // Background Music
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let isCancelled = false;
    async function setupAudio() {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });

        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }

        const { sound } = await Audio.Sound.createAsync(
          activeMode.audio,
          // Si estamos en zen mode arrancamos muteados:
          { shouldPlay: true, isLooping: true, volume: 1.0, isMuted: isZenMode }
        );

        if (!isCancelled) {
          soundRef.current = sound;
        } else {
          sound.unloadAsync();
        }
      } catch (error) {
        console.log('Error loading background audio:', error);
      }
    }

    setupAudio();

    return () => {
      isCancelled = true;
    };
  }, [activeModeIdx]);

  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.setIsMutedAsync(isZenMode);
    }
  }, [isZenMode]);

  useEffect(() => {
    if (Platform.OS === 'web' && !isSkiaReady) return;

    const initShader = async () => {
      let skInstance = typeof Skia !== 'undefined' ? Skia : null;
      if (!skInstance || !skInstance.RuntimeEffect) {
        for (let i = 0; i < 8; i++) {
          await new Promise(r => setTimeout(r, 250));
          skInstance = typeof Skia !== 'undefined' ? Skia : null;
          if (skInstance && skInstance.RuntimeEffect) break;
        }
      }

      if (skInstance && skInstance.RuntimeEffect) {
        try {
          console.log("Compiling LENS_REFRACTION_GLSL...");
          const effect = skInstance.RuntimeEffect.Make(LENS_REFRACTION_GLSL);
          setSkEffect(effect);
        } catch (e) {
          console.error("Skia shader compilation failed:", e);
        }
      }
    };
    initShader();
  }, [LENS_REFRACTION_GLSL, isSkiaReady]);


  useEffect(() => {
    if (Platform.OS === 'web') {
      import('./LoadSkia')
        .then((module) => {
          if (module && module.loadSkia) {
            module.loadSkia(() => setIsSkiaReady(true));
          } else {
            console.error('LoadSkia module missing loadSkia export:', module);
            setIsSkiaReady(true); // Fallback to avoid permablank
          }
        })
        .catch((err) => {
          console.error('Failed to load Skia:', err);
          setIsSkiaReady(true); // Fallback
        });
    }
  }, []);

  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Dynamic layout constants
  const SPACING_UNIT = SCREEN_HEIGHT * 0.02; // ~16-18px
  const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.58, 240);
  const CARD_SPACING = 12;
  const CARD_TOTAL = CARD_WIDTH + CARD_SPACING;
  const SIDE_PADDING = (SCREEN_WIDTH - CARD_WIDTH) / 2 - (CARD_SPACING / 2);

  // Dynamic sizes
  const CIRCLE_SIZE = Math.min(SCREEN_WIDTH * 0.42, SCREEN_HEIGHT * 0.19); // Reduced size significantly
  const GLOW_SIZE = CIRCLE_SIZE * 1.5;
  const HEADER_HEIGHT = SCREEN_HEIGHT * 0.12;
  const FOOTER_HEIGHT = SCREEN_HEIGHT * 0.15;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showMoodSelector, setShowMoodSelector] = useState(false);
  const [showSafetyAlert, setShowSafetyAlert] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Modal context (pre or post session)
  const [pendingMoodType, setPendingMoodType] = useState<'pre' | 'post' | null>(null);
  const [randomModalQuote, setRandomModalQuote] = useState<string | null>(null);

  const preMoodRef = useRef<number | null>(null);
  const preNoteRef = useRef<string | null>(null);

  // Setup Daily Habit Notifications
  useEffect(() => {
    getUserProfile().then(setProfile);

    async function setupNotifications() {
      if (Platform.OS === 'web') return;
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      await Notifications.cancelAllScheduledNotificationsAsync();

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Morning Breath ⛅️",
          body: "Prepare your nervous system for the day ahead.",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 8,
          minute: 0,
        },
      });

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Wind Down 🌙",
          body: "Disconnect and prepare for a restful sleep.",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 21,
          minute: 30,
        },
      });
    }

    setupNotifications();
  }, []);


  const [durations, setDurations] = useState([4, 7, 8]);
  const [repetitions, setRepetitions] = useState(5);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activePhase, setActivePhase] = useState(0);
  const [currentRep, setCurrentRep] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const sessionStartRef = useRef(0);
  const completeOpacity = useRef(new Animated.Value(0)).current;
  const bgTint = useRef(new Animated.Value(0)).current;

  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingRef = useRef(0);
  const phaseRef = useRef(0);
  const repRef = useRef(0);
  const pausedRef = useRef(false);

  const breatheScale = useSharedValue(1);
  const breatheGlow = useSharedValue(0.06);
  const breatheOpacity = useSharedValue(1); // Control circle opacity dynamically
  const particleScale = useSharedValue(1.3); // Shared value version
  const phaseProgress = useRef(new Animated.Value(0)).current;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const playBtnScale = useRef(new Animated.Value(1)).current;
  const playBtnGlow = useRef(new Animated.Value(0.3)).current;
  const titleSpacing = useRef(new Animated.Value(12)).current;

  // Robust focal point measurement for Skia
  const focalPoint = useSharedValue({ x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT * 0.35 });
  const circleRef = useRef<View>(null);

  // Case for smooth color transition
  const activeColor = useSharedValue(COLORS.accent1);

  useEffect(() => {
    if (!isRunning) {
      activeColor.value = withTiming(COLORS.accent1, { duration: 500 });
      return;
    }

    const dur = durations[activePhase] * 1000;

    if (activePhase === 0) {
      // INHALA: Transición completa hacia el próximo color (Sostén - accent2)
      activeColor.value = withTiming(PHASES[1].accent, {
        duration: dur,
        easing: ReanimatedEasing.in(ReanimatedEasing.cubic)
      });
    } else if (activePhase === 1) {
      // SOSTÉN: Se queda estático en el color de Sostén
      activeColor.value = PHASES[1].accent;
    } else if (activePhase === 2) {
      // EXHALA: Dividido en dos tramos
      activeColor.value = withSequence(
        // Tramo 1: De Sostén (accent2) a Exhala (accent3) - Curva rápida al inicio (Out)
        withTiming(PHASES[2].accent, {
          duration: dur / 2,
          easing: ReanimatedEasing.out(ReanimatedEasing.cubic)
        }),
        // Tramo 2: De Exhala (accent3) a Inhala (accent1) - Curva rápida al final (In)
        withTiming(PHASES[0].accent, {
          duration: dur / 2,
          easing: ReanimatedEasing.in(ReanimatedEasing.cubic)
        })
      );
    }
  }, [activePhase, isRunning, durations]);

  const accentColorAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: activeColor.value,
    opacity: breatheGlow.value * 1.5, // Stronger aura to match opaque center
    transform: [{ scale: breatheScale.value }],
  }));

  const accentBorderAnimatedStyle = useAnimatedStyle(() => {
    // We need to properly interpolate the color with opacity instead of appending hex string
    // which fails during interpolation transitions
    return {
      borderColor: isRunning ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)',
      // Use opacity style property or rgba color construction for reliable transparency
      backgroundColor: isRunning ? activeColor.value : 'rgba(255,255,255,0.05)',
      opacity: isRunning ? breatheOpacity.value : 1, // Dynamic opacity based on phase
    };
  });

  const accentTextAnimatedStyle = useAnimatedStyle(() => ({
    // Dark text for contrast on semi-opaque background
    color: isRunning ? COLORS.bg : activeColor.value,
    opacity: 1, // Ensure text is fully opaque against the transparent background container
  }));

  const accentTextMutedAnimatedStyle = useAnimatedStyle(() => ({
    // Muted dark text
    color: isRunning ? 'rgba(7, 7, 26, 0.5)' : activeColor.value,
    opacity: isRunning ? 1 : 0.6,
  }));

  const accentTextAnimatedStyleLegacy = { color: 'white' }; // Placeholder if needed

  const updateFocalPoint = useCallback(() => {
    if (circleRef.current) {
      circleRef.current.measure((_x, _y, width, height, pageX, pageY) => {
        if (width > 0 && height > 0) {
          focalPoint.value = {
            x: pageX + width / 2,
            y: pageY + height / 2
          };
        }
      });
    }
  }, []);

  // Bridging for Skia
  const skiaPhaseProgress = useSharedValue(0);

  // Load saved preferences
  useEffect(() => {
    (async () => {
      try {
        const savedDurations = await AsyncStorage.getItem('user-durations');
        const savedReps = await AsyncStorage.getItem('user-repetitions');
        const savedModeIdx = await AsyncStorage.getItem('user-modeIdx');
        const savedZenMode = await AsyncStorage.getItem('user-zenMode');
        if (savedDurations) setDurations(JSON.parse(savedDurations));
        if (savedReps) setRepetitions(parseInt(savedReps, 10));
        if (savedModeIdx) setActiveModeIdx(parseInt(savedModeIdx, 10));
        if (savedZenMode) setIsZenMode(savedZenMode === 'true');
      } catch (e) {
        console.error('Failed to load settings', e);
      }
    })();
  }, []);

  // Save preferences when changed
  useEffect(() => {
    AsyncStorage.setItem('user-durations', JSON.stringify(durations));
  }, [durations]);

  useEffect(() => {
    AsyncStorage.setItem('user-repetitions', String(repetitions));
  }, [repetitions]);

  useEffect(() => {
    AsyncStorage.setItem('user-modeIdx', String(activeModeIdx));
  }, [activeModeIdx]);

  useEffect(() => {
    AsyncStorage.setItem('user-zenMode', String(isZenMode));
  }, [isZenMode]);


  // Entrance animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  // Play button subtle pulse when idle
  useEffect(() => {
    Animated.timing(titleSpacing, {
      toValue: isRunning ? 6 : 12,
      duration: 1500,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false, // letterSpacing not supported by native driver
    }).start();

    if (!isRunning) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(playBtnGlow, { toValue: 0.6, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(playBtnGlow, { toValue: 0.25, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [isRunning]);

  // Idle breathing animation
  useEffect(() => {
    if (!isRunning) {
      breatheScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 3500, easing: ReanimatedEasing.inOut(ReanimatedEasing.sin) }),
          withTiming(1, { duration: 3500, easing: ReanimatedEasing.inOut(ReanimatedEasing.sin) })
        ),
        -1, // Loop indefinitely
        true // Reverse
      );

      breatheGlow.value = withRepeat(
        withSequence(
          withTiming(0.12, { duration: 3500, easing: ReanimatedEasing.inOut(ReanimatedEasing.sin) }),
          withTiming(0.06, { duration: 3500, easing: ReanimatedEasing.inOut(ReanimatedEasing.sin) })
        ),
        -1,
        true
      );
    } else {
      // breatheScale and breatheGlow will be controlled by startBreatheAnimation
    }
  }, [isRunning, activePhase]);

  const scrollToPhase = useCallback((index: number) => {
    const ref = scrollViewRef.current;
    if (!ref) return;

    const targetX = index * CARD_TOTAL;

    if (Platform.OS === 'web') {
      // Intentar vía ID directo (más fiable en Web)
      const element = document.getElementById('main-carousel-scroll');
      if (element) {
        element.scrollTo({ left: targetX, behavior: 'smooth' });
        // Fallback inmediato por si behavior:smooth falla
        setTimeout(() => { element.scrollLeft = targetX; }, 100);
        return;
      }

      const node = ref.getNode?.() || ref;
      const nativeNode = node.getScrollableNode?.() || (node.firstChild || node);
      try {
        if (nativeNode.scrollTo) {
          nativeNode.scrollTo({ left: targetX, behavior: 'smooth' });
        } else {
          nativeNode.scrollLeft = targetX;
        }
      } catch (e) {
        // Ignorar
      }
      return;
    }

    const scrollable = ref.getScrollResponder?.() || (ref.getNode?.() || ref);
    if (scrollable && scrollable.scrollTo) {
      setTimeout(() => {
        scrollable.scrollTo({ x: targetX, animated: true });
      }, 100);
    }
  }, [CARD_TOTAL]);

  // Sync scroll on phase change
  useEffect(() => {
    if (isRunning) {
      scrollToPhase(activePhase);
    }
  }, [activePhase, isRunning, scrollToPhase]);

  const startBreatheAnimation = useCallback((phase: number, durationSec: number) => {
    const dur = durationSec * 1000;

    if (phase === 0) {
      // INHALA
      breatheScale.value = withTiming(1.15, { duration: dur, easing: ReanimatedEasing.out(ReanimatedEasing.cubic) });
      breatheGlow.value = withTiming(0.24, { duration: dur, easing: ReanimatedEasing.out(ReanimatedEasing.cubic) });
      breatheOpacity.value = withTiming(0.7, { duration: dur, easing: ReanimatedEasing.out(ReanimatedEasing.cubic) }); // 70% for Inhale
      particleScale.value = withTiming(0.5, { duration: dur, easing: ReanimatedEasing.out(ReanimatedEasing.cubic) });
    } else if (phase === 1) {
      // SOSTÉN
      // Maintain inhale state
    } else if (phase === 2) {
      // EXHALA
      breatheScale.value = withTiming(1.0, { duration: dur, easing: ReanimatedEasing.inOut(ReanimatedEasing.cubic) });
      breatheGlow.value = withTiming(0.08, { duration: dur, easing: ReanimatedEasing.inOut(ReanimatedEasing.cubic) });
      // Faster opacity drop for immediate feedback
      breatheOpacity.value = withTiming(0.5, { duration: dur * 0.4, easing: ReanimatedEasing.out(ReanimatedEasing.cubic) });
      particleScale.value = withTiming(1.3, { duration: dur, easing: ReanimatedEasing.inOut(ReanimatedEasing.cubic) });
    } else {
      // INHALA / SOSTÉN default opacity
      breatheOpacity.value = withTiming(0.7, { duration: dur, easing: ReanimatedEasing.out(ReanimatedEasing.cubic) }); // 70% standard
    }
  }, [breatheScale, breatheGlow, particleScale, breatheOpacity]);

  const startPhase = useCallback((phase: number, rep: number) => {
    if (rep >= repetitions) {
      // Session complete!
      const elapsedSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000);
      const sessionMinutes = Math.max(1, Math.round(elapsedSeconds / 60)); // Round to nearest minute, min 1
      setSessionDuration(elapsedSeconds);
      stopTimer();
      setShowComplete(true);
      completeOpacity.setValue(0);
      Animated.timing(completeOpacity, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

      // Log session in background
      if (profile?.settings?.enableTracking !== false) {
        logSession(sessionMinutes).then(setProfile);
      }

      // Celebration haptics
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 300);
      }

      // Auto-dismiss after 3s and trigger Post-Mood
      setTimeout(async () => {
        // Refresh profile to get latest vault notes
        const freshProfile = await getUserProfile();
        setProfile(freshProfile);

        Animated.timing(completeOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
          setShowComplete(false);
          if (freshProfile?.settings?.enableMood !== false) {
            // Show a random vault note as an encouraging quote
            if (freshProfile?.settings?.enableVault && freshProfile.vaultNotes && freshProfile.vaultNotes.length > 0) {
              const randomNote = freshProfile.vaultNotes[Math.floor(Math.random() * freshProfile.vaultNotes.length)];
              setRandomModalQuote(randomNote);
            } else {
              setRandomModalQuote(null);
            }
            setPendingMoodType('post');
            setShowMoodSelector(true);
          }
        });
      }, 3000);
      return;
    }

    const dur = durations[phase];
    phaseRef.current = phase;
    repRef.current = rep;
    remainingRef.current = dur;
    setActivePhase(phase);
    setCurrentRep(rep);
    setCountdown(dur);

    // Differentiated haptics per phase
    if (Platform.OS !== 'web') {
      if (phase === 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else if (phase === 1) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    // Animate background tint
    Animated.timing(bgTint, { toValue: phase, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start();

    // Reset and start progress bar
    phaseProgress.setValue(0);
    Animated.timing(phaseProgress, {
      toValue: 1,
      duration: dur * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    // Animate Skia Progress based on phase
    if (phase === 0) {
      // Inhale: Outer (0) -> Inner (1)
      skiaPhaseProgress.value = withTiming(1, {
        duration: dur * 1000,
        easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
      });
    } else if (phase === 1) {
      // Hold: Keep Inner (1)
      skiaPhaseProgress.value = 1;
    } else if (phase === 2) {
      // Exhale: Inner (1) -> Outer (0)
      skiaPhaseProgress.value = withTiming(0, {
        duration: dur * 1000,
        easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
      });
    }

    startBreatheAnimation(phase, dur);

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (pausedRef.current) return;

      remainingRef.current -= 1;
      if (remainingRef.current > 0) {
        setCountdown(remainingRef.current);
      } else {
        clearInterval(timerRef.current!);
        timerRef.current = null;

        const nextPhase = (phaseRef.current + 1) % 3;
        const nextRep = nextPhase === 0 ? repRef.current + 1 : repRef.current;
        startPhase(nextPhase, nextRep);
      }
    }, 1000);
  }, [durations, repetitions, scrollToPhase, startBreatheAnimation, profile]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    breatheScale.value = withTiming(1, { duration: 400 });
    breatheGlow.value = withTiming(0.06, { duration: 400 });
    particleScale.value = withTiming(1.3, { duration: 400 });
    skiaPhaseProgress.value = withTiming(0, { duration: 400 });

    setCountdown(0);
    setIsRunning(false);
    setIsPaused(false);
    pausedRef.current = false;
    setActivePhase(0);
    setCurrentRep(0);
    phaseRef.current = 0;
    repRef.current = 0;
    phaseProgress.setValue(0);
    scrollToPhase(0);
  }, [scrollToPhase, breatheScale, breatheGlow, particleScale, skiaPhaseProgress]);

  const handleStop = useCallback(async () => {
    setIsRunning(false);
    setIsPaused(false);
    setShowComplete(true);
    if (!isZenMode && player) {
      player.play();
    }
    // Calculate total duration using current cycle index and stored phase durations
    const activeSessionDuration = Math.floor(
      currentRep * (durations[0] + durations[1] + durations[2]) +
      (activePhase > 0 ? durations[0] : 0) +
      (activePhase > 1 ? durations[1] : 0) +
      skiaPhaseProgress.value * durations[activePhase]
    );
    setSessionDuration(activeSessionDuration);
    if (activeSessionDuration > 15) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Refresh profile to guarantee we see any notes that were saved right before the session
    const freshProfile = await getUserProfile();
    setProfile(freshProfile);

    // We wrapped up a session—let's ask for Post-Mood if enabled
    if (freshProfile?.settings?.enableMood) {
      setTimeout(() => {
        // If Vault is enabled and we have notes, pick a random one to show as the title
        if (freshProfile?.settings?.enableVault && freshProfile.vaultNotes && freshProfile.vaultNotes.length > 0) {
          const randomNote = freshProfile.vaultNotes[Math.floor(Math.random() * freshProfile.vaultNotes.length)];
          setRandomModalQuote(randomNote);
        } else {
          setRandomModalQuote(null);
        }
        setPendingMoodType('post');
        setShowMoodSelector(true);
      }, 1000);
    }
  }, [player, isZenMode, durations, currentRep, activePhase, skiaPhaseProgress]);

  const actuallyStartSession = useCallback(() => {
    setIsRunning(true);
    setShowComplete(false);
    completeOpacity.setValue(0);
    sessionStartRef.current = Date.now();

    // Reset scales via shared values
    breatheScale.value = withTiming(1, { duration: 100 });
    breatheOpacity.value = withTiming(0.7, { duration: 100 });
    particleScale.value = withTiming(1.3, { duration: 100 });

    startPhase(0, 0);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [startPhase, breatheScale, particleScale, completeOpacity, breatheOpacity]);

  const handleMoodSelect = useCallback(async (moodChoice: number, note: string) => {
    setShowMoodSelector(false);

    if (pendingMoodType === 'pre') {
      preMoodRef.current = moodChoice;
      preNoteRef.current = note;
      actuallyStartSession();
    } else if (pendingMoodType === 'post') {
      if (preMoodRef.current !== null) {
        await saveMoodLog({
          timestamp: Date.now(),
          preMood: preMoodRef.current,
          postMood: moodChoice,
          note: preNoteRef.current || undefined // Only pre-session asks for notes, pass the saved ref
        });

        // Refresh the profile so the new note is immediately available for the next quote
        const updatedProfile = await getUserProfile();
        setProfile(updatedProfile);
      }
      // Session fully wrapped up!
      preNoteRef.current = null;
    }
    setPendingMoodType(null);
    setRandomModalQuote(null);
  }, [pendingMoodType, actuallyStartSession, profile]);

  const handlePlay = useCallback(() => {
    Animated.sequence([
      Animated.timing(playBtnScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(playBtnScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();

    if (isRunning) {
      handleStop();
    } else {
      setPendingMoodType('pre');
      setShowMoodSelector(true);
    }
  }, [isRunning, handleStop, playBtnScale]);

  const updateDuration = (index: number, value: number) => {
    setDurations((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const toggleMode = useCallback(() => {
    setActiveModeIdx((prev) => {
      if (Platform.OS !== 'web') Haptics.selectionAsync();
      return (prev + 1) % MODES.length;
    });
  }, []);

  const toggleZenMode = useCallback(() => {
    setIsZenMode((prev) => {
      if (Platform.OS !== 'web') Haptics.selectionAsync();
      return !prev;
    });
  }, []);

  const handleIncreaseCycles = useCallback(() => {
    const msInWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksActive = profile ? Math.floor((Date.now() - profile.installDate) / msInWeek) : 0;

    if (weeksActive < 2 && repetitions >= 4) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowSafetyAlert(true);
      return;
    }

    if (repetitions < 8) {
      if (Platform.OS !== 'web') Haptics.selectionAsync();
      setRepetitions(r => r + 1);
    }
  }, [profile, repetitions]);

  const handleDecreaseCycles = useCallback(() => {
    if (repetitions > 1) {
      if (Platform.OS !== 'web') Haptics.selectionAsync();
      setRepetitions(r => r - 1);
    }
  }, [repetitions]);

  const totalCycleSeconds = durations.reduce((a, b) => a + b, 0);

  // ─── Idle Health Tips ──────────────────────────────────
  const [currentTip, setCurrentTip] = useState(HEALTH_TIPS[0]);
  const tipOpacity = useRef(new Animated.Value(0)).current;

  // Modals state
  const [randomNoteAlert, setRandomNoteAlert] = useState<string | null>(null);

  useEffect(() => {
    if (isRunning || showComplete) {
      tipOpacity.setValue(0);
      return;
    }

    // Initial fade in
    Animated.timing(tipOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }).start();

    const interval = setInterval(() => {
      // Crossfade to new tip
      Animated.timing(tipOpacity, { toValue: 0, duration: 1000, useNativeDriver: true }).start(() => {
        const nextTip = HEALTH_TIPS[Math.floor(Math.random() * HEALTH_TIPS.length)];
        setCurrentTip(nextTip);
        Animated.timing(tipOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
      });
    }, 30000); // Rotate every 30s

    return () => clearInterval(interval);
  }, [isRunning, showComplete, tipOpacity]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Modals ────────────────────────────────────── */}
      <MoodSelectorModal
        visible={showMoodSelector}
        title={pendingMoodType === 'pre' ? "How are you feeling right now?" : "How do you feel now?"}
        quote={pendingMoodType === 'post' ? randomModalQuote : null}
        showNoteInput={pendingMoodType === 'pre'}
        onSelectMood={handleMoodSelect}
        onClose={() => {
          setShowMoodSelector(false);
          setPendingMoodType(null);
          setRandomModalQuote(null);
        }}
      />
      <StatsModal
        visible={showStatsModal}
        profile={profile}
        onClose={() => setShowStatsModal(false)}
      />
      <InfoModal
        visible={showInfoModal}
        onClose={() => setShowInfoModal(false)}
      />
      <VaultModal
        visible={showVaultModal}
        profile={profile}
        onProfileChange={setProfile}
        onClose={() => setShowVaultModal(false)}
      />
      <SettingsModal
        visible={showSettingsModal}
        profile={profile}
        onProfileChange={setProfile}
        onClose={() => setShowSettingsModal(false)}
      />
      <SafetyAlertModal
        visible={showSafetyAlert}
        message="Stick to a max of 4 cycles for the first 2 weeks to avoid dizziness. Your body needs time to adapt to this breathing pattern."
        onClose={() => setShowSafetyAlert(false)}
      />

      {/* ── Video Background ────────────────────────── */}
      {!isZenMode ? (
        <View style={StyleSheet.absoluteFill}>
          {/* Fallback gradient underneath so the video fades into beautiful calm colors instead of black */}
          <LinearGradient
            colors={[COLORS.bg, COLORS.bgMid, COLORS.bgBottom]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 1 }}
          />

          <VideoView
            style={StyleSheet.absoluteFill}
            player={player}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
            contentFit="cover"
          />

          {/* Velo animado por encima del video para ocultarlo */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: loopOverlayOpacity }]}>
            <LinearGradient
              colors={[COLORS.bg, COLORS.bgMid, COLORS.bgBottom]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.3, y: 0 }}
              end={{ x: 0.7, y: 1 }}
            />
          </Animated.View>
          {/* Darkening Overlay for legibility */}
          <LinearGradient
            colors={[COLORS.bg, COLORS.bgMid, COLORS.bgBottom]}
            style={[StyleSheet.absoluteFill, { opacity: 0.8 }]}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            pointerEvents="none"
          />
        </View>
      ) : (
        <LinearGradient
          colors={[COLORS.bg, COLORS.bgMid, COLORS.bgBottom]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
        />
      )}

      {/* ── Background Visual Engine (Skia) ─────────── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {isSkiaReady && (
          <SkiaErrorBoundary>
            <Canvas style={{ flex: 1, backgroundColor: 'transparent' }}>
              <SkiaFieldGlow
                color={activeColor}
                focalPoint={focalPoint}
                scale={breatheScale}
              />
              <SkiaParticles
                width={SCREEN_WIDTH}
                height={SCREEN_HEIGHT}
                color={activeColor}
                isRunning={isRunning}
                activePhase={activePhase}
                progress={skiaPhaseProgress}
                focalPoint={focalPoint}
              />
              {skEffect && (
                <RefractionOverlay
                  skEffect={skEffect}
                  focalPoint={focalPoint}
                  isRunning={isRunning}
                  width={SCREEN_WIDTH}
                  height={SCREEN_HEIGHT}
                />
              )}
            </Canvas>
          </SkiaErrorBoundary>
        )}
      </View>

      <Animated.View style={[styles.content, {
        opacity: fadeAnim,
        paddingTop: Math.max(insets.top, 20),
        paddingBottom: insets.bottom + 34
      }]}>
        {/* ── Top Header ──────────────────────────────────── */}
        <View style={styles.headerContainer} pointerEvents="box-none">
          <TouchableOpacity style={styles.headerLeft} onPress={() => setShowInfoModal(true)} activeOpacity={0.7}>
            <Text style={styles.dailyGoalTitle}>Daily Goal</Text>
            <View style={[styles.dailyDotHeader, profile?.dailySessions?.am && styles.dailyDotHeaderActive]} />
            <View style={[styles.dailyDotHeader, profile?.dailySessions?.pm && styles.dailyDotHeaderActive]} />
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIconButton} onPress={() => setShowStatsModal(true)}>
              <Ionicons name="stats-chart" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {profile?.settings?.enableVault !== false && (
              <>
                <View style={styles.headerIconSeparator} />
                <TouchableOpacity style={styles.headerIconButton} onPress={() => setShowVaultModal(true)}>
                  <Ionicons name="bookmarks" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </>
            )}
            <View style={styles.headerIconSeparator} />
            <TouchableOpacity style={styles.headerIconButton} onPress={() => setShowSettingsModal(true)}>
              <Ionicons name="settings" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ flex: 0.4 }} />
        {/* ── Breathing Circle ────────────────────────── */}
        <View style={[
          styles.circleWrapper,
          { marginVertical: SPACING_UNIT }
        ]}>
          <View
            ref={circleRef}
            onLayout={updateFocalPoint}
            style={[styles.circleContainer, { width: SCREEN_WIDTH, backgroundColor: 'transparent' }]}
          >
            {/* Glow */}
            <Reanimated.View
              style={[
                styles.outerGlow,
                {
                  width: GLOW_SIZE,
                  height: GLOW_SIZE,
                  borderRadius: GLOW_SIZE / 2,
                },
                accentColorAnimatedStyle
              ]}
            />
            {/* Sparkle ring */}
            <SparkleRing color={activeColor} isActive={isRunning && !isPaused} radius={CIRCLE_SIZE * 0.6} />
            {/* Orbital ring */}
            <OrbitalRing width={CIRCLE_SIZE * 1.4} />
            {/* Main circle */}
            <Reanimated.View
              style={[
                styles.mainCircle,
                {
                  width: CIRCLE_SIZE,
                  height: CIRCLE_SIZE,
                  borderRadius: CIRCLE_SIZE / 2,
                  overflow: 'hidden',
                },
                useAnimatedStyle(() => ({
                  transform: [{ scale: breatheScale.value }]
                }))
              ]}
            >
              <Reanimated.View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderRadius: CIRCLE_SIZE / 2,
                    borderWidth: 1,
                  },
                  accentBorderAnimatedStyle,
                ]}
              />
              <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                {isRunning ? (
                  <View style={styles.circleContent}>
                    <AnimatedNumber
                      value={countdown}
                      color={isRunning ? COLORS.bg : activeColor.value}
                      style={styles.circleCountdown}
                    />
                    <Reanimated.Text style={[styles.circlePhaseLabel, accentTextMutedAnimatedStyle]}>
                      {PHASES[activePhase].label.toLowerCase()}
                    </Reanimated.Text>
                  </View>
                ) : (
                  <View style={styles.circleContent}>
                    <Text style={styles.circleIdleLabel}>breathe</Text>
                  </View>
                )}
              </View>
            </Reanimated.View>
          </View>
        </View>
        <View style={{ flex: 1 }} />

        {/* Rep counter when running */}
        {isRunning && (
          <View style={styles.repDisplay}>
            <View style={styles.repDots}>
              {Array.from({ length: repetitions }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.repDot,
                    {
                      backgroundColor:
                        i < currentRep
                          ? COLORS.accent1
                          : i === currentRep
                            ? PHASES[activePhase].accent
                            : 'rgba(238,238,245,0.35)', // Brighter dot
                      width: i === currentRep ? 16 : 5,
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={styles.repText}>
              {currentRep + 1} of {repetitions}
            </Text>
          </View>
        )}

        {/* Communication texts (Inhaling, Ready, etc.) */}
        <View style={styles.statusSection}>
          {showComplete ? (
            <Animated.View style={{ alignItems: 'center', opacity: completeOpacity }}>
              <Text style={styles.completeTitle}>done ✨</Text>
              <Text style={styles.completeSub}>
                {Math.floor(sessionDuration / 60)}m {sessionDuration % 60}s · {repetitions} cycles
              </Text>
            </Animated.View>
          ) : isRunning ? (
            <Text style={[styles.statusTextLarge, { color: 'rgba(238,238,245,0.8)' }]}>
              {isPaused ? 'paused' : `${PHASES[activePhase].label.toLowerCase()}`}
            </Text>
          ) : (
            <>
              <View style={styles.cycleSelector}>
                <TouchableOpacity onPress={handleDecreaseCycles} style={styles.cycleBtn} activeOpacity={0.6}>
                  <Ionicons name="remove" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <Text style={[styles.statusTextLarge, { color: 'rgba(238,238,245,0.8)', minWidth: 120 }]}>
                  {totalCycleSeconds}s × {repetitions} = {totalCycleSeconds * repetitions}s
                </Text>
                <TouchableOpacity onPress={handleIncreaseCycles} style={styles.cycleBtn} activeOpacity={0.6}>
                  <Ionicons name="add" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
              <Animated.Text style={[styles.idleTipText, { opacity: tipOpacity }]}>
                {currentTip}
              </Animated.Text>
            </>
          )}
        </View>

        {/* Phase cards carousel ────────────────────── */}
        <View style={styles.carouselSection} pointerEvents={isRunning ? 'box-none' : 'auto'}>
          <Animated.ScrollView
            nativeID="main-carousel-scroll"
            ref={scrollViewRef}
            horizontal
            pagingEnabled={false}
            snapToInterval={isRunning ? undefined : CARD_TOTAL}
            snapToAlignment={isRunning ? undefined : "start"}
            decelerationRate="fast"
            scrollEnabled={!isRunning}
            showsHorizontalScrollIndicator={false}
            style={{ overflow: 'visible' }}
            contentContainerStyle={{
              paddingHorizontal: SIDE_PADDING,
              paddingVertical: 10,
              overflow: 'visible',
              paddingBottom: 20 // Extra room for shadows
            }}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: true }
            )}
          >
            {PHASES.map((phase, i) => (
              <PhaseCard
                key={i}
                phase={phase}
                index={i}
                isActive={isRunning && activePhase === i}
                isEditing={false}
                seconds={durations[i]}
                onChangeSeconds={(v) => updateDuration(i, v)}
                scrollX={scrollX}
                cardTotal={CARD_TOTAL}
                style={{ width: CARD_WIDTH, marginHorizontal: CARD_SPACING / 2 }}
                progress={phaseProgress}
                isVideoOn={!isZenMode}
              />
            ))}
          </Animated.ScrollView>

          {/* Phase dots */}
          <View style={styles.dotRow}>
            {PHASES.map((phase, i) => {
              const isActiveP = isRunning && activePhase === i;
              return (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: isActiveP ? phase.accent : 'rgba(255,255,255,0.12)',
                      width: isActiveP ? 20 : 6,
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>


        {/* ── Unified Action Button ─────────────────────── */}
        <View style={styles.footerControls}>
          <TouchableOpacity
            style={[
              styles.secondaryToggleBtn,
              {
                backgroundColor: 'rgba(139,124,248,0.25)',
                borderColor: 'rgba(139,124,248,0.5)'
              }
            ]}
            onPress={toggleMode}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeMode.icon as any}
              size={20}
              color="#fff"
            />
          </TouchableOpacity>

          <Animated.View style={{ transform: [{ scale: playBtnScale }] }}>
            {!isRunning && !showComplete && (
              <Animated.View
                style={[
                  styles.playButtonGlow,
                  {
                    backgroundColor: COLORS.playBtn,
                    opacity: playBtnGlow,
                  }
                ]}
              />
            )}
            <TouchableOpacity
              style={[
                styles.playButton,
                {
                  backgroundColor: isRunning ? PHASES[activePhase].accent : COLORS.playBtn,
                  shadowColor: isRunning ? PHASES[activePhase].accent : COLORS.playBtn,
                }
              ]}
              onPress={handlePlay}
              activeOpacity={0.8}
            >
              <View style={styles.iconContainer}>
                <Animated.View style={{ opacity: isRunning ? 1 : 0, position: 'absolute' }}>
                  <View style={styles.stopIconInner} />
                </Animated.View>
                <Animated.View style={{ opacity: isRunning ? 0 : 1 }}>
                  <View style={styles.playIconTriangle} />
                </Animated.View>
              </View>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={[
              styles.secondaryToggleBtn,
              {
                backgroundColor: !isZenMode ? 'rgba(139,124,248,0.25)' : COLORS.glass,
                borderColor: !isZenMode ? 'rgba(139,124,248,0.5)' : COLORS.glassBorder,
              }
            ]}
            onPress={toggleZenMode}
            activeOpacity={0.7}
          >
            <Ionicons
              name={!isZenMode ? "eye-outline" : "eye-off-outline"}
              size={20}
              color={!isZenMode ? "#fff" : COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <CustomAlertModal
        visible={randomNoteAlert !== null}
        title="From your past self"
        message={randomNoteAlert || ''}
        icon="sparkles"
        iconColor={COLORS.playBtn}
        onClose={() => setRandomNoteAlert(null)}
      />

    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    overflow: 'visible',
  },
  content: {
    flex: 1,
  },

  // ── Header
  header: {
    paddingTop: 0, // Handled by container padding and insets
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '300',
    letterSpacing: 4,
    textTransform: 'lowercase',
    opacity: 0.9,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0, // Reset margin since title is gone
    gap: 10,
  },
  techniqueLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginRight: 4,
  },
  subtitleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.9,
  },
  subtitleVal: {
    fontSize: 22, // Promoted size now that it's the header
    color: COLORS.text,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  subtitleSep: {
    fontSize: 22,
    color: COLORS.textMuted,
    marginHorizontal: -2,
  },

  // ── Circle
  circleWrapper: {
    alignItems: 'center',
    zIndex: 1,
    justifyContent: 'center',
    marginVertical: 10,
  },
  circleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 250,
    backgroundColor: 'transparent',
  },
  outerGlow: {
    position: 'absolute',
    // Apply a native blur effect for "glow" look
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 5,
  },
  mainCircle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCountdown: {
    fontSize: 42,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    lineHeight: 48,
  },
  circlePhaseLabel: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2,
  },
  circleIdleIcon: {
    fontSize: 20,
    color: COLORS.textMuted,
    marginBottom: 6,
    fontWeight: '200',
  },
  circleIdleLabel: {
    fontSize: 16, // Larger text
    color: COLORS.textMuted,
    letterSpacing: 6,
    textTransform: 'lowercase',
    fontWeight: '300',
  },
  iconContainer: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Rep progress display
  repDisplay: {
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 15, // Added space from circle
    gap: 6,
  },
  repDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  repDot: {
    height: 5,
    borderRadius: 3,
  },
  repText: {
    fontSize: 11,
    color: 'rgba(238,238,245,0.6)', // Brighter text
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },

  // ── Carousel
  carouselSection: {
    marginBottom: 10,
    zIndex: 2,
    overflow: 'visible',
  },
  cardWrapper: {
    overflow: 'visible', // Ensure scale/glow isn't clipped
  },
  glassCardBase: {
    borderRadius: 24,
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 18,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      }
    })
  },
  card: {
    borderRadius: 24,
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    backgroundColor: COLORS.card,
  },
  cardIcon: {
    fontSize: 18,
    marginBottom: 6,
  },
  phaseBadge: {
    position: 'absolute',
    top: -10,
    left: 0,
    width: 24,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'lowercase',
  },
  secondsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 1,
  },
  cardSecondsNum: {
    fontSize: 34,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
  },
  cardSecondsUnit: {
    fontSize: 14,
    fontWeight: '400',
  },
  cardSecondsInput: {
    fontSize: 34,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    minWidth: 48,
    borderBottomWidth: 1,
    paddingBottom: 2,
  },

  // ── Editor
  editorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  editorBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorBtnText: {
    fontSize: 18,
    fontWeight: '300',
    lineHeight: 20,
  },

  // ── Dots
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 5,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },

  // ── Settings
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 15,
    paddingHorizontal: 24,
  },
  settingsBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 28,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  settingsBtnText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  // ── Rep editor
  repEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 10,
  },
  repEditorBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repEditorBtnText: {
    color: COLORS.text,
    fontSize: 20,
  },
  headerContainer: {
    width: '100%',
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 100,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dailyGoalTitle: {
    fontFamily: 'Outfit-Medium',
    fontSize: 14,
    color: COLORS.textSecondary,
    marginRight: 10,
  },
  dailyDotHeader: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginLeft: 6,
  },
  dailyDotHeaderActive: {
    backgroundColor: COLORS.playBtn,
    shadowColor: COLORS.playBtn,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)', // Inner depth metaphor
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  headerIconSeparator: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 3,
  },
  repEditorValueBox: {
    alignItems: 'center',
  },
  repEditorValue: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
  },
  repEditorLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 1,
  },

  // ── Play / Stop
  footerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24, // Increased gap slightly to fit the 3 buttons nicely
    marginTop: 10,
  },
  secondaryToggleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  playButtonGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    left: -10,
    top: -10,
  },
  playIconTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 16,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: '#fff',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 3,
  },
  pauseIconBox: {
    flexDirection: 'row',
    gap: 5,
  },
  pauseBar: {
    width: 5,
    height: 18,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  stopIconInner: {
    width: 18,
    height: 18,
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  stopButton: {
    display: 'none', // Removed separate stop button
  },
  statusSection: {
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  statusTextLarge: {
    fontFamily: 'Outfit-Medium',
    fontSize: 22,
    color: COLORS.text,
    letterSpacing: 2,
    textTransform: 'lowercase',
    textAlign: 'center',
    marginHorizontal: 15,
  },
  completeTitle: {
    fontFamily: 'Outfit-Medium',
    fontSize: 32,
    color: '#FFFFFF',
    textShadowColor: 'rgba(255,255,255,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    marginBottom: 4,
  },
  completeSub: {
    fontFamily: 'Outfit-Regular',
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  idleTipText: {
    fontFamily: 'Outfit-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 18,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  cycleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
