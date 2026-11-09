import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const AUTH_PROFILE_KEY = "b24_auth";
const AUTH_TOKEN_KEY = "b24_access_token_v1";
const SECURE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function ensureSecureStore() {
  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error("Secure session storage is unavailable on this device");
  }
}

function profileWithoutToken(user) {
  const profile = { ...user };
  delete profile.token;
  return profile;
}

async function scrubLegacyToken(profile) {
  try {
    await AsyncStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile));
  } catch (error) {
    // Do not keep using a session whose plaintext copy could not be removed.
    await AsyncStorage.removeItem(AUTH_PROFILE_KEY).catch(() => {});
    throw error;
  }
}

export async function getStoredAuth() {
  const raw = await AsyncStorage.getItem(AUTH_PROFILE_KEY);
  if (!raw) return null;

  let storedUser;
  try {
    storedUser = JSON.parse(raw);
  } catch (error) {
    await AsyncStorage.removeItem(AUTH_PROFILE_KEY).catch(() => {});
    throw error;
  }
  try {
    await ensureSecureStore();
  } catch (error) {
    if (storedUser?.token) await AsyncStorage.removeItem(AUTH_PROFILE_KEY).catch(() => {});
    throw error;
  }

  let token;
  try {
    token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY, SECURE_OPTIONS);
  } catch (error) {
    if (storedUser?.token) await AsyncStorage.removeItem(AUTH_PROFILE_KEY).catch(() => {});
    throw error;
  }
  if (!token && storedUser?.token) {
    token = storedUser.token;
    try {
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token, SECURE_OPTIONS);
    } catch (error) {
      // Fail closed instead of falling back to a plaintext session.
      await AsyncStorage.removeItem(AUTH_PROFILE_KEY).catch(() => {});
      throw error;
    }
  }

  if (storedUser?.token) await scrubLegacyToken(profileWithoutToken(storedUser));
  if (!token) return null;
  return { ...profileWithoutToken(storedUser), token };
}

export async function setStoredAuth(user) {
  if (!user || typeof user.token !== "string" || !user.token) {
    throw new Error("A valid session token is required");
  }
  await ensureSecureStore();
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, user.token, SECURE_OPTIONS);
  const profile = profileWithoutToken(user);
  try {
    await AsyncStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile));
  } catch (error) {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY, SECURE_OPTIONS).catch(() => {});
    throw error;
  }
  return { ...profile, token: user.token };
}

export async function updateStoredAuth(patch) {
  const user = await getStoredAuth();
  if (!user) return null;
  return setStoredAuth({ ...user, ...patch });
}

export async function clearStoredAuth() {
  let profileError = null;
  try {
    await AsyncStorage.removeItem(AUTH_PROFILE_KEY);
  } catch (error) {
    profileError = error;
  }
  try {
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY, SECURE_OPTIONS);
    }
  } catch {
    // Without its profile, an orphaned secure token is not used by the app.
  }
  if (profileError) throw profileError;
}
