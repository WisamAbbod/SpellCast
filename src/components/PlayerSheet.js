import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Sheet from './Sheet.js';
import Button from './Button.js';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { getSettings, saveSettings } from '../storage/settings.js';
import { withHidden } from '../storage/schema.js';
import { reportPlayer } from '../online/reports.js';

/**
 * What you can do about another player: report their name, or hide them.
 * Opened by tapping a name on the leaderboard, in an online lobby, or in an
 * online game's results (App Store guideline 1.2 asks for both).
 *
 *   player   { id, name } or null (closed)
 *   context  'leaderboard' | 'lobby' | 'results' - recorded with a report
 */
const PlayerSheet = ({ player, context, onClose }) => {
  const [state, setState] = useState('idle'); // idle | sending | reported | hidden
  const [error, setError] = useState(null);

  // A fresh sheet for every player opened.
  useEffect(() => {
    setState('idle');
    setError(null);
  }, [player && player.id]);

  if (!player) return null;

  const report = async () => {
    setState('sending');
    setError(null);
    const result = await reportPlayer({ id: player.id, name: player.name, context });
    if (result.ok) setState('reported');
    else {
      setState('idle');
      setError(result.reason);
    }
  };

  const hide = () => {
    saveSettings({ hiddenPlayers: withHidden(getSettings().hiddenPlayers, player) });
    setState('hidden');
  };

  const done = state === 'reported' || state === 'hidden';

  return (
    <Sheet
      visible={!!player}
      title={player.name}
      subtitle={
        state === 'reported'
          ? 'Thanks. The name has been reported and will be reviewed.'
          : state === 'hidden'
            ? 'Hidden. You can bring hidden players back in Settings.'
            : 'Is this name offensive, or is this player bothering you?'
      }
      onRequestClose={onClose}
    >
      {!done && (
        <>
          <Button
            label={state === 'sending' ? 'Sending…' : 'Report name'}
            variant="danger"
            onPress={report}
            disabled={state === 'sending'}
            accessibilityLabel={`Report ${player.name}'s name as offensive`}
          />
          <Button
            label="Hide this player"
            variant="secondary"
            onPress={hide}
            accessibilityLabel={`Hide ${player.name} from the leaderboard and online games`}
          />
        </>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {state === 'reported' && (
        <Button label="Also hide this player" variant="secondary" onPress={hide} />
      )}
      <Button label={done ? 'Done' : 'Cancel'} variant="ghost" onPress={onClose} />
    </Sheet>
  );
};

const styles = StyleSheet.create({
  error: { color: colors.danger, fontFamily: fonts.body, fontSize: 12, textAlign: 'center' },
});

export default PlayerSheet;
