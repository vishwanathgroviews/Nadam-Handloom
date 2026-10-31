// This phone's identity for the server: a random id made once and kept in the
// Keychain/Keystore, plus a readable name ("iPhone 15") and the platform.
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { KEYS, getItem, setItem } from './storage';

let cached = null;

export async function getDeviceInfo() {
  if (cached) return cached;
  let id = await getItem(KEYS.deviceId);
  if (!id) {
    id = Crypto.randomUUID();
    await setItem(KEYS.deviceId, id);
  }
  const fallback = Platform.OS === 'ios' ? (Device.deviceType === Device.DeviceType.TABLET ? 'iPad' : 'iPhone') : 'Android phone';
  // iPhone: the model ("iPhone 15"). Android: the name the owner gave the phone, else the model.
  const name = Platform.OS === 'android' ? Device.deviceName || Device.modelName : Device.modelName;
  cached = { id, name: (name || fallback).slice(0, 80), platform: Platform.OS === 'ios' ? 'ios' : 'android' };
  return cached;
}
