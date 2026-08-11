import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SCREENS } from './src/navigation/screens.js';
import { useNavigator } from './src/navigation/useNavigator.js';
import { boot } from './src/session/boot.js';
import { colors } from './src/theme/colors.js';
import { fontAssets } from './src/theme/typography.js';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const nav = useNavigator();
  const [ready, setReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    boot()
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    // Fonts failing is survivable - the system face is used instead - so don't
    // hold the splash open waiting for a retry that isn't coming.
    if (ready && (fontsLoaded || fontError)) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready, fontsLoaded, fontError]);

  if (!ready || (!fontsLoaded && !fontError)) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const Screen = SCREENS[nav.current.name] || SCREENS.menu;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Screen nav={nav} {...nav.current.params} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backdropFlat,
  },
});
