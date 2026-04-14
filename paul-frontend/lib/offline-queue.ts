import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { apiFetch } from "./api";

const KEY = "offline_queue_v1";

type OfflineEvent = {
    path: string;
    method: "POST" | "PUT" | "DELETE";
    body?: any;
};

export async function enqueueEvent(event: OfflineEvent) {
    const raw = await AsyncStorage.getItem(KEY);
    const queue: OfflineEvent[] = raw ? JSON.parse(raw) : [];
    queue.push(event);
    await AsyncStorage.setItem(KEY, JSON.stringify(queue));
}

export async function flushQueue() {
    const state = await NetInfo.fetch();
    if (!state.isConnected) return;

    const raw = await AsyncStorage.getItem(KEY);
    const queue: OfflineEvent[] = raw ? JSON.parse(raw) : [];
    if (!queue.length) return;

    const remaining: OfflineEvent[] = [];

    for (const event of queue) {
        try {
            await apiFetch(event.path, {
                method: event.method,
                body: event.body ? JSON.stringify(event.body) : undefined,
            });
        } catch {
            remaining.push(event);
        }
    }

    await AsyncStorage.setItem(KEY, JSON.stringify(remaining));
}