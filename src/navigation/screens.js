import MenuScreen from '../screens/MenuScreen.js';
import DailyScreen from '../screens/DailyScreen.js';
import PracticeScreen from '../screens/PracticeScreen.js';
import GameScreen from '../screens/GameScreen.js';
import ResultsScreen from '../screens/ResultsScreen.js';
import StatsScreen from '../screens/StatsScreen.js';
import SettingsScreen from '../screens/SettingsScreen.js';
import ShopScreen from '../screens/ShopScreen.js';
import InstructionsScreen from '../screens/InstructionsScreen.js';
import SlowSetupScreen from '../screens/SlowSetupScreen.js';
import SlowGameScreen from '../screens/SlowGameScreen.js';
import SlowResultsScreen from '../screens/SlowResultsScreen.js';

export const SCREENS = {
  menu: MenuScreen,
  daily: DailyScreen,
  practice: PracticeScreen,
  game: GameScreen,
  results: ResultsScreen,
  stats: StatsScreen,
  settings: SettingsScreen,
  shop: ShopScreen,
  instructions: InstructionsScreen,

  // Slow mode: the turn-based, pass-and-play game.
  slowSetup: SlowSetupScreen,
  slowGame: SlowGameScreen,
  slowResults: SlowResultsScreen,
};

export default SCREENS;
