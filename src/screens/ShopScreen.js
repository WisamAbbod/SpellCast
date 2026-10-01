import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Screen from '../components/Screen.js';
import Button from '../components/Button.js';
import Sheet from '../components/Sheet.js';
import StardustBadge from '../components/StardustBadge.js';
import BackgroundSwatch from '../components/BackgroundSwatch.js';
import Mascot from '../components/Mascot.js';
import { useProfile } from '../hooks/useProfile.js';
import { useSettings } from '../hooks/useSettings.js';
import { STARDUST_GLYPH } from '../game/economy.js';
import { getProfile, saveProfile } from '../storage/profile.js';
import { getSettings, saveSettings } from '../storage/settings.js';
import { balanceOf, owns, purchase } from '../storage/wallet.js';
import { BACKGROUNDS, BACKGROUND_ORDER, backgroundFor } from '../theme/backgrounds.js';
import { TRACKS, TRACK_ORDER, formatLength } from '../audio/tracks.js';
import { COSTUMES, COSTUME_ORDER, isPremium } from '../theme/costumes.js';
import { playInvalid, playWord, setMusicTrack, tapFeedback } from '../audio/audio.js';
import { colors } from '../theme/colors.js';
import { fonts } from '../theme/typography.js';
import { radius, space } from '../theme/layout.js';

/**
 * Where stardust goes.
 *
 * Ownership is read from the profile, the equipped choice from settings - which
 * is what lets a preview be free: Screen takes a backgroundKey prop that
 * overrides the equipped one without persisting anything, so backing out of the
 * shop reverts by simply unmounting. Music previews are not that lucky and are
 * undone explicitly on the way out.
 *
 * One tap does the obvious thing. Owned means equip; unowned means preview, and
 * the buy bar appears underneath. The Sheet is the confirmation, never the first
 * thing a tap produces.
 */

const TABS = [
  { key: 'backgrounds', label: 'Backgrounds' },
  { key: 'tracks', label: 'Soundtracks' },
  { key: 'costumes', label: 'Costumes' },
];

// The tallest costume (the wizard hat) peaks a quarter of the astronaut's
// height above its box. Room for that, so nothing pokes into the row above.
const HAT_ROOM = 0.26;
const THUMB_SIZE = 78;

/** Each tab: what it sells, in what order, and which setting equips it. */
const CATALOG = {
  backgrounds: { entries: BACKGROUNDS, order: BACKGROUND_ORDER, setting: 'backgroundKey' },
  tracks: { entries: TRACKS, order: TRACK_ORDER, setting: 'trackKey' },
  costumes: { entries: COSTUMES, order: COSTUME_ORDER, setting: 'costumeKey' },
};

const Segment = ({ tab, onChange }) => (
  <View style={styles.segment}>
    {TABS.map((entry) => {
      const active = entry.key === tab;
      return (
        <Pressable
          key={entry.key}
          onPress={() => {
            tapFeedback();
            onChange(entry.key);
          }}
          style={[styles.pill, active && styles.pillActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: active }}
          accessibilityLabel={entry.label}
        >
          <Text style={[styles.pillText, active && styles.pillTextActive]}>{entry.label}</Text>
        </Pressable>
      );
    })}
  </View>
);

