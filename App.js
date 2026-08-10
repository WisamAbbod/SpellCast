import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import MenuScreen from './menu_screen.js';
import SpellcastGrid from './spellcast_grid.js';
import InstructionsScreen from './instructions_screen.js';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('menu');

  return (
    <>
      <StatusBar style="light" />
      {currentScreen === 'menu' && <MenuScreen navigation={setCurrentScreen} />}
      {currentScreen === 'play' && <SpellcastGrid goToMenu={() => setCurrentScreen('menu')} />}
      {currentScreen === 'instructions' && <InstructionsScreen navigation={setCurrentScreen} />}
    </>
  );
}