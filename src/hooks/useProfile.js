import { useEffect, useState } from 'react';
import { getProfile, subscribeToProfile } from '../storage/profile.js';

/** Live profile, so a stardust balance on screen never goes stale after a round. */
export const useProfile = () => {
  const [profile, setProfile] = useState(getProfile);
  useEffect(() => subscribeToProfile(setProfile), []);
  return profile;
};