const ShopScreen = ({ nav, tab: initialTab }) => {
  const profile = useProfile();
  const settings = useSettings();
  const [tab, setTab] = useState(CATALOG[initialTab] ? initialTab : 'backgrounds');
  const [preview, setPreview] = useState(null);
  const [pending, setPending] = useState(null);
  const [hello, setHello] = useState(null); // the astronaut's reaction to a new outfit
  const { height } = useWindowDimensions();
  const fittingSize = height < 700 ? 92 : 120;

  const balance = balanceOf(profile);
  const isBackgrounds = tab === 'backgrounds';
  const isTracks = tab === 'tracks';
  const isCostumes = tab === 'costumes';
  const { entries, order, setting } = CATALOG[tab];
  const equipped = settings[setting];
  const greet = (mood) => setHello((previous) => ({ mood, key: (previous ? previous.key : 0) + 1 }));

  const stopPreview = useCallback(() => {
    setPreview(null);
    setMusicTrack(getSettings().trackKey);
  }, []);

  // A music preview is a real side effect on a module-level player, so it has
  // to be undone even if the screen leaves by the hardware back button.
  useEffect(() => () => setMusicTrack(getSettings().trackKey), []);

  // Switching tabs abandons whatever was being previewed in the other one.
  const changeTab = (next) => {
    stopPreview();
    setTab(next);
  };

  const equip = (key) => {
    setPreview(null);
    saveSettings({ [setting]: key });
    if (isCostumes) greet('wave');
    playWord();
  };

  const select = (key) => {
    tapFeedback();
    if (owns(profile, tab, key) || entries[key].price === 0) {
      equip(key);
      return;
    }
    setPreview(key);
    if (isTracks) setMusicTrack(key);
    if (isCostumes) greet('wow');
  };

  const confirm = async () => {
    const { kind, key, price } = pending;
    setPending(null);

    // getProfile, not the render-time `profile`: this runs after an await gap
    // in the user's own time, and the cached value is the authority.
    const current = getProfile();
    const next = purchase(current, kind, key, price);
    if (next === current) {
      playInvalid();
      return;
    }

    await saveProfile(next);
    await saveSettings({ [CATALOG[kind].setting]: key });
    setPreview(null);
    if (kind === 'costumes') greet('ecstatic');
    playWord();
  };

  const previewing = preview ? entries[preview] : null;
  const canBuy = !!previewing && balance >= previewing.price;

  return (
    <Screen
      // The preview, in one line. Undefined falls through to whatever is
      // equipped, so nothing has to be restored on the way out.
      backgroundKey={isBackgrounds && preview ? preview : undefined}
      stars={settings.reducedMotion ? 0 : 30}
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            tapFeedback();
            nav.pop();
          }}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <StardustBadge />
      </View>

      <Text style={styles.title}>SHOP</Text>
      <Segment tab={tab} onChange={changeTab} />

      {/* The fitting room: the astronaut wears whatever is being looked at,
          and reacts to it - a wow for a preview, a backflip for a purchase.
          Outside the list on purpose: it stays in view while you scroll to the
          costume you tapped, and a scroll view would clip the hat - costumes
          reach above the astronaut's own box. */}
      {isCostumes && (
        <View style={[styles.fitting, { paddingTop: Math.round(fittingSize * HAT_ROOM) }]}>
          <Mascot size={fittingSize} costumeKey={preview || equipped} reaction={hello} roam={1.4} />
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {order.map((key) => {
          const entry = entries[key];
          const isOwned = entry.price === 0 || owns(profile, tab, key);
          const isEquipped = equipped === key;
          const isPreviewing = preview === key;
          const affordable = balance >= entry.price;
          const premium = isCostumes && isPremium(entry);

          const state = isEquipped
            ? 'Equipped'
            : isOwned
              ? 'Tap to equip'
              : `${entry.price} ${STARDUST_GLYPH}`;

          return (
            <Pressable
              key={key}
              onPress={() => select(key)}
              style={[
                styles.item,
                premium && styles.itemPremium,
                isEquipped && styles.itemEquipped,
                isPreviewing && styles.itemPreviewing,
                !isOwned && !affordable && styles.itemLocked,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                isOwned
                  ? `${entry.name}. ${entry.mood}. ${isEquipped ? 'Equipped.' : 'Tap to equip.'}`
                  : `${entry.name}. ${entry.mood}. ${entry.price} stardust, you have ${balance}. Tap to preview.`
              }
            >
              {isBackgrounds && <BackgroundSwatch background={backgroundFor(key)} />}
              {/* Still, not animated: a list of floating astronauts would cost
                  more than it shows, and the one above is doing the moving. */}
              {isCostumes && (
                <View style={[styles.costumeThumb, { paddingTop: Math.round(THUMB_SIZE * HAT_ROOM) }]}>
                  <Mascot size={THUMB_SIZE} costumeKey={key} still />
                </View>
              )}

              <View style={styles.itemHeader}>
                <View style={styles.itemText}>
                  {premium && <Text style={styles.premiumTag}>PREMIUM</Text>}
                  <Text style={styles.itemName}>{entry.name}</Text>
                  <Text style={styles.itemMood}>
                    {entry.mood}
                    {isTracks && ` · ${formatLength(entry.seconds)}`}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.itemState,
                    isEquipped && styles.itemStateEquipped,
                    !isOwned && !affordable && styles.itemStateLocked,
                  ]}
                >
                  {state}
                </Text>
              </View>

              <Text style={styles.itemBlurb}>{entry.blurb}</Text>
              {/* CC0 needs no credit. It is given anyway. */}
              {!!entry.credit && (
                <Text style={styles.itemCredit}>
                  by {entry.credit.author} · {entry.credit.license} · OpenGameArt
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {!!previewing && (
        <View style={styles.buyBar}>
          <Text style={styles.buyNote}>
            {canBuy
              ? `Previewing ${previewing.name}.`
              : `${previewing.price - balance} ${STARDUST_GLYPH} short of ${previewing.name}.`}
          </Text>
          <Button
            label={`Unlock ${previewing.name} — ${previewing.price} ${STARDUST_GLYPH}`}
            disabled={!canBuy}
            onPress={() => setPending({ kind: tab, key: preview, price: previewing.price })}
          />
          <Button label="Stop previewing" variant="ghost" onPress={stopPreview} />
        </View>
      )}

      <Sheet
        visible={!!pending}
        title={pending ? `Unlock ${entries[pending.key].name}?` : ''}
        subtitle={
          pending
            ? `${pending.price} ${STARDUST_GLYPH} of your ${balance}. It is yours for good, and equips right away.`
            : ''
        }
        onRequestClose={() => setPending(null)}
      >
        <Button label={`Yes, spend ${pending ? pending.price : 0} ${STARDUST_GLYPH}`} onPress={confirm} />
        <Button label="Not yet" variant="ghost" onPress={() => setPending(null)} />
      </Sheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 30, color: colors.textDim, lineHeight: 32 },
  title: {
    fontFamily: fonts.display, fontSize: 26, color: colors.text,
    letterSpacing: 4, textAlign: 'center', marginBottom: space.md,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    marginBottom: space.md,
  },
  pill: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center' },
  pillActive: { backgroundColor: colors.primaryDim },
  pillText: {
    fontFamily: fonts.bodySemi, fontSize: 13,
    color: colors.textFaint, letterSpacing: 0.8,
  },
  pillTextActive: { color: colors.text },

  // Drawn after the tabs, so a celebratory backflip passes over them
  // instead of being cut off.
  fitting: { alignItems: 'center', paddingBottom: space.sm, zIndex: 1 },
  costumeThumb: { alignItems: 'center' },
  scroll: { paddingBottom: space.lg, gap: space.sm },
  item: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: space.sm,
  },
  itemEquipped: { borderColor: colors.stardustEdge, backgroundColor: colors.stardustDim },
  itemPreviewing: { borderColor: colors.primaryEdge },
  // The long goals: a gold edge, so they look worth saving for before the price says so.
  itemPremium: { borderColor: 'rgba(255, 209, 102, 0.45)' },
  premiumTag: {
    fontFamily: fonts.bodySemi, fontSize: 10, color: colors.gold,
    letterSpacing: 1.6, marginBottom: 3,
  },
  itemLocked: { opacity: 0.55 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  itemText: { flex: 1 },
  itemName: {
    fontFamily: fonts.displayBold, fontSize: 15,
    color: colors.text, letterSpacing: 1.4,
  },
  itemMood: {
    fontFamily: fonts.body, fontSize: 11,
    color: colors.textFaint, marginTop: 3, letterSpacing: 0.4,
  },
  itemState: {
    fontFamily: fonts.bodySemi, fontSize: 12,
    color: colors.stardust, letterSpacing: 0.6,
  },
  itemStateEquipped: { color: colors.success },
  itemStateLocked: { color: colors.textFaint },
  itemBlurb: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, lineHeight: 17 },
  itemCredit: { fontFamily: fonts.body, fontSize: 10, color: colors.textFaint, letterSpacing: 0.3 },

  buyBar: {
    gap: space.sm,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  buyNote: {
    fontFamily: fonts.body, fontSize: 11,
    color: colors.textFaint, textAlign: 'center',
  },
});

export default ShopScreen;
