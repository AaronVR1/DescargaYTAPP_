import { StatusBar } from 'expo-status-bar';
import "@/global.css";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider/index";
import { StyleSheet } from 'react-native';
import { NavigationContainer } from "@react-navigation/native";
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <NavigationContainer>
      <GluestackUIProvider mode="light">
        <AppNavigator />
        <StatusBar style="auto" />
      </GluestackUIProvider>
    </NavigationContainer>
  );
}