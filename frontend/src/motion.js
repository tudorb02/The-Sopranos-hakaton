// The web version's motion: page blocks rise into place, bars and meters grow from zero, the running state spins.
// Nothing moves when the phone asks for reduced motion.

import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform } from "react-native";

const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
const nativeDriver = Platform.OS !== "web";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((value) => alive && setReduced(value));
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setReduced);
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduced;
}

// 0 → 1 once, after `delay` ms.
export function useEntrance({ duration = 600, delay = 150 } = {}) {
  const reduced = useReducedMotion();
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) {
      value.setValue(1);
      return undefined;
    }
    const animation = Animated.timing(value, { toValue: 1, duration, delay, easing: easeOut, useNativeDriver: nativeDriver });
    animation.start();
    return () => animation.stop();
  }, [reduced, value, duration, delay]);
  return value;
}

// A bar that grows to the right (meters) or up (week and plan bars).
export function useGrowStyle(direction = "right") {
  const value = useEntrance();
  return direction === "right"
    ? { transform: [{ scaleX: value }], transformOrigin: "left" }
    : { transform: [{ scaleY: value }], transformOrigin: "bottom" };
}

// A block of the page that rises into place; `index` staggers the first few.
export function useRiseStyle(index = 0) {
  const value = useEntrance({ duration: 460, delay: Math.min(index, 4) * 40 });
  return {
    opacity: value,
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  };
}

export function useSpinStyle() {
  const reduced = useReducedMotion();
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) return undefined;
    const loop = Animated.loop(Animated.timing(value, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: nativeDriver }));
    loop.start();
    return () => loop.stop();
  }, [reduced, value]);
  return { transform: [{ rotate: value.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] };
}
