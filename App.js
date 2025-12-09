import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import MenuScreen from 'C:/Users/Wisam/SpellCast/menu_screen.js';
import SpellcastGrid from 'C:/Users/Wisam/SpellCast/spellcast_grid.js';
import InstructionsScreen from 'C:/Users/Wisam/SpellCast/instructions_screen.js';

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