/**
 * The hub. Three things the daily loop is made of, plus a way into settings.
 * Deliberately sparse — this is a screen someone glances at, not one they browse.
 */

import { StyleSheet, Text, View } from "react-native";

import { Button, Screen } from "../components";
import { space, type } from "../theme";

export interface HomeScreenProps {
  name: string;
  weekday: string;
  onWrap: () => void;
  onBriefing: () => void;
  onCapture: () => void;
  onSettings: () => void;
}

export function HomeScreen({ name, weekday, onWrap, onBriefing, onCapture, onSettings }: HomeScreenProps) {
  return (
    <Screen>
      <View style={styles.greeting}>
        <Text style={type.display}>Hello, {name}.</Text>
        <Text style={type.dim}>It's {weekday}.</Text>
      </View>

      <View style={styles.actions}>
        <Button label="Capture a thought" onPress={onCapture} />
        <Button label="Morning briefing" tone="ghost" onPress={onBriefing} />
        <Button label="Wrap up the day" tone="ghost" onPress={onWrap} />
      </View>

      <View style={{ flex: 1 }} />
      <Button label="Settings" tone="ghost" onPress={onSettings} />
      <View style={{ height: space.lg }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { gap: space.xs, paddingTop: space.lg },
  actions: { gap: space.sm, paddingTop: space.xl },
});
