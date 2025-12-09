import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const Star = ({ x, y, size, delay }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const createPulseAnimation = () => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 1000 + Math.random() * 1000,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.2,
            duration: 1000 + Math.random() * 1000,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const createScaleAnimation = () => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1,
            duration: 1500 + Math.random() * 1000,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.5,
            duration: 1500 + Math.random() * 1000,
            useNativeDriver: true,
          }),
        ])
      );
    };

    // Start animations with random delays
    const timeout = setTimeout(() => {
      createPulseAnimation().start();
      createScaleAnimation().start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [opacity, scale, delay]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        backgroundColor: '#ffffff',
        borderRadius: size / 2,
        opacity: opacity,
        transform: [{ scale: scale }],
        shadowColor: '#ffffff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: size / 2,
        elevation: 5,
      }}
    />
  );
};

const StarField = ({ numStars = 50, intensity = 1 }) => {
  const stars = useRef(
    Array.from({ length: numStars }, (_, i) => ({
      id: i,
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 4 + 2, // Random size between 2-6
      delay: Math.random() * 3000, // Random delay up to 3 seconds
    }))
  ).current;

  return (
    <View 
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        opacity: intensity 
      }}
      pointerEvents="none" // Ensures stars don't interfere with touch events
    >
      {stars.map((star) => (
        <Star
          key={star.id}
          x={star.x}
          y={star.y}
          size={star.size}
          delay={star.delay}
        />
      ))}
    </View>
  );
};

export default StarField;