import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { characterByKey, characterFor } from '../game/slow/characters.js';
import { AVATAR_FACE, AVATAR_VIEWBOX, artFor } from '../theme/characterArt.js';

/**
 * A bot's face. Static, and small on purpose: the mascot is the one that moves
 * and reacts; the bots are the supporting cast.
 *
 * Pass `player` (resolved by name, like everywhere else) or a `characterKey`
 * directly, which the character picker uses.
 */
const BotAvatar = ({ player, characterKey, size = 24, style }) => {
  const character = characterKey ? characterByKey(characterKey) : characterFor(player);
  const art = artFor(character ? character.key : null);
  const line = { fill: 'none', stroke: AVATAR_FACE, strokeWidth: 5, strokeLinecap: 'round' };

  return (
    <View style={[{ width: size, height: size }, style]} accessible={false}>
      <Svg width={size} height={size} viewBox={AVATAR_VIEWBOX}>
        <Path d={art.body} fill={art.tint} stroke={art.tint} strokeWidth={10} strokeLinejoin="round" />
        {art.eyes.map((d) => (
          <Path key={d} d={d} fill={AVATAR_FACE} />
        ))}
        {art.mouth.fill ? <Path d={art.mouth.d} fill={AVATAR_FACE} /> : <Path d={art.mouth.d} {...line} />}
      </Svg>
    </View>
  );
};

export default BotAvatar;
