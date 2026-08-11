// Imported per weight, not from the package index: the index requires every
// weight AND every italic, which pulled ~6MB of unused .ttf into the bundle.
import { Orbitron_500Medium } from '@expo-google-fonts/orbitron/500Medium';
import { Orbitron_700Bold } from '@expo-google-fonts/orbitron/700Bold';
import { Orbitron_900Black } from '@expo-google-fonts/orbitron/900Black';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';

/**
 * Orbitron for anything that should feel like an instrument panel (titles,
 * score, timer, letters); Inter for anything that should just be readable.
 *
 * Loaded at runtime with useFonts - the expo-font config plugin needs a native
 * build and would not work in Expo Go.
 */
export const fontAssets = {
  Orbitron_500Medium,
  Orbitron_700Bold,
  Orbitron_900Black,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
};

export const fonts = {
  display: 'Orbitron_900Black',
  displayBold: 'Orbitron_700Bold',
  displayMedium: 'Orbitron_500Medium',
  body: 'Inter_400Regular',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
};

/** Used before the fonts resolve, and if loading fails. */
export const fallbackFonts = {
  display: undefined,
  displayBold: undefined,
  displayMedium: undefined,
  body: undefined,
  bodySemi: undefined,
  bodyBold: undefined,
};
