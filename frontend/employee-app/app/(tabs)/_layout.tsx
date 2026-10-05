import { Tabs } from "expo-router";
import { fonts, useTheme } from "@/theme";

// Bottom navigation of the V114 employee app (legacy/employee-portal): الرئيسية، الحضور، الإجازات، الراتب، فريقي، ملفي.
export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.c },
        headerTitleStyle: { fontFamily: fonts.bold, color: t.tx },
        tabBarStyle: { backgroundColor: t.c, borderTopColor: t.bd },
        tabBarActiveTintColor: t.bl,
        tabBarInactiveTintColor: t.dm,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarIconStyle: { display: "none" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "الرئيسية" }} />
      <Tabs.Screen name="attendance" options={{ title: "الحضور" }} />
      <Tabs.Screen name="leaves" options={{ title: "الإجازات" }} />
      <Tabs.Screen name="salary" options={{ title: "الراتب" }} />
      <Tabs.Screen name="team" options={{ title: "فريقي" }} />
      <Tabs.Screen name="profile" options={{ title: "ملفي" }} />
    </Tabs>
  );
}
