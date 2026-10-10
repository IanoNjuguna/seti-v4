import { Platform } from 'react-native';

/**
 * Base URL for the Seti API.
 *
 * Resolution order:
 *  1. `EXPO_PUBLIC_API_URL` — needed for a physical device, where `localhost`
 *     points at the phone itself rather than your machine. Set it to your LAN
 *     IP, e.g. `http://192.168.1.20:4000`.
 *  2. Platform defaults, which work for a simulator / emulator with the backend
 *     running on the same host.
 *
 * Android emulators reach the host at 10.0.2.2, never at localhost.
 */
const LAN_URL = process.env.EXPO_PUBLIC_API_URL;

export const API_BASE_URL =
  LAN_URL ??
  Platform.select({
    ios: 'http://localhost:4000',
    android: 'http://10.0.2.2:4000',
    default: 'http://localhost:4000',
  });


